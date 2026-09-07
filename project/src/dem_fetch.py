"""
Fetches Copernicus DEM GLO-30 elevation data for an AOI bbox -- the terrain
input for watershed_delineation.py's real catchment/drainage-network delin-
eation (PS-26015's own "geospatial techniques ... to enhance watershed
development outcomes" ask, not just land-cover classification).

Public, no-auth AWS Open Data bucket `copernicus-dem-30m` -- verified for
real via a direct curl HEAD request against an actual tile before writing
any code around it (see documentation.md), not assumed from documentation
alone. Same /vsicurl/ + rasterio.mask pattern already proven in
data_download.py::download_worldcover, just against a different public
bucket. 30m resolution, 1x1 degree tiles.

Real, verified bug this module exists specifically to avoid: Kadwanchi's own
AOI_BBOX crosses 76.0 degrees E, so a naive single-tile fetch silently misses
a real strip of the flagship AOI. dem_tiles_for_bbox() always computes every
intersecting integer-degree tile (mosaicked via rasterio.merge if >1), never
assumes a single tile.

Run:  .venv/Scripts/python.exe src/dem_fetch.py   (smoke-tests against Kadwanchi)
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import rasterio
from affine import Affine
from rasterio.io import MemoryFile
from rasterio.mask import mask as rio_mask
from rasterio.merge import merge as rio_merge
from shapely.geometry import box, mapping

from config import DATA_RAW, atomic_raster_write

COPERNICUS_DEM_BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com"
DEM_CACHE_DIR = DATA_RAW / "dem"


def dem_tiles_for_bbox(bbox: tuple) -> list[str]:
    """Every integer-degree Copernicus DEM tile ID intersecting bbox (up to 4:
    N/S x E/W neighbors, whenever the bbox straddles a whole-degree line in
    either axis -- Kadwanchi's own bbox does this in longitude)."""
    minx, miny, maxx, maxy = bbox
    lat_lo, lat_hi = math.floor(miny), math.floor(maxy)
    lon_lo, lon_hi = math.floor(minx), math.floor(maxx)

    tiles = []
    for lat in range(lat_lo, lat_hi + 1):
        ns = f"N{lat:02d}" if lat >= 0 else f"S{abs(lat):02d}"
        for lon in range(lon_lo, lon_hi + 1):
            ew = f"E{lon:03d}" if lon >= 0 else f"W{abs(lon):03d}"
            tiles.append(f"{ns}_00_{ew}_00")
    return tiles


def dem_tile_url(tile_id: str) -> str:
    return (f"{COPERNICUS_DEM_BUCKET}/Copernicus_DSM_COG_10_{tile_id}_DEM/"
            f"Copernicus_DSM_COG_10_{tile_id}_DEM.tif")


def _fetch_and_cache_tile(tile_id: str, cache_dir: Path) -> Path:
    """Downloads one whole 1x1 degree tile (~35-40MB) and caches it on disk,
    keyed by tile ID -- tiles never change, so every AOI that falls in the
    same tile (all 4 current AOIs do, for example) reuses this fetch."""
    cache_path = cache_dir / f"{tile_id}.tif"
    if cache_path.exists():
        print(f"--> [DEM] Tile {tile_id} found in local cache.", flush=True)
        return cache_path
    cache_dir.mkdir(parents=True, exist_ok=True)
    print(f"--> [DEM] Downloading Copernicus 30m DEM tile {tile_id} from AWS Open Data (~35MB, one-time fetch)...", flush=True)
    vsi_url = f"/vsicurl/{dem_tile_url(tile_id)}"
    with rasterio.open(vsi_url) as src:
        data = src.read()
        profile = src.profile.copy()
    atomic_raster_write(cache_path, data, profile)
    print(f"--> [DEM] Cached DEM tile {tile_id} -> {cache_path}  shape={data.shape}", flush=True)
    return cache_path


def fetch_dem_mosaic(bbox: tuple, cache_dir: Path = DEM_CACHE_DIR):
    """Fetch/cache DEM elevation data for bbox.
    Uses windowed Cloud-Optimized GeoTIFF (COG) HTTP range streaming with
    local disk slice caching so only the required ~300x300 pixel area is
    streamed, avoiding slow 35-70MB full-tile downloads.
    Returns (elevation (1,H,W) float32, profile) in EPSG:4326.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    minx, miny, maxx, maxy = bbox
    crop_cache_path = cache_dir / f"crop_{minx:.4f}_{miny:.4f}_{maxx:.4f}_{maxy:.4f}.tif"

    if crop_cache_path.exists():
        with rasterio.open(crop_cache_path) as src:
            elevation = src.read()
            profile = src.profile.copy()
        print(f"--> [DEM] Loaded AOI elevation from local cache ({crop_cache_path.name}).", flush=True)
        return elevation, profile

    tile_ids = dem_tiles_for_bbox(bbox)
    print(f"--> [DEM] Streaming windowed Copernicus 30m DEM for {len(tile_ids)} tile(s): {tile_ids}...", flush=True)

    NODATA = -9999.0
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
        VSI_CACHE=True,
    ):
        sources = []
        try:
            for t in tile_ids:
                local_tile = cache_dir / f"{t}.tif"
                if local_tile.exists():
                    src = rasterio.open(local_tile)
                else:
                    vsi_url = f"/vsicurl/{dem_tile_url(t)}"
                    src = rasterio.open(vsi_url)
                sources.append(src)

            if len(sources) == 1:
                geom = [mapping(box(*bbox))]
                clipped, clip_transform = rio_mask(sources[0], geom, crop=True, nodata=NODATA)
                profile = sources[0].profile.copy()
                profile.update(height=clipped.shape[1], width=clipped.shape[2], transform=clip_transform, nodata=NODATA)
            else:
                clipped, clip_transform = rio_merge(sources, bounds=bbox, nodata=NODATA)
                profile = sources[0].profile.copy()
                profile.update(height=clipped.shape[1], width=clipped.shape[2], transform=clip_transform, nodata=NODATA)
        finally:
            for s in sources:
                try:
                    s.close()
                except Exception:
                    pass

    clipped, profile = _trim_nodata_border(clipped, profile, NODATA)

    # Save the fast cropped slice locally for subsequent instant access
    atomic_raster_write(crop_cache_path, clipped, profile)
    print(f"--> [DEM] Cached AOI elevation slice -> {crop_cache_path.name}  shape={clipped.shape}", flush=True)
    return clipped, profile


def _trim_nodata_border(elevation, profile, nodata_value):
    """Drops any fully-nodata border rows/columns left by the crop-window
    rounding above -- they carry no real elevation data, keeping them just
    means passing a degenerate edge into the flow-routing pipeline later."""
    valid = elevation[0] != nodata_value
    rows = valid.any(axis=1)
    cols = valid.any(axis=0)
    if rows.all() and cols.all():
        return elevation, profile
    r0, r1 = rows.argmax(), len(rows) - rows[::-1].argmax()
    c0, c1 = cols.argmax(), len(cols) - cols[::-1].argmax()
    trimmed = elevation[:, r0:r1, c0:c1]
    new_transform = profile["transform"] * Affine.translation(c0, r0)
    profile = profile.copy()
    profile.update(height=trimmed.shape[1], width=trimmed.shape[2], transform=new_transform)
    return trimmed, profile


if __name__ == "__main__":
    from config import AOI_BBOX

    tiles = dem_tiles_for_bbox(AOI_BBOX)
    print(f"Kadwanchi AOI_BBOX={AOI_BBOX}")
    print(f"Intersecting DEM tiles: {tiles}")
    assert len(tiles) == 2, f"expected 2 tiles (crosses 76.0E), got {len(tiles)}: {tiles}"

    elevation, profile = fetch_dem_mosaic(AOI_BBOX)
    print(f"Mosaic+clip shape={elevation.shape}  crs={profile['crs']}  "
          f"elev min/max={elevation.min():.1f}/{elevation.max():.1f}m")
    assert elevation.min() > -100, "suspicious elevation (likely nodata leaking through as huge negative)"
    print("Smoke test passed.")
