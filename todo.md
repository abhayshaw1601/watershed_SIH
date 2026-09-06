# PS-26015 — Final Implementation & Validation To-Do

## 1. Final Product Positioning

### Core Positioning

Build the project as an:

> **Integration-ready geospatial intelligence and decision-support layer for SRISHTI-DRISHTI that interprets geo-coded field observations using satellite, GIS, temporal and watershed evidence.**

We are **not building a replacement for SRISHTI/DRISHTI/Bhuvan/Bhoonidhi**.

The external platforms are treated as potential data providers.

### Prototype Data Strategy

Because direct access/API credentials are currently unavailable:

```text
Government / External Platform
        ↓
Expected Data Interface
        ↓
Our Data Ingestion Layer
        ↓
Our Geospatial Analysis
        ↓
Decision Support
```

For the prototype:

```text
Manual / locally stored equivalent data
        ↓
Same analytical pipeline
```

Do NOT claim that SRISHTI-DRISHTI/Bhuvan/Bhoonidhi APIs are currently integrated if they are not.

---

# 2. P0 — Make Geo-Coded Image → Decision the Main Workflow

This is the most important product workflow.

## Required flow

```text
Geo-Coded Image
      ↓
GPS + Timestamp
      ↓
Spatial Context
      ↓
Identify Watershed
      ↓
Identify Nearby / Associated Intervention
      ↓
Retrieve Satellite & GIS Evidence
      ↓
LULC + NDVI + NDWI/Water + Drainage
      ↓
Temporal Change
      ↓
Evidence Fusion
      ↓
Assessment
      ↓
Explainable Decision
      ↓
Alert / Recommendation / Field Verification
```

### The uploaded image should NOT merely be displayed.

The system should use:

- GPS
- timestamp
- image content/feature
- watershed location
- intervention context

to connect the image with geospatial evidence.

---

# 3. P0 — Change the Spatial Radius Logic

## Current problem

The current system uses a fixed:

```text
9 km radius
```

This should not be presented as a scientifically defined universal radius.

## Recommended approach

Use multi-scale spatial context.

### Local context

```text
~500 m
```

Use for:

- immediate intervention surroundings
- visible structures
- local vegetation
- local water bodies
- nearby land cover

### Broader context

```text
~2 km
```

Use for:

- surrounding LULC
- vegetation trends
- water changes
- drainage relationships

### Primary assessment boundary

```text
Full watershed
```

Use for:

- watershed-level condition
- watershed trends
- intervention context
- overall assessment

### UI

Provide:

```text
Local Context       500 m
Broader Context     2 km
Full Watershed      Boundary
Custom              User selected
```

The radius should ideally become feature-dependent rather than universally fixed.

---

# 4. P0 — Watershed Boundary

## Current situation

The system has a:

> DEM-derived watershed boundary.

Keep it.

But do NOT call it:

> Official watershed boundary

unless an authoritative boundary has been obtained.

## Label it as

```text
DEM-Derived Watershed Boundary
```

## Obtain authoritative boundary if possible

Target metadata:

```text
Watershed ID
Watershed Name
State
District
Block
Village / Gram Panchayat
Area
Official Polygon
```

## Spatial operation

When a geo-coded photo is uploaded:

```text
Photo GPS
    ↓
Point-in-Polygon
    ↓
Watershed ID
    ↓
Watershed Metadata
```

This gives the officer useful context rather than only:

```text
Latitude: XX
Longitude: XX
```

---

# 5. P0 — Watershed Administrative Context

The system should ideally identify:

```text
Watershed
├── Watershed ID
├── Watershed Name
├── State
├── District
├── Block
├── Village / Panchayat
└── Area
```

A postal address is NOT necessary.

The goal is:

> **Spatial identity + administrative identity**

This makes the output useful for government officers and watershed managers.

---

# 6. P0 — Intervention-Level Assessment

Current system has an intervention registry and satellite/change evidence.

Strengthen the final assessment.

## Current concept

```text
Intervention
+
Satellite
+
Change
+
Rules
    ↓
Assessment
```

## Desired concept

```text
Intervention
+
Geo-Coded Field Evidence
+
LULC
+
NDVI
+
Water
+
Drainage
+
Temporal Change
+
Rainfall/context where available
    ↓
Evidence Fusion
    ↓
Intervention Outcome Assessment
```

---

# 7. Do NOT Claim Causal Impact

Do not say:

> "The check dam caused a 40% increase in vegetation."

Unless you have proper causal validation.

Instead say:

> "Positive changes were observed in the intervention's surrounding area."

or:

> "Available spatial evidence indicates a positive intervention outcome."

## Recommended terminology

Use:

### `Intervention Outcome Assessment`

or:

