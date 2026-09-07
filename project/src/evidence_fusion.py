"""
Evidence fusion layer for Watershed Signal.
Synthesizes multi-source spatial observations (LULC, NDVI trend, NDWI water extent,
drainage connectivity, change detection) into an explainable assessment verdict
with plain English rationale.
"""

from typing import Optional


def fuse_evidence(
    lulc_t2: Optional[int],
    ndvi_t1: Optional[float],
    ndvi_t2: Optional[float],
    ndwi_t1: Optional[float],
    ndwi_t2: Optional[float],
    change_class: Optional[int],
    drainage_connected: bool,
    health_score: Optional[float] = None,
    ndvi_trend: Optional[float] = None,
) -> dict:
    """
    Combines satellite, topographic, and field observation data into an explainable assessment.
    
    Returns:
        dict: {
            "score": int,
            "verdict": str,
            "confidence": str,
            "bullets": list[str],
            "recommendation": str,
        }
    """
    if lulc_t2 is None or lulc_t2 == 255:
        return {
            "score": 0,
            "verdict": "Not enough data",
            "confidence": "Low",
            "bullets": ["Satellite data is unavailable or obstructed by cloud cover at this location"],
            "recommendation": "Collect additional field observations or await the next clear satellite pass.",
        }

    score = 0
    bullets = []

    # 1. Vegetation index trend
    effective_trend = ndvi_trend
    if effective_trend is None and ndvi_t1 is not None and ndvi_t2 is not None:
        effective_trend = ndvi_t2 - ndvi_t1

    if effective_trend is not None:
        if effective_trend > 0.02:
            score += 20
            bullets.append("Vegetation cover increased since the earlier observation")
        elif effective_trend < -0.05:
            score -= 25
            bullets.append("Significant decline in vegetation greenness detected")

    # 2. Water index (NDWI)
    if ndwi_t1 is not None and ndwi_t2 is not None:
        ndwi_delta = ndwi_t2 - ndwi_t1
        if ndwi_delta > 0.01:
            score += 15
            bullets.append("Water extent has grown since the earlier observation")
        elif ndwi_delta < -0.03:
            score -= 10
            bullets.append("Surface water retention decreased compared to the previous period")

    # 3. Temporal change class (0=no change, 1=water gain, 2=construction, 3=degradation, 4=veg gain)
    if change_class == 4:
        score += 20
        bullets.append("Land cover shifted toward greener and denser vegetation classes")
    elif change_class == 1:
        score += 20
        bullets.append("New water retention or conservation structure detected")
    elif change_class == 3:
        score -= 30
        bullets.append("Land cover degradation detected between the two observation dates")
    elif change_class == 2:
        score -= 20
        bullets.append("New surface construction or ground excavation detected")

    # 4. Drainage network connectivity
    if drainage_connected:
        score += 10
        bullets.append("The site sits directly on an active drainage channel")

    # 5. Land cover state at T2
    # 0: Water, 1: Dense veg, 2: Agriculture, 3: Sparse veg, 4: Barren, 5: Built-up, 6: Fallow
    if lulc_t2 in (0, 1, 2):
        score += 15
        bullets.append("Current land cover is healthy and productive")
    elif lulc_t2 == 4:
        score -= 15
        bullets.append("Current land cover indicates exposed barren or degraded soil")

    # Determine verdict
    if score >= 50:
        verdict = "Positive evidence"
        recommendation = "Continue routine monitoring. Watershed conditions show positive progress."
    elif score >= 20:
        verdict = "Cautionary — monitor closely"
        recommendation = "Schedule periodic verification to monitor moisture and vegetation retention."
    else:
        verdict = "Degradation detected"
        recommendation = "Priority field inspection recommended to assess land degradation or soil erosion."

    # Determine confidence level
    num_supporting = len(bullets)
    if num_supporting >= 3:
        confidence = "High"
    elif num_supporting >= 1:
        confidence = "Moderate"
    else:
        confidence = "Low"

    return {
        "score": score,
        "verdict": verdict,
        "confidence": confidence,
        "bullets": bullets,
        "recommendation": recommendation,
    }
