# Working rules for this project (PS-26015 / SIH 2026 watershed pipeline)

This file is project-specific instructions, auto-loaded at the start of every
session in this directory. It states how work on this project should be
done, based on what's already been established. See `documentation.md` for
what the project *is*; this file is about *how to work on it*.

## The core commitment

Every claim made about this project — "this works," "this is fixed," "this
is trained" — must be backed by something actually run and checked, not by
reasoning about what should happen. When that's not possible (e.g. can't
execute the Colab notebook directly), say so explicitly and say what was
verified instead (syntax, imports, isolated logic with synthetic data).
"Should work" and "verified working" are different claims — never blur them
together when reporting status.

## Concrete practices to follow

1. **Test locally before trusting Colab.** A local venv exists at
   `project/.venv` with torch (CUDA), segmentation-models-pytorch, rasterio,
   geopandas, streamlit, scipy, etc. — use it. Before telling the user a fix
   should work in their live Colab session, reproduce the failure mode
   locally if at all possible (unit test with synthetic/hand-checked data,
   an isolated forward+backward pass, an import check) rather than only
   reasoning about the library source. Several real bugs in this project
   were library-version mismatches invisible from just reading the code —
   they only surfaced by running it.

2. **The notebook is generated, never hand-edited.**
   `project/notebooks/watershed_pipeline.ipynb` is built by
   `project/notebooks/build_notebook.py`. Every change to notebook content
   goes into the generator, which is then re-run to produce the `.ipynb`,
   which is then validated (`ast.parse` on every code cell's source, plus a
   targeted string-check for whatever changed) before telling the user it's
   ready. Editing the `.ipynb` JSON directly causes drift between it and the
   generator — don't do it.

3. **Keep `src/*.py` and the notebook's embedded copies in sync.** The same
   logic (Model 1, Model 2, Tier-1 fallback, recommendation engine,
   evaluation) exists in both the standalone local scripts and inline in the
   notebook cells (Colab can't `import` local project files). When a bug is
   found in one, fix both, and note it in `documentation.md` section 8 if
   it's a real library/API mismatch worth remembering.

4. **Verify facts before recommending them.** Don't guess coordinates,
   dataset tile IDs, class distributions, or real-world site facts (e.g.
   "this watershed has a reservoir"). Check them — a quick download/clip and
   a class histogram, a web search for a citable source, a curl HTTP check —
   before presenting them as a recommendation. The Hiware Bazar → Kadwanchi
   AOI switch happened specifically because a verification step (checking
   ground-truth class balance) caught a structural problem that would
   otherwise have been invisible until a wasted training run.

5. **State data/quality limitations plainly, don't oversell.** Small AOI,
   class imbalance, WorldCover-not-Bhuvan labels, noisy change-map numbers —
   these are real, current limitations (tracked in `documentation.md`
   section 9). When reporting a result, say what's genuinely demonstrated
   ("the pipeline runs end-to-end") separately from what's not yet reliable
   ("these specific hectare numbers"). A working demo and a validated
   scientific result are different claims.

6. **Separate what needs the user's action from what doesn't, explicitly.**
   Account-gated steps (Bhuvan registration, Google Cloud account, running
   the actual Colab notebook) cannot be done from here — say so plainly
   rather than implying progress that didn't happen. Anything not
   account-gated (writing code, testing logic locally, verifying facts,
   researching real-world site data) should just get done, not asked about.

7. **Keep `needed_inputs.md` and `documentation.md` current.** When a Tier-1
   input from `needed_inputs.md` gets resolved (e.g. AOI decided), or the
   project's status changes materially, update the relevant doc rather than
   letting it go stale.

8. **Zero emojis in the web frontend — ever.** The entire `web/src/` tree must
   have zero Unicode emoji characters. All icons use `@phosphor-icons/react`
   SVG only. This is enforced by a Node.js regex scan before every build.
   Never add emoji to TSX/TS files even as a quick label — use an icon or a
   typographic tag instead.

9. **Field ground truth requires physical photo evidence.** The Field Investigation
   tab (`FieldTab.tsx`) tracks `hasPhoto: boolean` per station. It is forbidden
   to display "AI Matches Ground (Confirmed)" or allow the "Confirmed Match"
   verdict button to be clicked without an attached field photo. When a photo
   is absent, the UI must display two explicit tags:
   - **Why Verification is Needed** — citing the specific optical satellite
     limitation (e.g. 10m pixel averaging, shadow masking, spectral confusion).
   - **What On-Ground Inspection Will Uncover** — citing the concrete physical
     measurement the surveyor should record (staff gauge, caliper, penetrometer).
   Do not soften this to a mere "unverified" badge — the distinction matters
   for scientific and government credibility.

10. **AOI-coordinate safety for all tab structures.** Whenever a tab generates
    coordinates for structures (check dams, ground stations, interventions)
    relative to the active AOI bounding box, use the `clampToAoi()` function
    (or equivalent clamping logic) to guarantee every coordinate falls strictly
    inside `[south + 15% * latSpan, north - 15% * latSpan]` and
    `[west + 15% * lonSpan, east - 15% * lonSpan]`. Never generate unclamped
    offsets from the AOI center — even small multiplier drift can push points
    outside the bounding box for narrow watersheds.

11. **Do not edit `todo.md`.** The `todo.md` file is managed manually by the
    user and documents their own task planning. Do not modify it, even to mark
    items as done — unless the user explicitly asks.