### `Intervention Evidence Score`

instead of claiming a scientifically proven:

### `Intervention Impact Score`

---

# 8. P1 — Strengthen Intervention Validation

To move from partial to strong evidence:

## A. Before / After

Already implemented.

Example:

```text
Before:
NDVI = 0.42
Water = 1.2 ha

After:
NDVI = 0.56
Water = 1.7 ha
```

## B. Control Area

Add a nearby comparable area without the intervention.

```text
                 BEFORE    AFTER

Intervention       .42      .56
Control             .43      .45
```

This helps determine whether the observed change is specific to the intervention area or part of a broader regional trend.

## C. Multiple Time Points

Prefer:

```text
2023 → 2024 → 2025 → 2026
```

over only:

```text
Before → After
```

## D. Field Evidence

Use geo-coded images as supporting evidence.

```text
Satellite:
Water increased

Field Photo:
Structure / water accumulation visible

GIS:
Intervention intersects drainage

Temporal:
Improvement observed

        ↓

Evidence Strength: HIGH
```

---

# 9. P1 — Add Rainfall / Environmental Context

A major confounding factor is rainfall.

For example:

```text
Heavy rainfall
     ↓
Water increases
     ↓
NDVI increases
```

This does not automatically prove that an intervention caused the improvement.

Where feasible, incorporate:

- rainfall
- season
- observation date
- crop/vegetation season

into the assessment.

The system can then say:

```text
Positive change observed
+
High rainfall during period

→
Impact attribution confidence: Moderate
```

This is much more scientifically responsible.

---

# 10. P0 — Scientific Validation

The project needs a small but credible validation protocol.

You do NOT need a massive field study.

Use four validation layers.

---

## 10.1 LULC Validation

Report:

- Overall accuracy / pixel accuracy
- IoU
- Per-class IoU
- Confusion matrix

Be transparent about weak classes.

Do not hide poor performance.

---

# 11. Change Detection Validation

Create approximately:

```text
20–30 manually verified change regions
```

For each:

```text
T1
T2
Model Prediction
Human Verification
```

Generate:

```text
TP
TN
FP
FN
```

Calculate:

- Precision
- Recall
- F1
- IoU

This provides real evidence that change detection works.

---

# 12. Geo-Coded Image Validation

This is especially important for the PS.

Collect approximately:

```text
10–20 geo-coded images
```

For each:

```text
Photo ID
GPS
Date
Feature
System Interpretation
Human Interpretation
Match / Mismatch
```

Example:

| Photo | Expected Feature | System | Match |
|---|---|---|---|
| P01 | Check dam | Check dam | ✅ |
| P02 | Pond | Water body | ✅ |
| P03 | Vegetation degradation | Degradation | ✅ |

Calculate:

```text
Photo Interpretation Agreement
```

This directly demonstrates the **geo-coded image interpretation** requirement.

---

# 13. Intervention Assessment Validation

Select approximately:

```text
10 interventions
```

Have a human/domain expert assign:

```text
Positive
Neutral
Negative
Uncertain
```

Compare against system output.

Report:

```text
Expert-System Agreement
```

Do NOT call this causal validation.

Call it:

> **Expert agreement / assessment validation**

---

# 14. P0 — Build the Evidence Fusion Layer

This should become a visible component in the architecture.

```text
Geo-Coded Photo
       +
Satellite
       +
GIS
       +
LULC
       +
Vegetation
       +
Water
       +
Drainage
       +
Temporal Change
       +
Intervention
       ↓
EVIDENCE FUSION
       ↓
ASSESSMENT
```

This is one of the most important differentiators of the project.

---

# 15. P0 — Make Recommendations Explainable

Every recommendation should have supporting evidence.

Example:

```text
ALERT
Potential degradation

Evidence:
• NDVI decreased 18%
• LULC changed from vegetation → barren
• Field image confirms degraded area
• Change persisted across multiple observations

Recommendation:
Schedule field verification
```

Do not simply display:

```text
AI says degradation.
```

---

# 16. P1 — Improve Field Verification Loop

Final operational flow:

```text
System detects anomaly
        ↓
Recommendation
        ↓
Field Officer Verification
        ↓
Confirmed / Rejected / Uncertain
        ↓
Record Result
```

This creates a feedback mechanism.

---

# 17. P1 — External Data Integration Architecture

Keep external data providers abstract.

Instead of hard-coding:

```text
Sentinel-2
```

everywhere, use a conceptual interface:

```text
Data Provider
     │
 ┌───┼──────────────┐
 ↓   ↓              ↓
S2   SRISHTI       Bhoonidhi
```

The downstream pipeline remains:

```text
Provider
   ↓
Preprocessing
   ↓
Analysis
   ↓
Decision
```

