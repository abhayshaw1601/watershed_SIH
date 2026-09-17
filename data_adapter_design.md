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
│   │  Model 1 LULC Inference (U-Net ResNet18, 10m pixel classification)│ │
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

### 1. ISRO Bhuvan REST API Client (Operational)
- **Target Products**: Bhuvan Thematic LULC 1:50,000 Area-of-Interest Statistics (`curl_aoi.php`).
- **Interface**: REST API JSON endpoint with 24-hour token authentication.
- **Normalization Implemented**:
  - Dynamically constructs Well-Known Text (WKT) bounding polygon for the active watershed.
  - Parses NRSC level-II classification codes (`l01`–`l24`) into metric square kilometers and percentages.
  - Cached in Redis / thread-safe in-memory cache with 24h TTL.

### 2. ISRO Bhoonidhi Zero-Extraction Engine (Operational)
- **Target Products**: Resourcesat-2/2A LISS-III satellite archives (23.5m multi-spectral).
- **Interface**: Direct virtual raster streaming via GDAL `/vsizip/` (zero disk extraction).
- **Normalization Implemented**:
  - Resamples Bands 2, 3, 4, 5 onto standard 10m UTM grid.
  - Synthesizes blue proxy from Green & Red to match Model 1 U-Net's 6-channel input format.
  - Automatically discovers temporal pairs (T1 earliest, T2 latest) for bi-temporal change detection.

### 3. High-Availability Automated Fallback (Operational)
When querying arbitrary coordinates across India where local Indian satellite scenes have not been preloaded:
- **Sentinel-2 L2A**: Streamed via Earth Search AWS STAC API (B02, B03, B04, B08) at 10m resolution in ~8 seconds.
- **Copernicus GLO-30 DEM**: 30m elevation mosaic streamed via open AWS S3 elevation tiles.
- **Bhuvan Ground-Truth Query**: Live Bhuvan LULC API is still queried for every Indian AOI to provide official government validation.

---

## Conclusion

The analytical core of Watershed Signal is strictly decoupled from data acquisition sources. By implementing `data_adapter.py`, the system seamlessly combines sovereign Indian Earth Observation assets (Bhuvan & Bhoonidhi) with automated high-availability open data fallback, providing both departmental compliance and zero-downtime reliability.
