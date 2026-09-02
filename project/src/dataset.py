"""PyTorch Dataset over the tiled .npz patches from tiling.py."""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import torch
from torch.utils.data import Dataset

from config import DATA_PROCESSED

TILES_DIR = DATA_PROCESSED / "tiles"


class WatershedTileDataset(Dataset):
    def __init__(self, split="train", manifest_path=None):
        manifest_path = manifest_path or (DATA_PROCESSED / "manifest.csv")
        with open(manifest_path) as f:
            rows = list(csv.DictReader(f))
        self.files = [r["filename"] for r in rows if r["split"] == split]
        if not self.files:
            raise RuntimeError(
                f"No '{split}' tiles found in {manifest_path}. Run data_download.py, "
                "preprocessing.py, and tiling.py first."
            )

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        npz = np.load(TILES_DIR / self.files[idx])
        image = torch.from_numpy(npz["image"])          # (6, H, W) float32
        mask = torch.from_numpy(npz["mask"]).long()      # (H, W) uint8 -> long
        return image, mask
