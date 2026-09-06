# Watershed Signal — Web GIS Frontend

A high-performance, modern Next.js Web GIS application for **Smart India Hackathon 2026 — PS-26015** (Ministry of Rural Development).

---

## Tab Architecture (7 Tabs)

| Tab | Key | Description |
|---|---|---|
| Land Cover | `land-cover` | Interactive split-slider comparing T1 baseline vs. T2 raster, per-class hectare breakdown |
| Change | `change` | Structural change detection with informational banner explaining seasonal crop filtering |
| Health & Alerts | `health` | 4 sub-index diagnostic cards (Water Storage, Canopy & Biomass, Soil Stability, 5-Yr Resilience) + alerts + formula accordion + banner link to Simulator |
| Map | `map` | Leaflet/MapLibre dynamic layer with Copernicus DEM catchment overlay |
| Field Investigation | `field` | Ground truth verification with photo availability tracking — stations marked "Photo Attached" vs. "Awaiting Ground Photo"; missing-photo stations show *Why Needed* and *What Will Uncover* tags; "Simulate Surveyor Photo" demo mode |
| Investigation | `investigation` | Catchment diagnostic analysis: *What is Changed / Affected* pillars + *Recommended Engineering Changes* with AOI-clamped structure coordinates (zero "OUTSIDE AOI" errors) |
| What-If Simulator | `simulator` | Dedicated standalone policy simulator with 4 sliders, 1-click strategy presets, live recharge/soil/water-table projections, land cover transition matrix, and ROI table |

**Zero emojis rule**: all icons are `@phosphor-icons/react` SVG only — enforced in CI.

---

## Key Features

1. **Interactive WebGL Telemetry Globe**: 3D earth globe with Cartosat-3 and Resourcesat-2A orbital simulations, typewriter narrative.

2. **Dynamic Investigation Tab** (`InterventionsTab.tsx`):
   - **"What is Changed / Affected" Diagnostic Pillars**: Water Storage & Runoff acceleration, Topsoil Erosion Corridors, Biomass & Canopy Trend.
   - **"Recommended Engineering Changes"**: Civil interventions mapped to each problem, with Sentinel-2 multi-spectral reflectance checks.
   - **AOI-Safe Coordinates**: All structure coordinates clamped via `clampToAoi()` — no coordinates ever land outside the active watershed bounding box.

3. **Field Investigation Photo Integrity** (`FieldTab.tsx`):
   - Each of the 5 pre-loaded stations carries a `hasPhoto: boolean` flag.
   - Stations without photos show `Awaiting Ground Photo` badge, tagged with optical satellite limitations and physical measurement protocol.
   - "Confirmed Match" verdict button is disabled until a field photo is attached or simulated — prevents false AI-matches-ground claims without evidence.

4. **Dedicated What-If Simulator** (`SimulatorTab.tsx`):
   - 4 policy levers: Check Dams, Ridge Afforestation, Contour Bunding, Farm Ponds.
   - 1-click strategy presets: Max Recharge, Erosion Defense, Balanced IWDP, Reset.
   - Live metric recalculation: Health Score delta, Annual Recharge (ML), Soil Conserved (t/yr), Water Table Rise (m), Drought Risk Buffer.
   - Land Cover Transition Matrix and Capital Outlay ROI projection.

5. **Live Satellite Pipeline Bridge**: Sentinel-2 STAC → PyTorch U-Net inference → DEM catchment delineation, with animated radar scanner and 4-stage GPU progress tracker.

---

## Getting Started

### 1. Prerequisites — Python API
```bash
# In project/ directory
uv run python app/api_server.py
```
If the API is offline, the frontend auto-falls back to precomputed static demo data (`/public/demo-data/`).

### 2. Install & Run Web Client
```bash
# In web/ directory
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Tech Stack
- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Vanilla CSS custom properties + Tailwind utility classes
- **GIS / Maps**: Leaflet / React-Leaflet, WebGL 3D Canvas, MapLibre
- **Icons**: `@phosphor-icons/react` SVG icons only (zero emojis in codebase)
- **State**: React `useState` / `useCallback` / `useMemo`, localStorage for audit log
- **Build**: Turborepo-compatible; `npm run build` produces zero TypeScript errors

---

## Source Files (tabs)

```
web/src/components/tabs/
├── LULCTab.tsx          — Land Cover split-slider
├── ChangeTab.tsx        — Change detection
├── HealthTab.tsx        — 4 sub-indices + alerts + formula + simulator link
├── MapTab.tsx           — Leaflet dynamic GIS map
├── FieldTab.tsx         — Field Investigation with photo integrity logic
├── InterventionsTab.tsx — Investigation: affected area + engineering recommendations
└── SimulatorTab.tsx     — Dedicated What-If policy simulator
```
