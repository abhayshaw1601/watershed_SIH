"""
Rule-based recommendation engine (model_plan.md section 4) — takes Model 1's
class map + the change map (Model 2 or Tier 1 fallback) + a health score, and
emits explainable alerts/recommendations. No ML, no training data needed.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np

from config import CLASS_NAMES, NODATA_CLASS

WATER, DENSE_VEG, AGRI, SPARSE_VEG, BARREN, BUILTUP, FALLOW = range(7)

# Health-score weights: how much each class contributes per pixel (0-100 scale).
# "Good" classes (water, dense veg, agriculture) score high; degraded/built-up score low.
CLASS_HEALTH_WEIGHT = {
    WATER: 100,
    DENSE_VEG: 90,
    AGRI: 70,
    SPARSE_VEG: 55,
    FALLOW: 35,
    BUILTUP: 20,
    BARREN: 10,
}


def compute_health_score(class_map: np.ndarray) -> float:
    """Simple, explainable composite: mean of per-pixel class health weights.
    100 = ideal mix of water/vegetation, 0 = fully barren/built-up.
    Pixels with no real satellite coverage (config.NODATA_CLASS) are excluded
    rather than averaged in -- otherwise a partial-scene gap silently pulls
    the score toward whatever weight that pixel's spurious model prediction
    happened to get."""
    valid = class_map != NODATA_CLASS
    if not valid.any():
        return 0.0
    weights = np.vectorize(CLASS_HEALTH_WEIGHT.get)(class_map[valid])
    return float(np.mean(weights))


def ndvi_trend(img_t1: np.ndarray, img_t2: np.ndarray) -> float:
    """Mean NDVI change (channel 4 of the 6-channel R,G,B,NIR,NDVI,NDWI stack);
    negative = declining vegetation vigor. Excludes pixels with no real
    satellite coverage (R,G,B,NIR all exactly 0) in either date -- those read
    as NDVI=0 (0/0), which biases the trend toward zero if left in."""
    no_coverage_t1 = np.all(img_t1[:4] == 0, axis=0)
    no_coverage_t2 = np.all(img_t2[:4] == 0, axis=0)
    valid = ~(no_coverage_t1 | no_coverage_t2)
    if not valid.any():
        return 0.0
    return float(np.mean(img_t2[4][valid]) - np.mean(img_t1[4][valid]))


def generate_alerts(class_map_t2: np.ndarray, change_map: np.ndarray,
                     health_score: float, ndvi_trend_value: float,
                     health_history: list[float] | None = None,
                     known_project_mask: np.ndarray | None = None,
                     pixel_area_m2: float = 100.0) -> list[dict]:
    """
    Applies model_plan.md section 4's rules over the change map, returns a list
    of alert/recommendation dicts (severity, message, area_ha).
    health_history: prior health scores (oldest->newest), for the
    "declining 2+ consecutive periods" rule.
    """
    alerts = []

    def area_ha(mask):
        return round(int(np.sum(mask)) * pixel_area_m2 / 10000, 2)

    construction_mask = change_map == 2
    if construction_mask.any():
        verified = known_project_mask if known_project_mask is not None else np.zeros_like(construction_mask)
        unverified = construction_mask & ~verified
        if unverified.any():
            unv_ha = area_ha(unverified)
            alerts.append({
                "severity": "ALERT",
                "rule": "new_construction",
                "message": "Possible unauthorized construction detected — recommend field verification.",
                "area_ha": unv_ha,
                "evidence": [
                    f"Construction-type surface change detected over {unv_ha} ha",
                    "Change occurs outside registered watershed project boundaries",
                    "Spectral response indicates fresh concrete, compaction, or ground excavation",
                ],
            })
        if (construction_mask & verified).any():
            ver_ha = area_ha(construction_mask & verified)
            alerts.append({
                "severity": "INFO",
                "rule": "new_construction_verified",
                "message": "New construction within a known project boundary — logged, no action needed.",
                "area_ha": ver_ha,
                "evidence": [
                    f"Construction activity observed over {ver_ha} ha",
                    "Coincides with recorded intervention or development project boundary",
                ],
            })

    degradation_mask = change_map == 3
    if degradation_mask.any() and ndvi_trend_value < -0.02:
        deg_ha = area_ha(degradation_mask)
        alerts.append({
            "severity": "RECOMMEND",
            "rule": "degradation_intervention",
            "message": "Vegetation or water loss with declining NDVI trend — soil and water conservation structure recommended.",
            "area_ha": deg_ha,
            "evidence": [
                f"Degraded land area covers {deg_ha} ha across the watershed",
                f"Vegetation index trend is negative ({ndvi_trend_value:.3f}) over the observation period",
                "Indicates soil moisture depletion or loss of vegetative cover",
            ],
        })

    new_water_mask = change_map == 1
    if new_water_mask.any():
        matched = known_project_mask if known_project_mask is not None else np.zeros_like(new_water_mask)
        confirmed = new_water_mask & matched
        if confirmed.any():
            conf_ha = area_ha(confirmed)
            alerts.append({
                "severity": "VERIFIED",
                "rule": "new_structure_confirmed",
                "message": "New conservation structure confirmed within a known project boundary.",
                "area_ha": conf_ha,
                "evidence": [
                    f"New surface water retention detected over {conf_ha} ha",
                    "Matches location of registered water harvesting asset",
                ],
            })
        unmatched = new_water_mask & ~matched
        if unmatched.any():
            unm_ha = area_ha(unmatched)
            alerts.append({
                "severity": "INFO",
                "rule": "new_water_unverified",
                "message": "New water body detected outside known project boundaries — field verification recommended.",
                "area_ha": unm_ha,
                "evidence": [
                    f"New water retention detected over {unm_ha} ha",
                    "Not recorded in official intervention registry",
                ],
            })

    history = list(health_history or []) + [health_score]
    # Trailing run below 40 (model_plan.md 4: "health_score < 40 for 2+
    # consecutive periods"). Counts the trailing streak, not total history
    # length -- [30, 35] rising is still 2 consecutive low periods, [20, 80]
    # is not, even though len(history) is 2 in both cases.
    streak = 0
    for h in reversed(history):
        if h < 40:
            streak += 1
        else:
            break
    if streak >= 2:
        alerts.append({
            "severity": "RECOMMEND",
            "rule": "priority_intervention",
            "message": f"Watershed health persistently low for the last {streak} periods (current score={health_score:.1f}/100) — priority intervention recommended.",
            "area_ha": None,
            "evidence": [
                f"Current catchment condition score is {health_score:.1f}/100",
                f"Health score has remained below the critical threshold (40) for {streak} consecutive periods",
            ],
        })

    if len(history) >= 2 and (history[-2] - history[-1]) >= 10:
        drop = history[-2] - history[-1]
        alerts.append({
            "severity": "ALERT",
            "rule": "health_declining",
            "message": f"Sharp decline in watershed health ({history[-2]:.1f} -> {history[-1]:.1f}, -{drop:.1f} pts) — inspect cause.",
            "area_ha": None,
            "evidence": [
                f"Health score dropped by {drop:.1f} points since previous assessment",
                "Reflects widespread loss of moisture or biomass in the catchment",
            ],
        })

    if not alerts:
        alerts.append({
            "severity": "INFO",
            "rule": "no_flags",
            "message": "No alerts this period — watershed conditions stable.",
            "area_ha": None,
        })

    return alerts


if __name__ == "__main__":
    rng = np.random.default_rng(1)
    class_map = rng.integers(0, 7, size=(128, 128)).astype("uint8")
    change_map = np.zeros((128, 128), dtype="uint8")
    change_map[40:60, 40:60] = 2  # construction
    change_map[10:30, 10:30] = 3  # degradation

    health = compute_health_score(class_map)
    trend = -0.05
    for alert in generate_alerts(class_map, change_map, health, trend, health_history=[35, 38]):
        print(f"[{alert['severity']}] {alert['message']} (area={alert['area_ha']} ha)")
