# Government GIS & Satellite Data Adapter Architecture (PS-26015)

## Executive Summary

During prototype development for Smart India Hackathon 2026 (Problem Statement 26015), direct production API credentials and proprietary endpoints for Indian governmental portals (SRISHTI-DRISHTI, Bhuvan, Bhoonidhi) were restricted or unavailable for live third-party automated ingestion.

To establish an immediate, working end-to-end analytical pipeline without architectural debt or hardcoded mock data, Watershed Signal was engineered around a clean **Data Ingestion Seam**. The analytical and decision components (Model 1 U-Net, DEM-derived hydrological delineation, change detection, and rule-based evidence fusion) operate exclusively against a normalized raster interface.

This design guarantees that when authorized API access or WMS/WCS feeds are granted, **only the ingestion adapter is updated** — zero changes are required to the downstream spatial models, recommendation rules, or decision cards.

---

## Architectural Seam Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      GOVERNMENT DATA SOURCES                            │
│                                                                         │
│   ┌────────────────────┐   ┌────────────────────┐   ┌───────────────┐   │
│   │  SRISHTI-DRISHTI   │   │    ISRO Bhuvan     │   │   Bhoonidhi   │   │
│   │  (MGNREGA Assets)  │   │ (LULC 1:50k / DEM) │   │ (IRS / S2)    │   │
│   └─────────┬──────────┘   └─────────┬──────────┘   └───────┬───────┘   │
└─────────────┼────────────────────────┼──────────────────────┼───────────┘
              │                        │                      │
              ▼                        ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      FUTURE DATA ADAPTER SEAM                           │
│                      (project/src/data_adapter.py)                      │
│                                                                         │
│   • Auth / Token Negotiation (OAuth2 / MoRD Gateway)                    │
│   • Protocol Translation (WMS / WCS / GeoJSON REST)                     │
│   • CRS & Resampling Normalization (EPSG:4326 / UTM 10m grid)           │
│   • Semantic Class Mapping (NRSC 18-class LULC -> 7-class schema)       │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    Normalized 6-Channel Raster & Vector
                    (R, G, B, NIR, NDVI, NDWI + AOI Bounds)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   EXISTING PRODUCTION CORE PIPELINE                     │
│                            (ALREADY BUILT)                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Hydrological Delineation (pysheds DEM flow accumulation)       │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  Model 1 LULC Inference (U-Net ResNet18, 10m pixel classification)│   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  Temporal Change Detection (Bi-temporal rule-based diff)        │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  Intervention Spatial Registry (Check dams, ponds, bunds)       │   │
│   ├─────────────────────────────────────────────────────────────────┤   │
│   │  Multi-Source Evidence Fusion (Explainable assessment verdict)  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      OPERATIONAL DECISION LAYER                         │
│                                                                         │
│   • Field Officer Observation Card (Evidence, Verdict, Recommendation)  │
│   • Prioritized Conservation Alerts (New construction, degradation)     │
│   • Field Validation Audit Log (Geo-photo GPS confirmation)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications for Ingestion Adapters

### 1. ISRO Bhuvan WMS/WCS Adapter
- **Target Products**: Bhuvan Thematic LULC (1:50,000 scale), CartoDEM (10m/30m resolution).
- **Interface**: OGC WCS (Web Coverage Service) 1.1.1 / 2.0.1.
- **Normalization Required**:
  - Reproject bounding box to UTM zone based on center longitude.
  - Nearest-neighbor resampling to 10m resolution.
  - Remap Bhuvan level-II classification codes to the unified 7-class scheme via lookup table.

### 2. SRISHTI-DRISHTI Geotagged Assets Adapter
- **Target Products**: Geotagged MGNREGA natural resource management (NRM) assets (check dams, sunken ponds, percolation tanks, field bunds).
- **Interface**: REST API JSON / GeoJSON endpoint.
- **Data Mapping**:
  - `asset_id` -> `intervention.id`
  - `work_name` -> `intervention.name`
  - `category` -> `intervention.type` (`Check Dam`, `Farm Pond`, etc.)
  - `latitude`, `longitude` -> `intervention.lat`, `intervention.lon`
  - `photo_url` -> Direct display in Field Verification view.

### 3. Current Open-Access Reference Implementation
Until portal access credentials are deployed in the operating environment, the system utilizes:
- **Sentinel-2 L2A BOA Reflectance**: Retrieved via Earth Search AWS STAC API (B02, B03, B04, B08) at 10m native resolution.
- **Copernicus GLO-30 DEM**: 30m global digital elevation model fetched via open AWS S3 elevation tiles.
- **ESA WorldCover 10m**: Reference ground validation baseline for land-cover transitions.

---

## Conclusion

The analytical core of Watershed Signal is strictly decoupled from data acquisition sources. By establishing this adapter architecture, transition to full government production infrastructure requires only plug-and-play adapter drivers without altering core models, validation pipelines, or field interfaces.
