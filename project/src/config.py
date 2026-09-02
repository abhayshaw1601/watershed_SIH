"""
Central config for the PS-26015 watershed pipeline.

AOI: Kadwanchi watershed, Jalna district, Maharashtra -- a real, formally
documented watershed development site (Indo-German Watershed Development
Programme, 1997-2002, 1888 ha), with published impact-evaluation literature
and actual check dams / a percolation tank. Chosen over the original Hiware
Bazar placeholder because ground-truth class-balance check showed 0% water
pixels there (the model could never learn the water class); Kadwanchi has a
non-trivial presence of all 7 target classes. Swap AOI_BBOX (and AOI_NAME)
again for your final target watershed/district once decided (e.g. from a
hackathon-provided SRISHTI-DRISHTI extract) -- everything downstream is
AOI-agnostic.
"""

from pathlib import Path

# ---- Paths ----
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_LABELS = PROJECT_ROOT / "data" / "labels"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

for d in (DATA_RAW, DATA_LABELS, DATA_PROCESSED, MODELS_DIR, OUTPUTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ---- AOI (see module docstring) ----
AOI_NAME = "kadwanchi_watershed"
AOI_CENTER_LAT = 19.8830
AOI_CENTER_LON = 75.9910
# ~9km x 9km box around the same center (enlarged from an initial 6km x 6km box after a live
# Colab run showed 0% water predictions -- checking a real reservoir visible just outside that
# smaller box confirmed enlarging to 9km bumps ground-truth water coverage 0.34% -> 2.79%,
# without moving off the documented watershed site)
AOI_BBOX = (75.9508, 19.8420, 76.0312, 19.9240)  # (minx, miny, maxx, maxy) in EPSG:4326

# ---- ESA WorldCover (backup/bootstrap labels — no registration needed) ----
WORLDCOVER_TILE = "N18E075"  # covers this AOI; recompute if AOI changes (3x3 deg grid, lower-left corner)


def worldcover_url_for_tile(tile: str) -> str:
    return (
        "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
        f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
    )


WORLDCOVER_URL = worldcover_url_for_tile(WORLDCOVER_TILE)

# ---- Auxiliary training-only AOIs (single date, no change-detection pair) ----
# Kadwanchi (above) is the PRIMARY AOI: used for the demo, change detection, and
# health/alerts story. These two exist purely to fix Model 1's class imbalance --
# Kadwanchi's ground truth is ~97% agriculture+sparse-vegetation, so dense
# vegetation and barren/degraded land had almost no training signal. Both
# verified via a ground-truth class-distribution check before adding (same
# process that caught Kadwanchi's own water gap):
#   - Tamhini Ghat, Western Ghats, Pune dist., Maharashtra: 63.1% tree cover
#   - Donimalai iron-ore mine, Sandur, Ballari dist., Karnataka: 4.5%
#     bare/sparse vegetation (mining exposes ground unambiguously; regular
#     "degraded" farmland did NOT register as bare in this global dataset --
#     tried Anantapur city and the Chambal ravine belt first, both failed)
AUX_AOIS = [
    {
        "name": "tamhini_ghat_forest",
        "bbox": (73.3800, 18.4088, 73.4654, 18.4898),  # ~9km x 9km, EPSG:4326
        "worldcover_tile": "N18E072",
    },
    {
        "name": "donimalai_barren",
        "bbox": (76.5517, 15.0184, 76.6357, 15.0994),  # ~9km x 9km, EPSG:4326
        "worldcover_tile": "N15E075",
    },
]

# Every AOI job the pipeline processes: primary (needs T1 + T2 for change
# detection) plus the auxiliary training-only sites (single recent date "S1").
AOI_JOBS = [
    {"name": AOI_NAME, "bbox": AOI_BBOX, "worldcover_tile": WORLDCOVER_TILE, "dates": ["T1", "T2"]},
] + [
    {"name": a["name"], "bbox": a["bbox"], "worldcover_tile": a["worldcover_tile"], "dates": ["S1"]}
    for a in AUX_AOIS
]

# WorldCover class codes -> our 7-class scheme (see model_plan.md 2.6, adapted:
# WorldCover has no separate "fallow" class, so it folds into agriculture/barren
# by NDVI at tile-generation time if you want that split; for the placeholder
# pipeline we map straight through).
WORLDCOVER_TO_MYCLASS = {
    10: 1,   # Tree cover              -> Dense vegetation
    20: 3,   # Shrubland               -> Sparse vegetation
    30: 3,   # Grassland               -> Sparse vegetation
    40: 2,   # Cropland                -> Agriculture
    50: 5,   # Built-up                -> Built-up
    60: 4,   # Bare / sparse vegetation-> Barren/degraded
    70: 4,   # Snow and ice            -> Barren/degraded (not expected in AOI)
    80: 0,   # Permanent water bodies  -> Water body
    90: 0,   # Herbaceous wetland      -> Water body
    95: 1,   # Mangroves               -> Dense vegetation (not expected in AOI)
    100: 3,  # Moss and lichen         -> Sparse vegetation (not expected in AOI)
}

# ---- Our 7-class scheme (model_plan.md 2.3) ----
CLASS_NAMES = {
    0: "Water body / conservation structure",
    1: "Dense vegetation / forest",
    2: "Agriculture / cropland",
    3: "Sparse vegetation / grassland",
    4: "Barren / degraded land",
    5: "Built-up / settlement",
    6: "Fallow / bare agricultural land",
}
NUM_CLASSES = len(CLASS_NAMES)

CLASS_COLORS = {  # RGB, for visualization
    0: (66, 135, 245),
    1: (34, 102, 51),
    2: (154, 205, 50),
    3: (189, 183, 107),
    4: (160, 120, 90),
    5: (200, 30, 30),
    6: (222, 184, 135),
}

# ---- Change-detection classes (model_plan.md 3.3) ----
CHANGE_CLASS_NAMES = {
    0: "No change",
    1: "New water/conservation structure",
    2: "New construction/built-up",
    3: "Vegetation/water loss (degradation)",
    4: "Vegetation gain",
}

# ---- Sentinel-2 bands we pull (via Earth Search STAC, no auth needed) ----
S2_BANDS = ["red", "green", "blue", "nir"]  # B04, B03, B02, B08 (10m)
STAC_API_URL = "https://earth-search.aws.element84.com/v1"
STAC_COLLECTION = "sentinel-2-l2a"

# ---- Training / tiling (model_plan.md 2.7) ----
PATCH_SIZE = 128
PATCH_OVERLAP = 32
BATCH_SIZE = 8
NUM_EPOCHS = 25
LR = 1e-4
IN_CHANNELS = 6  # R, G, B, NIR, NDVI, NDWI
