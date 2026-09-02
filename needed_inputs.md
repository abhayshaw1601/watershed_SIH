# What's needed to make PS-26015 functional and hackathon-winnable

Status: pipeline code (Colab notebook + Streamlit app) is written but not yet run on
real data. This doc tracks what's needed from you, ranked by impact, to get from
"code exists" to "working, judge-ready demo."

---

## Tier 1 — makes it run at all

- [ ] **Run `project/notebooks/watershed_pipeline.ipynb` in Colab** (Runtime → T4 GPU →
      Run all). Nothing downstream exists until this executes at least once.
- [ ] **Send back the output** — success, or a pasted error. Fixes happen against real
      output, not guesses.
- [ ] **Get the trained checkpoint + processed rasters back into the app**, either:
  - copy `model1_lulc_unet.pt` and the two `*_stack6.tif` files from
    `MyDrive/watershed_ps26015/` into local `project/models/` and
    `project/data/processed/`, or
  - upload them directly via the Streamlit app's sidebar
  - *(alternative: I can instead run the Streamlit app inside Colab itself, tunneled
    out via ngrok/localtunnel, so training and demo live in one place — say if you'd
    rather do that)*

## Tier 2 — makes it real, not a placeholder demo

- [ ] **Your actual target watershed** — name, coordinates, or a shapefile/boundary.
      Everything currently runs against a placeholder AOI (Hiware Bazar, Ahilyanagar
      district, Maharashtra) that I picked myself just to have something concrete to
      build against.
- [ ] **Check the hackathon's resource page / Discord / mail thread** for a
      pre-selected AOI or SRISHTI-DRISHTI data extract. PS-sponsored hackathons often
      bundle this — it's both faster than the Bhuvan registration route and more
      "on-brief" than anything I can source myself.

## Tier 3 — makes it credible

- [ ] **Bhuvan LULC labels**, once registration on bhuvan.nrsc.gov.in goes through.
      The pipeline currently trains on ESA WorldCover only (free, no-registration
      backup) — swapping to Bhuvan is the difference between "generic global
      dataset" and "India-specific, PS-aligned dataset" to a judge.
- [ ] **A watershed boundary polygon** (shapefile/GeoJSON), if you have one. The
      Tier-1 change detection already has a geofencing hook (`watershed_mask`
      parameter) built in but unused (currently `None`) — real boundary data lets
      alerts say "inside/outside the watershed."

## Tier 4 — closes the actual gap in the plan

- [ ] **A handful of real geo-tagged field photos (SRISHTI-DRISHTI/Drishti-style) for
      your AOI — even 10-20.** This is the important one: **nothing built so far
      touches geo-coded photos at all.** The PS's literal title is *"...to interpret
      Geo-Coded Images..."* — that's the core ask, not a bonus feature. The current
      pipeline is satellite-imagery-only. With even a small batch of geo-tagged
      photos, I can build the spatial-join validation step already scoped in
      `model_plan.md` section 2.8 — cross-checking Model 1's predicted land-cover
      class against a real photo at that exact point. This single feature closes the
      biggest gap between what's built and what's actually asked for.
- [ ] **Known project locations** (IWMP/WDC-PMKSY project boundaries), if accessible
      — lets the recommendation engine distinguish "VERIFIED: matches a known
      project" from "ALERT: unverified," instead of flagging everything as
      unverified by default.

## Tier 5 — presentation/logistics context

- [ ] **Hackathon deliverable format and deadline** — live demo? slide deck + video?
      GitHub submission? Changes what's worth polishing (UI vs. a report generator
      vs. a pitch narrative).
- [ ] **Judging criteria**, if published — tells me whether to lean into technical
      depth, visual polish, or impact storytelling.
- [ ] **What teammates are already building** — if someone else owns GIS,
      frontend polish, or the presentation, work shouldn't be duplicated.

---

## If you only do two things right now

1. **Run the notebook** (Tier 1) — turns unrun code into an actual working demo on
   *some* real data.
2. **Tell me the real AOI** (Tier 2) — turns "some real data" into "your real data."

Everything in Tier 3-4 is what separates a working demo from a winning one.
