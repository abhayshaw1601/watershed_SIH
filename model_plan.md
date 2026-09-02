# Model Plan — PS26015
## Application of Geospatial Techniques for Watershed Development Outcomes

**Hardware target:** RTX 3050 (laptop, ~4GB VRAM), i5-12450HX, 16GB RAM

---

## 1. Architecture Overview

Two trained models + one rule-based logic layer. No ML model predicts "recommendations" directly — that's deliberate (no dataset exists for it, and it would be unexplainable to judges).

```mermaid
flowchart LR
    A[Satellite Imagery<br/>6-channel stack] --> B[Model 1: LULC U-Net]
    B --> C[Land cover class map<br/>per date]
    C --> D[Model 2: Change Detection<br/>Siamese U-Net]
    D --> E[Change type map]
    C --> F[Recommendation Engine<br/>rule-based, no ML]
    E --> F
    F --> G[Alerts + Recommendations<br/>+ Health Score]
```

| Component | Predicts | ML? |
|---|---|---|
| **Model 1** | Land-cover class per pixel (single date) | Yes — trained |
| **Model 2** | Change type per pixel (between two dates) | Yes — trained |
| **Recommendation Engine** | Alerts + suggested actions | No — rule-based logic on top of Models 1 & 2 |

---

## 2. Model 1 — LULC Segmentation (U-Net)

### 2.1 What it predicts
Per-pixel land-cover class, on a single satellite image date. This is the core output the PS asks for (thematic maps, watershed characterization, visualization).

### 2.2 Architecture

```python
import segmentation_models_pytorch as smp

model = smp.Unet(
    encoder_name="resnet18",        # try first; fall back to "mobilenet_v2" if VRAM-tight
    encoder_weights="imagenet",     # transfer learning
    in_channels=6,                  # R, G, B, NIR, NDVI, NDWI
    classes=7,
)
```

### 2.3 Labels (7 classes)

| ID | Class |
|---|---|
| 0 | Water body / conservation structure |
| 1 | Dense vegetation / forest |
| 2 | Agriculture / cropland |
| 3 | Sparse vegetation / grassland |
| 4 | Barren / degraded land |
| 5 | Built-up / settlement |
| 6 | Fallow / bare agricultural land |

### 2.4 Datasets

**Primary source — Bhuvan LULC (NRSC/ISRO), India-specific:**

