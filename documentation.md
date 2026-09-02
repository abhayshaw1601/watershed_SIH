# PS-26015 — Watershed Geospatial Pipeline — Documentation

**Smart India Hackathon 2026, PS-26015**, sponsored by the **Ministry of Rural
Development**, Software track, "Disaster Management" theme.
Title: *Application of Geospatial Techniques for Visualization and Analysis to
Interpret Geo-Coded Images to Enhance Watershed Development Outcomes.*
Preferred technologies (per the official PS listing): AI/ML, geospatial
intelligence, predictive analytics, workflow automation, API-based
integration, mobile accessibility, secure cloud-native architecture.

---

## 1. The problem, in plain terms

India runs large watershed-development programs (check dams, percolation
tanks, afforestation, soil conservation) in drought-prone rural areas. Once
built, verifying whether they're working — is the land recovering, is a
structure still intact, is there illegal construction on protected land —
currently relies on manual field visits: slow, expensive, and doesn't scale
to thousands of sites.

## 2. What this project does

Uses free satellite imagery to automatically answer, for any watershed:
1. **What's on the ground right now** — a 7-class land-cover map (water,
   dense vegetation, agriculture, sparse vegetation, barren/degraded,
   built-up, fallow).
2. **What changed since a previous date** — new water body (positive), new
   construction (possible violation), vegetation/water loss (degradation),
   vegetation gain (improvement).
3. **What to do about it** — plain-language alerts/recommendations.

## 3. Architecture

```
Satellite Imagery (6-channel: R,G,B,NIR,NDVI,NDWI)
        |
        v
  Model 1: LULC U-Net  ---->  Land-cover class map (per date)
        |
        v
  Model 2: Siamese Change U-Net  (or Tier-1 rule-based fallback)
        |
        v
  Change type map
        |
        v
  Recommendation Engine (rule-based, NOT ML)
        |
        v
  Alerts + Recommendations + Health Score
```

**Deliberate design choice:** no ML model outputs "recommendations" directly.
No dataset for that exists, and a black-box "do X" output wouldn't be trusted
or adopted by a government official. Two focused, inspectable models feed
transparent if-then rules instead — every alert traces back to a specific,
auditable reason.

| Component | Predicts | ML? |
|---|---|---|
| Model 1 (U-Net, ResNet18 encoder) | Land-cover class per pixel, single date | Yes |
| Model 2 (Siamese U-Net) / Tier-1 fallback | Change type per pixel, between two dates | Yes / No (rule-based diff) |
| Recommendation Engine | Alerts + suggested actions | No — pure rule-based logic |

## 4. Data sources

| Data | Source | Coverage | Access |
|---|---|---|---|
| Satellite imagery | Sentinel-2 L2A, via Earth Search STAC API (AWS Open Data) | Global, free, ~5-day revisit | Automatic, no account needed |
| Training labels (in use) | ESA WorldCover 10m | Global, free | Automatic, no account needed |
| Training labels (future upgrade) | Bhuvan LULC (ISRO/NRSC), India-specific | India | **Needs personal registration** on bhuvan.nrsc.gov.in |
| Field validation (not yet built) | SRISHTI-DRISHTI geo-tagged photos | Project-specific | Needs hackathon-provided extract or manual collection |

Key point: satellite imagery + WorldCover labels are available for **any
coordinates on Earth's land surface, automatically** — switching the AOI is
a config change, not a data-sourcing effort. Bhuvan is the one source that
needs the user's manual registration.

## 5. Area of Interest (AOI) history

- **v1 — Hiware Bazar** (Ahilyanagar dist., Maharashtra): initial placeholder,
  chosen for its watershed-development reputation. **Rejected** after a
  ground-truth class-distribution check showed **0% water pixels** in this
  specific box — the model could structurally never learn the water class.
- **v2 — Kadwanchi watershed** (Jalna dist., Maharashtra), 6km×6km box: a
  real, documented Indo-German Watershed Development Programme site
  (1997-2002, 1888 ha) with published impact-evaluation literature and real
  check dams/percolation tank. Verified class distribution before adopting:
  water 0.35%, built-up 2.21%, tree cover 1.69%, bare/sparse veg 0.35% — all
  7 target classes present, unlike v1.
