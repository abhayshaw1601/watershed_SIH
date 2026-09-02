"""
Pulls everything the pipeline needs with NO account/registration, for every
AOI job in config.AOI_JOBS (the primary AOI, which needs an older T1 + recent
T2 pair for change detection, plus any auxiliary training-only AOIs, which
just need one recent scene, "S1"):
  - Sentinel-2 L2A scene(s), via the public Earth Search STAC API + AWS-hosted
    COGs (element84 / AWS Open Data), clipped to the AOI on read (no full-tile
    download).
  - ESA WorldCover 10m labels for the AOI (bootstrap/backup training labels,
    since Bhuvan's shapefile needs a registration step your side).

Run:  .venv/Scripts/python.exe src/data_download.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from rasterio.warp import transform_bounds
from shapely.geometry import box, mapping
from pystac_client import Client

from config import (
    AOI_JOBS, DATA_RAW, DATA_LABELS,
    S2_BANDS, STAC_API_URL, STAC_COLLECTION, worldcover_url_for_tile,
)

# Date windows to search, keyed by the date-tag requested in an AOI job.
# T1/T2 bracket a multi-year gap for change detection; S1 just wants one
# recent, low-cloud scene for extra training diversity.
DATE_WINDOWS = {
    "T2": "2024-11-01/2025-03-31",  # recent dry season
    "T1": "2019-11-01/2020-03-31",  # ~5yr-earlier dry season
    "S1": "2024-11-01/2025-03-31",  # recent dry season
}


def search_scene(bbox, date_tag, max_cloud=20, limit=10):
    """Find the lowest-cloud scene over bbox in the window for this date tag."""
    catalog = Client.open(STAC_API_URL)
    search = catalog.search(
        collections=[STAC_COLLECTION],
        bbox=bbox,
        datetime=DATE_WINDOWS[date_tag],
        query={"eo:cloud_cover": {"lt": max_cloud}},
        limit=limit,
    )
    items = list(search.items())
    items.sort(key=lambda it: it.properties.get("eo:cloud_cover", 100))
    if not items:
        raise RuntimeError(
            f"No low-cloud Sentinel-2 scene found for bbox={bbox}, date_tag={date_tag} "
            "-- widen the date range or cloud threshold."
        )
    return items[0]


def clip_scene_to_stack(item, bbox, out_path):
    """Read R,G,B,NIR bands (10m) for one STAC item, clip to bbox, stack, save."""
    band_arrays = []
    profile = None
    for band in S2_BANDS:
        href = item.assets[band].href
        with rasterio.open(href) as src:
            aoi_bounds = transform_bounds("EPSG:4326", src.crs, *bbox)
            geom = [mapping(box(*aoi_bounds))]
            data, transform = rio_mask(src, geom, crop=True)
            if profile is None:
                profile = src.profile.copy()
                profile.update(
                    height=data.shape[1], width=data.shape[2],
                    transform=transform, count=len(S2_BANDS), dtype="uint16",
                )
            band_arrays.append(data[0])

    stack = np.stack(band_arrays, axis=0)
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(stack)
        dst.descriptions = tuple(S2_BANDS)
    print(f"Saved {out_path}  shape={stack.shape}  date={item.datetime.date()}  "
          f"cloud={item.properties.get('eo:cloud_cover'):.1f}%")


def download_worldcover(bbox, worldcover_tile, out_path):
    """Clip the ESA WorldCover COG straight to bbox via HTTP range reads."""
    vsi_url = f"/vsicurl/{worldcover_url_for_tile(worldcover_tile)}"
    with rasterio.open(vsi_url) as src:
        geom = [mapping(box(*bbox))]  # WorldCover is already EPSG:4326
        data, transform = rio_mask(src, geom, crop=True)
        profile = src.profile.copy()
        profile.update(height=data.shape[1], width=data.shape[2], transform=transform)
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(data)
    print(f"Saved {out_path}  shape={data.shape}")


def run_job(job):
    name, bbox, tile, dates = job["name"], job["bbox"], job["worldcover_tile"], job["dates"]
    print(f"\n=== AOI: {name}  bbox={bbox}  dates={dates} ===")

    for date_tag in dates:
        print(f"\n--- Searching Sentinel-2 L2A scene ({date_tag}) ---")
        item = search_scene(bbox, date_tag)
        print(f"{date_tag} candidate: {item.id}  ({item.datetime.date()}, "
              f"cloud={item.properties.get('eo:cloud_cover'):.1f}%)")
        clip_scene_to_stack(item, bbox, DATA_RAW / f"{name}_{date_tag}_rgbnir.tif")

    print(f"\n--- Downloading ESA WorldCover labels ({name}) ---")
    download_worldcover(bbox, tile, DATA_LABELS / f"{name}_worldcover.tif")


def main():
    for job in AOI_JOBS:
        run_job(job)
    print("\nAll AOI jobs done. Next: python src/preprocessing.py")


if __name__ == "__main__":
    main()