Therefore, when official access becomes available:

```text
Manual Dataset
      ↓
Official Dataset
```

can be swapped without redesigning the entire application.

---

# 18. P1 — Clearly Document Prototype Data Limitations

In the final presentation/report, explicitly state:

> **"Due to unavailable/unauthorized access to certain government datasets and APIs during development, the prototype uses equivalent open/reference datasets and manually supplied geospatial inputs to demonstrate the analytical workflow. The ingestion layer is designed to accommodate authorized SRISHTI-DRISHTI/Bhuvan/Bhoonidhi data sources when access is available."**

Do NOT claim:

```text
SRISHTI API integrated
```

if it isn't.

Do NOT claim:

```text
Bhoonidhi API integrated
```

if it isn't.

---

# 19. P2 — Improve UI for the Main Demo

The most important screen should be:

## Geo-Coded Observation Analysis

```text
┌──────────────────────────────────────────┐
│ Geo-Coded Field Image                   │
│                                          │
│              [ PHOTO ]                   │
│                                          │
│ GPS: XX.XXXX, XX.XXXX                    │
│ Date: DD/MM/YYYY                         │
└──────────────────────────────────────────┘

Watershed:
XYZ Watershed

District:
ABC

Intervention:
Check Dam #12

──────────────────────────────────────────

Spatial Evidence

LULC             Agriculture
NDVI             0.56 ↑
Water            1.7 ha ↑
Drainage         Connected
Change           Positive

──────────────────────────────────────────

Assessment

🟢 Positive Evidence

Confidence: High

Reason:
• Vegetation increased
• Water extent increased
• Intervention located on drainage
• Field image confirms structure

──────────────────────────────────────────

Recommendation

Continue monitoring
```

This should be your **killer demo**.

---

# 20. What NOT to Spend Time On

Do NOT prioritize:

- another unnecessary ML model
- complicated LLM agents
- blockchain
- chatbot features
- generic weather prediction
- flood prediction
- huge mobile application
- replacing SRISHTI/DRISHTI
- claiming unsupported government API integration

These are distractions from the PS.

---

# 21. Final Priority Matrix

| Task | Priority | Reason |
|---|---:|---|
| Geo-photo → spatial context → decision | 🔴 P0 | Core PS |
| Multi-scale spatial analysis | 🔴 P0 | Fix arbitrary 9 km |
| Watershed metadata | 🔴 P0 | Government usability |
| Clearly label DEM boundary | 🔴 P0 | Scientific correctness |
| Evidence fusion | 🔴 P0 | Core differentiation |
| Geo-photo validation | 🔴 P0 | Direct PS validation |
| Change validation | 🔴 P0 | Scientific credibility |
| Intervention assessment | 🔴 P0 | Core outcome |
| Expert agreement | 🟡 P1 | Assessment validation |
| Control-area comparison | 🟡 P1 | Stronger impact evidence |
| Rainfall/context | 🟡 P1 | Reduce confounding |
| Multiple temporal observations | 🟡 P1 | Better trends |
| External provider abstraction | 🟡 P1 | Future SRISHTI integration |
| Official watershed polygon | 🟡 P1 | Authority/accuracy |
| UI polish | 🟢 P2 | Presentation |
| More ML models | ❌ | Not currently necessary |

---

# 22. Final Definition of Done

The project is ready when this workflow works end-to-end:

```text
                GEO-CODED IMAGE
                       │
                       ▼
                GPS + TIMESTAMP
                       │
                       ▼
             WATERSHED IDENTIFICATION
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
        LULC         NDVI          WATER
          ↓            ↓            ↓
          └────────────┼────────────┘
                       ↓
                   DRAINAGE
                       ↓
               INTERVENTION
                 CONTEXT
                       ↓
              TEMPORAL CHANGE
                       ↓
               EVIDENCE FUSION
                       ↓
          INTERVENTION / WATERSHED
                 ASSESSMENT
                       ↓
             EXPLAINABLE RULES
                       ↓
             ┌─────────┼─────────┐
             ↓         ↓         ↓
           ALERT   RECOMMEND  CONDITION
             │         │         │
             └─────────┼─────────┘
                       ↓
               OFFICER DASHBOARD
                       ↓
               FIELD VERIFICATION
```

## The actual remaining work is therefore NOT "build the whole project."

It is:

### **1. Fix the spatial-context methodology**
### **2. Connect the geo-coded image to the full evidence chain**
### **3. Add watershed identity/metadata**
### **4. Strengthen intervention assessment**
### **5. Perform small-scale scientific validation**
### **6. Present the system as an integration-ready analytical layer, not a replacement for government platforms**

Once those are done, your project is **very strongly aligned with the PS**.