- **v2.1 — Kadwanchi, enlarged to 9km×9km (current default)**: a live Colab
  training run on v2 showed the model predicting **zero water pixels**
  anywhere (confusion matrix: water precision/recall/IoU all 0.000, despite
  0.35% ground-truth presence — too few examples to learn from). The
  rendered interactive map showed a real, visible reservoir just outside
  the 6km box's edge. Verified that enlarging to 9km×9km (same center, so
  the original documented site stays covered) captures much more of it:
  ground-truth water coverage 0.34% → **2.79%**, tree cover roughly
  unchanged (1.69% → 1.25%). Not yet retrained/re-evaluated on this
  enlarged box — that's the next run.
- **v3 — multi-AOI training pool (current)**: Kadwanchi remains the
  **primary** AOI (T1+T2, drives the demo/change-detection/health-score
  story). Two **auxiliary, training-only** AOIs (single date, no
  change-detection pair) were added after a live run showed dense
  vegetation and barren land still near-total failures (IoU 0.004 and
  0.000). Both verified via the same ground-truth class check before
  adding:
  - **Tamhini Ghat**, Western Ghats, Pune dist., Maharashtra (18.449°N,
    73.423°E) — 63.1% tree cover.
  - **Donimalai iron-ore mine**, Sandur, Ballari dist., Karnataka
    (15.059°N, 76.594°E) — 4.5% bare/sparse vegetation. (Two dead ends
    first: Anantapur city was too urban at 1.37% bare, and several
    blind-guessed points along the Chambal ravine belt kept landing on
    plain cropland instead of the actual dissected terrain — WorldCover's
    "bare" class needs genuinely exposed ground, e.g. a mine, not just
    "degraded-looking" farmland.)

  Config (`AUX_AOIS`, `AOI_JOBS` in `config.py`) generalizes every pipeline
  stage (`data_download.py`, `preprocessing.py`, `tiling.py`) to loop over a
  list of AOI jobs instead of one global AOI; each has been individually
  tested against real downloaded data before being ported into the
  notebook generator. Model 2 and the demo/inference stages still use only
  the primary AOI (`AOI_NAME`), unaffected by the pool.

AOI is set in `project/src/config.py` (`AOI_NAME`, `AOI_CENTER_LAT/LON`,
`AOI_BBOX`, `WORLDCOVER_TILE`) and mirrored in the Colab notebook's Config
cell (`project/notebooks/build_notebook.py`).

## 6. Pipeline stages

1. **Data download** (`data_download.py`) — searches Earth Search STAC for
   two low-cloud Sentinel-2 scenes (an older T1, a recent T2) over the AOI;
   clips R/G/B/NIR bands directly from cloud storage (no bulk download);
   downloads the matching ESA WorldCover tile, clipped to AOI.
2. **Preprocessing** (`preprocessing.py`) — computes NDVI/NDWI, builds the
   6-channel stack; reprojects WorldCover onto the imagery's exact grid;
   remaps ~11 WorldCover classes to the 7-class scheme.
3. **Tiling** (`tiling.py`) — cuts into 128×128 patches (32px overlap),
   drops mostly-nodata patches, applies 8x dihedral augmentation
   (flips/rotations), writes a train/val manifest.
4. **Model 1 training** (`model1_unet.py`) — U-Net, ResNet18 encoder
   (ImageNet-pretrained), 6-channel in / 7-class out. Encoder frozen for the
   first 5 epochs, then fine-tuned. Dice + CrossEntropy loss, Adam
   (lr=1e-4), mixed precision.
5. **Evaluation** (`evaluate.py`) — confusion matrix, per-class
   precision/recall/IoU/F1, overall pixel accuracy, mean IoU, confusion
   matrix heatmap PNG. Classes absent from the val set are reported as "no
   ground truth" rather than a misleading 0.0.
6. **Tier-1 change detection** (`tier1_fallback.py`) — direct rule-based
   diff of two Model-1 class maps (no training needed); connected-blob noise
   filter (drops regions <~100 m²); optional geofencing against a watershed
   boundary (hook exists, unused until a real boundary polygon is supplied).
