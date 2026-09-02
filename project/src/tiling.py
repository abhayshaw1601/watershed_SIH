"""
Tiles the aligned (6-channel image, mask) pairs into small patches, drops
mostly-empty/nodata patches, augments (flip/rotate x4 -> x8 per patch), and
writes a train/val manifest (model_plan.md 2.5 steps 6-7).

Run:  .venv/Scripts/python.exe src/tiling.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import csv
import numpy as np
import rasterio

from config import AOI_JOBS, DATA_PROCESSED, PATCH_SIZE, PATCH_OVERLAP

TILES_DIR = DATA_PROCESSED / "tiles"
TILES_DIR.mkdir(exist_ok=True)

STRIDE = PATCH_SIZE - PATCH_OVERLAP
VAL_FRACTION = 0.15
MAX_NODATA_FRACTION = 0.05  # drop patches that are >5% zero/nodata pixels


def augmentations(img, mask):
    """8 dihedral transforms: identity, 3 rotations, and their mirrors."""
    out = []
    for k in range(4):
        img_r = np.rot90(img, k, axes=(1, 2))
        mask_r = np.rot90(mask, k)
        out.append((img_r, mask_r))
        out.append((np.flip(img_r, axis=2), np.flip(mask_r, axis=1)))
    return out


def tile_pair(aoi_name, date_tag):
    stack_path = DATA_PROCESSED / f"{aoi_name}_{date_tag}_stack6.tif"
    mask_path = DATA_PROCESSED / f"{aoi_name}_{date_tag}_mask.tif"

    with rasterio.open(stack_path) as s:
        img = s.read()  # (6, H, W)
    with rasterio.open(mask_path) as m:
        msk = m.read(1)  # (H, W)

    C, H, W = img.shape
    records = []
    patch_id = 0

    for y in range(0, H - PATCH_SIZE + 1, STRIDE):
        for x in range(0, W - PATCH_SIZE + 1, STRIDE):
            img_p = img[:, y:y + PATCH_SIZE, x:x + PATCH_SIZE]
            msk_p = msk[y:y + PATCH_SIZE, x:x + PATCH_SIZE]

            nodata_frac = float(np.mean(np.all(img_p == 0, axis=0)))
            if nodata_frac > MAX_NODATA_FRACTION:
                continue

            for aug_idx, (img_a, msk_a) in enumerate(augmentations(img_p, msk_p)):
                fname = f"{aoi_name}_{date_tag}_p{patch_id:04d}_a{aug_idx}.npz"
                np.savez_compressed(TILES_DIR / fname, image=img_a.astype("float32"), mask=msk_a.astype("uint8"))
                records.append(fname)
            patch_id += 1

    print(f"{date_tag}: {patch_id} base patches -> {len(records)} tiles (with augmentation)")
    return records


def main():
    all_records = []
    for job in AOI_JOBS:
        for date_tag in job["dates"]:
            all_records.extend(tile_pair(job["name"], date_tag))

    rng = np.random.default_rng(42)
    rng.shuffle(all_records)
    n_val = max(1, int(len(all_records) * VAL_FRACTION))
    val_set = set(all_records[:n_val])

    manifest_path = DATA_PROCESSED / "manifest.csv"
    with open(manifest_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "split"])
        for fname in all_records:
            split = "val" if fname in val_set else "train"
            writer.writerow([fname, split])

    print(f"\nTotal tiles: {len(all_records)}  (train={len(all_records) - n_val}, val={n_val})")
    print(f"Manifest: {manifest_path}")
    if len(all_records) < 200:
        print("WARNING: small tile count for a placeholder AOI — expect this to grow a lot once "
              "you swap in the real watershed AOI (bigger area = more tiles) or add more scene dates.")


if __name__ == "__main__":
    main()