| Item | Detail |
|---|---|
| Portal | https://bhuvan.nrsc.gov.in/gis/thematic/index.php# |
| Scales available | 1:50,000 (2005-06, 2011-12, 2015-16), 1:250,000 (annual from 2005-06), 1:10,000 (SIS-DP) |
| Access | WMS export (fast, no registration) OR vector shapefile request (precise, needs free registration; institutional MoU sometimes needed for 250K series — **start this request on Day 1**, it's the only external-wait step) |
| Bonus layer | Land Degradation Atlas (1:50,000) — pre-made degraded-land mask, strengthens class 4 |

**Backup/supplement — if Bhuvan coverage of your area is too sparse after tiling:**

| Dataset | Link |
|---|---|
| DeepGlobe (Kaggle mirror, no queue) | https://www.kaggle.com/datasets/balraj98/deepglobe-land-cover-classification-dataset |
| ESA WorldCover | https://esa-worldcover.org/en (also on AWS S3: `s3://esa-worldcover/`) |
| Google Dynamic World (via Earth Engine, zero download) | https://dynamicworld.app/ |

### 2.5 Turning Bhuvan's map into a training dataset (it is NOT a ready image+mask folder)

**Step-by-step:**
1. Get satellite imagery for your area (Sentinel-2/Bhoonidhi), already clipped to your AOI
2. Get Bhuvan LULC via WMS export (fast) or shapefile (precise, requested in parallel)
3. Reproject the LULC layer to match your imagery's CRS
4. Remap Bhuvan's ~20-25 detailed classes into your 7-class scheme (table below)
5. **Rasterize** the vector polygons into a pixel-aligned mask matching your imagery grid
6. **Tile** the large image+mask pair into small patches (128×128) with overlap
7. **Augment** (flip/rotate) to multiply sample count — a single watershed/district gives limited tiles, so augmentation matters

```python
import rasterio
from rasterio.features import rasterize
import geopandas as gpd

with rasterio.open("watershed_sentinel2_stack.tif") as src:
    transform, out_shape, crs = src.transform, (src.height, src.width), src.crs

lulc = gpd.read_file("bhuvan_lulc_shapefile.shp").to_crs(crs)
lulc["my_class"] = lulc["lulc_code"].map(class_lookup_table)

mask = rasterize(
    [(geom, val) for geom, val in zip(lulc.geometry, lulc.my_class)],
    out_shape=out_shape, transform=transform, fill=6, dtype="uint8"
)
# satellite_image.tif + mask = one real training pair
```

### 2.6 Class remapping table (Bhuvan → your 7 classes)

| Bhuvan LULC (examples) | Your class |
|---|---|
| Waterbodies, Reservoir, Canal, River | 0 — Water body |
| Evergreen/Deciduous Forest, Forest Plantation | 1 — Dense vegetation |
| Kharif/Rabi/Double Crop | 2 — Agriculture |
| Scrub Forest, Grassland, Degraded Pasture | 3 — Sparse vegetation |
| Barren Rocky, Land with Scrub, Gullied Land | 4 — Barren/degraded |
| Built-up (Urban/Rural) | 5 — Built-up |
| Fallow Land (Current/Other) | 6 — Fallow |

### 2.7 Training recipe (tuned for RTX 3050, 4GB VRAM)

| Setting | Value | Why |
|---|---|---|
| Patch size | 128×128 (try 256×256 only if it fits) | Keeps VRAM low |
| Batch size | 8–16 | Reduce if CUDA OOM |
| Mixed precision (`torch.cuda.amp`) | On | ~Halves VRAM use |
| Loss | Dice Loss + CrossEntropy (combined) | Handles class imbalance (water/built-up are small classes) |
| Optimizer | Adam, lr=1e-4 | Stable default |
| Epochs | 20–30 | Pretrained encoder converges fast |
| Encoder | Freeze first 5 epochs, then unfreeze | Faster early convergence |

```python
loss_fn = smp.losses.DiceLoss(mode='multiclass') + smp.losses.SoftCrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
scaler = torch.cuda.amp.GradScaler()
```

### 2.8 Validation
Cross-check predictions against your own geo-tagged (Drishti-style) field photos at known points — spatial join between photo location and predicted class.

---

## 3. Model 2 — Change Detection (Siamese U-Net)

### 3.1 What it predicts
Per-pixel change type between two dates of the same watershed — this directly powers the early-warning/alert feature.

### 3.2 Architecture

```
Image_T1 (6-channel) ──► Shared Encoder ──┐
                                            ├──► |difference| ──► Decoder ──► Change class per pixel
Image_T2 (6-channel) ──► Shared Encoder ──┘
```
Reuse Model 1's trained encoder weights to save training time — both models see the same kind of imagery.

### 3.3 Labels (5 change classes)

| ID | Meaning | Action |
|---|---|---|
| 0 | No change | — |
| 1 | New water/conservation structure appeared | Log as verified intervention (positive) |
| 2 | New construction/built-up appeared | **Alert** — possible unauthorized construction |
| 3 | Vegetation/water loss → degradation | **Alert** — recommend intervention |
| 4 | Vegetation gain | Log as improvement (positive) |

### 3.4 Datasets

| Stage | Dataset | Purpose |
|---|---|---|
| Pretrain | LEVIR-CD — https://justchenhao.github.io/LEVIR/ | Learn general "new building" patterns |
| Pretrain (closer fit) | S2Looking — https://github.com/S2Looking/Dataset | Rural-area building change, closer to Indian village context than LEVIR-CD's urban focus |
| Fine-tune | **Self-generated weak labels**: run Model 1 on two dates of your own watershed, auto-derive change labels from class transitions | Adapts to your specific terrain, no manual labeling needed |
| Validate | Geo-tagged field photos + manual visual check | Confirm real alerts, filter noise |

### 3.5 Fallback (Tier 1) — if training time runs out

Rule-based diff using two independent Model 1 outputs — no separate model needed:

```
IF class_T1 ∈ {barren, vegetation, agriculture} AND class_T2 == water_body:
    → "New water structure detected" (log, positive)
IF class_T1 ∈ {barren, vegetation, agriculture, water} AND class_T2 == built-up:
    → "Possible unauthorized construction" ALERT
IF class_T1 ∈ {dense vegetation, water} AND class_T2 == barren:
    → "Land degradation" ALERT
```
Group flagged pixels into connected regions, drop blobs <100 m² (noise filter), geofence-check against watershed boundary before alerting.

**Recommended plan:** build Tier 1 (fallback) first since it's guaranteed and reuses Model 1 — only build the full Siamese Model 2 if Day 2 goes well. Present Model 2 as roadmap if not completed live.

---

## 4. Recommendation Engine (rule-based, not a model)

Takes Model 1's class map + Model 2's (or Tier 1's) change map + the health score, applies rules:

```
IF change_label == 2 (new construction) AND inside watershed boundary:
    → "ALERT: Possible unauthorized construction — recommend field verification"

IF change_label == 3 (degradation) AND NDVI_trend declining > threshold:
    → "RECOMMEND: Soil/water conservation structure needed in this zone"

IF change_label == 1 (new water structure) AND geofence-matched to known project:
    → "VERIFIED: New conservation structure confirmed — update project records"

IF health_score < 40 for 2+ consecutive periods:
    → "RECOMMEND: Priority intervention — watershed health declining"
```

No training data needed — pure business logic, fully explainable to judges.

---

## 5. Why not one joint model (semantic change detection)?

Considered and rejected for this timeline:
- Needs a rarer dataset type (paired T1+T2 class labels *and* change labels — e.g. SECOND/HRSCD, niche, not India-specific)
- Two decoder heads = two losses to balance = harder to debug in 3 days
- Worse failure mode: if it doesn't converge, you lose both capabilities at once, right before demo

**Mention in presentation as production roadmap** (e.g. Bi-SRNet-style joint architecture) — signals technical depth without the risk.

---

## 6. Summary Table

| Model | Input | Output | Labels | Primary Dataset |
|---|---|---|---|---|
| Model 1: LULC U-Net | 6-channel single-date stack | 7-class land cover map | 7 classes (table 2.3) | Bhuvan LULC (primary), DeepGlobe/WorldCover (backup) |
| Model 2: Change Siamese U-Net | Two 6-channel stacks (T1, T2) | 5-class change map | 5 classes (table 3.3) | LEVIR-CD/S2Looking (pretrain) + self-generated weak labels (fine-tune) |
| Recommendation Engine | Outputs of Model 1 + Model 2 + health score | Alerts + suggested actions | — (rule-based) | — |