7. **Model 2 training** (`model2_change.py`) — Siamese U-Net, shared
   encoder warm-started from Model 1, `|difference|` of T1/T2 encoder
   features feeds a decoder to a 5-class change map. Fine-tuned on
   **self-generated weak labels** (Tier-1's own diff output) — no manual
   change annotation needed.
8. **Recommendation engine** (`recommendation_engine.py`) — health score
   (weighted average of per-class "goodness," 0-100), NDVI trend, and
   rule-based alerts (unauthorized construction, degradation needing
   intervention, verified new structures, declining health over
   consecutive periods).
9. **Inference / demo** (`inference_demo.py`, and the notebook's final
   sections) — runs Model 1 on full T1/T2 rasters, produces the change map,
   health score, alerts, a static comparison figure, and an interactive
   Folium map.

## 7. Where it runs

- **Colab notebook** (`project/notebooks/watershed_pipeline.ipynb`) — the
  primary, currently-working execution environment. Free T4 GPU (16GB VRAM,
  vs. the local machine's 4GB RTX 2050), all packages preinstalled or
  one-line-installed, no local setup friction. Persists data/checkpoints/
  outputs to Google Drive (`MyDrive/watershed_ps26015/`) so they survive
  session resets.
  - **Generated, not hand-written**: the notebook is built by
    `project/notebooks/build_notebook.py` — a Python script that assembles
    cells as data and writes the `.ipynb`. Edit the generator, then re-run
    it, never hand-edit the `.ipynb` directly (see CLAUDE.md).
  - Includes a **"Live demo — fast path"** final section: a single
    self-contained cell that skips training, loads the already-trained
    checkpoint, and produces the full result in seconds — this is the cell
    to actually run in front of judges, not the training cells.
- **Local** (`project/src/*.py`, `project/.venv`) — a full local
  virtualenv with torch (CUDA), segmentation-models-pytorch, rasterio,
  geopandas, streamlit, etc. Used for fast unit/smoke-testing of logic
  before trusting it in Colab (see CLAUDE.md), and can run the full
  pipeline standalone if preferred over Colab.
- **Streamlit app** (`project/app/streamlit_app.py`, styled by
  `project/app/design.py`) — a local web UI wrapping the trained model:
  Land Cover, Change, Health & Alerts, Map, Explore a Location, and About
  tabs. Currently local-only, not deployed. Reads model/data from the same
  local paths the scripts use, or accepts them via sidebar upload.
  Branded "Watershed Signal."

  **Design system, v2 (current)**: a white, "official government report"
  aesthetic, per explicit direction — navy institutional identity color,
  Source Serif 4 display type for gazette-like gravitas + IBM Plex
  Sans/Mono, a letterhead masthead (navy top rule + institutional eyebrow
  line), and a health-score gauge re-skinned as a flat "seal" (double ring,
  no glow). Light CartoDB Positron basemap. Superseded a v1 dark
  "instrument panel" theme (warm near-black, Space Grotesk, glowing gauge)
  built first and then explicitly rejected in favor of v2 — kept in git
  history / this note as the record of that decision, not in the code.
  All custom HTML/SVG in `design.py` is unit-tested in isolation.

  **Real bugs caught and fixed** (both via user screenshots, neither by my
  own tests — worth remembering that some classes of bug only show up in
  an actual rendered page):
  1. The first version injected CSS via `st.markdown(css,
     unsafe_allow_html=True)`, which runs content through a CommonMark
     parser before allowing raw HTML — a blank line inside the CSS
     terminated "raw HTML block" recognition partway through, leaking the
     rest of the stylesheet as visible escaped text on the page. Fixed by
     switching every raw-HTML render call to `st.html()` (Streamlit ≥1.39),
     which bypasses markdown parsing entirely.
  2. The (now-removed) two-file T1/T2 upload flow called `st.rerun()`
     immediately after saving the first file — since Streamlit doesn't
     clear an uploaded file from its widget automatically, this restarted
     the script before the second file was ever checked, and the first
     file's still-attached state kept re-triggering the same early rerun
     forever, starving the second upload from ever completing. Moot now
     that the picker fetches imagery live instead of requiring upload, but
     worth remembering the pattern: check/save all of a batch of inputs in
     one pass, then rerun once at the end — never rerun mid-batch.

- **Unified location picker** (`project/app/aoi_picker.py`) — v2 of the
  location feature, after user feedback that a separate "Explore" tab
  (v1) undersold it: instead of a bolted-on gadget tab, ONE picker (3
  trained-site presets — Kadwanchi, Tamhini Ghat, Donimalai — or
  search/enter any coordinates) now drives **every** main tab (Land Cover,
  Change, Health & Alerts, Map) via `st.session_state["active_aoi"]`.
  Presets and custom searches share the exact same live-fetch pipeline
  (`run_pipeline`: search_scene → clip_scene_to_stack → build_6channel_stack
  → predict_class_map → Tier-1 diff), the only difference being presets are
  known-trained coordinates. The header shows a **"TRAINED SITE"** badge
  for presets vs **"LIVE · UNSEEN LOCATION"** for anything else — preserves
  the credibility distinction (a trained/validated result vs. best-effort
  inference on unseen terrain) via a label instead of separate UI, which
  turned out to be the better call than segregating them entirely.

  This also simplified model intake: since every AOI (including the
  default) is now fetched live rather than requiring pre-uploaded T1/T2
  stack files, the sidebar only needs the trained checkpoint uploaded —
  removing the two-file upload flow entirely (and the class of bug that
  came with it, below).

  Verified end-to-end with the **real trained checkpoint** (not a
  mechanics-only stand-in): loaded it (epoch 23, val_loss 0.837, matching
  the actual Colab run), ran the exact startup flow (load model → live-fetch
  the primary preset), got a real health score (65.6) and real alerts
  (unauthorized-construction, new-water-body) against live Sentinel-2 data.
  Also confirmed the picker's presets and bbox math directly, and (from the
  earlier v1 build) geocoded "Ralegan Siddhi, Maharashtra" correctly
  (18.913°N, 74.410°E — found organically via the geocoder, not hand-picked,
  and itself another well-known watershed site).

## 8. Known bugs hit and fixed (Colab library-version issues)

All were library-API mismatches between what the code assumed and what the
installed `segmentation-models-pytorch` version actually does — not logic
bugs. Fixed in `src/*.py` and the notebook generator, then verified:

1. `smp.losses.SoftCrossEntropyLoss()` defaults `smooth_factor=None`, and
   this version divides by it unconditionally → `torch.nn.CrossEntropyLoss()`
   used instead.
2. `torch.cuda.amp.GradScaler(...)` deprecated → `torch.amp.GradScaler('cuda', ...)`.
3. `nn.Module.load_state_dict(..., strict=False)` normally returns
   `(missing, unexpected)`; this version's encoder override returns `None`
   → made the unpack conditional.
4. `UnetDecoder.forward()` in this version takes the feature list as a
   single positional argument, not unpacked (`*features`) → changed
   `self.decoder(*diff_feats)` to `self.decoder(diff_feats)`.

## 9. Known limitations (current state, be honest about these)

- **Resolved as of the v3 multi-AOI pool**: Model 1 now scores IoU > 0.46
  on all 7 classes (mean IoU 65.9%, pixel accuracy 81.2% — see section 5).
  Previously dense vegetation and barren land were near-total failures
  (IoU 0.004 / 0.000); pooling in Tamhini Ghat and Donimalai fixed both
  without regressing the other classes. The earlier "small, imbalanced
  training set" limitation no longer applies at face value — still worth
  re-checking if the AOI changes again.
- **"Vegetation gain" change-map numbers from *before* the v3 retrain**
  were likely inflated by classifier noise (agriculture ↔ sparse-vegetation
  confusion) — not yet re-validated against the current, much stronger
  Model 1. Re-run the Tier-1/health-score numbers before quoting them.
- **No real Bhuvan labels yet** — training on the free ESA WorldCover
  backup, not the India-specific primary source the original plan calls
  for.
- **No geo-coded photo validation** — the PS's literal title is about
  interpreting geo-coded images, and this is not yet built at all. Needs
  real geo-tagged field photos (even ~10-20) to close.
- **Not deployed** — Streamlit app is local-only; no public URL yet.

## 10. Roadmap / open decisions

- Multi-AOI training pool — **done** (see section 5, v3). Not yet retrained
  in Colab on the pooled set; next actual run should show whether dense
  vegetation/barren improve the way water did after the AOI enlargement.
- Add a "pick a location" live flow to the app: user selects/searches an
  AOI, app fetches fresh imagery and runs inference on demand. Data-fetch
  side already supports any coordinates; needs a UI hook.
- Cloud deployment: training stays on Colab (GPU-heavy, occasional);
  proposed to wrap inference in a FastAPI backend, containerize, deploy to
  a serverless platform (Google Cloud Run recommended — free tier, scales
  to zero, matches the PS's own "cloud-native"/"API-based" preferred-tech
  wording). Not started; needs the user's cloud account.
- Real Bhuvan LULC labels once registered.
- Geo-coded photo validation step (model_plan.md section 2.8).
- Watershed boundary polygon for real geofencing (hook already exists in
  `tier1_fallback.py`).
- SIH presentation/pitch materials — not started.

## 11. Source-document context

Three original planning documents (in the repo root, not modified by this
work): `model_plan.md` (the technical architecture this pipeline
implements), `dataset.md` (where to source imagery/labels), and `26015.pdf`
(the official PS text). `needed_inputs.md` tracks what's needed from the
user, ranked by impact, to move from "functional" to "hackathon-winnable."
