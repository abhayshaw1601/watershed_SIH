"use client";

import { useState } from "react";
import type { SiteMeta } from "@/lib/watershed-data";
import { sortAlerts } from "@/lib/watershed-data";
import HealthGauge from "@/components/ui/HealthGauge";
import AlertCard from "@/components/ui/AlertCard";
import {
  Drop,
  Tree,
  ShieldCheck,
  TrendUp,
  Sliders,
  Target,
  Lightbulb,
  WarningOctagon,
  Calculator,
  CaretUp,
  CaretDown,
  ArrowRight,
} from "@phosphor-icons/react";

const CLASS_WEIGHTS: Record<string, { weight: number; name: string; desc: string }> = {
  "0": { weight: 100, name: "Water / Structures", desc: "Highest ecological value; direct runoff capture" },
  "1": { weight: 90, name: "Dense Forest / Trees", desc: "Deep root soil holding, canopy interception" },
  "2": { weight: 70, name: "Agriculture / Cropland", desc: "Productive land use; moderate soil cover" },
  "3": { weight: 55, name: "Sparse Veg / Grassland", desc: "Surface roughness; buffers gentle runoff" },
  "6": { weight: 35, name: "Fallow / Bare Field", desc: "Vulnerable to sheet erosion during pre-monsoon" },
  "5": { weight: 20, name: "Built-up / Settlement", desc: "Impervious surfaces; high peak runoff velocity" },
  "4": { weight: 10, name: "Barren / Degraded Land", desc: "Severe gully risk, zero infiltration benefit" },
};

export default function HealthTab({
  meta,
  onNavigateToSimulator,
}: {
  meta: SiteMeta;
  onNavigateToSimulator?: () => void;
}) {
  const [showFormula, setShowFormula] = useState(false);

  const alerts = meta.alerts ? sortAlerts(meta.alerts) : [];

  // Compute baseline class hectares & sub-indices
  const breakdown = meta.class_breakdown || {};
  const waterHa = breakdown["0"]?.hectares || 0;
  const forestHa = breakdown["1"]?.hectares || 0;
  const agriHa = breakdown["2"]?.hectares || 0;
  const sparseHa = breakdown["3"]?.hectares || 0;
  const barrenHa = breakdown["4"]?.hectares || 0;
  const builtHa = breakdown["5"]?.hectares || 0;
  const fallowHa = breakdown["6"]?.hectares || 0;

  const totalValidHa = Math.max(1, waterHa + forestHa + agriHa + sparseHa + barrenHa + builtHa + fallowHa);

  // 1. Water Resilience Index (0-100)
  const waterPercent = (waterHa / totalValidHa) * 100;
  const waterScore = Math.min(100, Math.round((waterPercent / 3.2) * 80 + (forestHa / totalValidHa) * 20));

  // 2. Vegetation Canopy & Biomass Index (0-100)
  const greenPercent = ((forestHa + agriHa * 0.75 + sparseHa * 0.4) / totalValidHa) * 100;
  const canopyScore = Math.min(100, Math.round(greenPercent * 1.15));

  // 3. Soil Stability & Erosion Defense (0-100)
  const degradedPercent = ((barrenHa * 1.0 + fallowHa * 0.4) / totalValidHa) * 100;
  const soilScore = Math.max(10, Math.min(100, Math.round(100 - degradedPercent * 1.25)));

  // 4. Temporal Trend Index (0-100)
  const trendVal = typeof meta.ndvi_trend === "number" ? meta.ndvi_trend : 0;
  const trendScore = Math.max(0, Math.min(100, Math.round(50 + trendVal * 320)));

  // Determine primary advisory
  const lowestSubScore = Math.min(waterScore, canopyScore, soilScore);

  return (
    <div className="space-y-8">
      {/* Top Banner: Primary Score Gauge + 4 Sub-Indices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Main Gauge Card */}
        <div className="flex flex-col items-center justify-between rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 text-center shadow-xs">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Watershed Health Index
            </div>
            <div className="mt-4 flex justify-center">
              <HealthGauge score={meta.health_score} size={180} />
            </div>
            <div className="mt-2 text-xs font-mono text-muted-foreground">
              Scientific Multi-Factor Weighted Score
            </div>
          </div>

          <div className="mt-6 w-full border-t border-foreground/10 pt-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              NDVI 5-Year Velocity
            </div>
            <div
              className={`mt-1 font-display text-lg font-semibold ${
                trendVal >= 0 ? "text-sage" : "text-danger"
              }`}
            >
              {trendVal >= 0 ? "+" : ""}
              {trendVal.toFixed(4)} {trendVal >= 0 ? "· Greening Trend" : "· Vegetation Stress"}
            </div>
          </div>
        </div>

        {/* 4 Multi-Factor Diagnostic Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 1. Water Resilience */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Drop size={15} className="text-sky-400" weight="bold" />
                <span>Water Storage Index</span>
              </span>
              <span className="font-display text-lg font-bold text-sky-400">{waterScore}/100</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-700"
                style={{ width: `${waterScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {waterHa.toFixed(1)} ha surface water ({waterPercent.toFixed(1)}% of catchment).{" "}
              {waterScore >= 60 ? "Adequate retention along primary nala." : "Severe pre-monsoon water deficit."}
            </p>
          </div>

          {/* 2. Vegetation Canopy */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tree size={15} className="text-emerald-400" weight="bold" />
                <span>Canopy & Biomass</span>
              </span>
              <span className="font-display text-lg font-bold text-emerald-400">{canopyScore}/100</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${canopyScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {(forestHa + agriHa).toFixed(1)} ha active green cover.{" "}
              {canopyScore >= 65 ? "Stable agrarian and silvopasture canopy." : "Substantial barren/fallow exposure."}
            </p>
          </div>

          {/* 3. Soil Stability */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-amber-400" weight="bold" />
                <span>Soil Stability & Defense</span>
              </span>
              <span className="font-display text-lg font-bold text-amber-400">{soilScore}/100</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                style={{ width: `${soilScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {barrenHa.toFixed(1)} ha barren gully land ({((barrenHa / totalValidHa) * 100).toFixed(1)}%).{" "}
              {soilScore >= 70 ? "Protected topsoil with low erosion risk." : "Vulnerable to sheet wash on upper ridges."}
            </p>
          </div>

          {/* 4. Temporal Resilience */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendUp size={15} className="text-indigo-400" weight="bold" />
                <span>5-Yr Climate Resilience</span>
              </span>
              <span className="font-display text-lg font-bold text-indigo-400">{trendScore}/100</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${trendScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Based on Sentinel-2 multi-spectral NDVI change.{" "}
              {trendVal >= 0 ? "Positive biomass accumulation over 5 years." : "Negative moisture trajectory."}
            </p>
          </div>
        </div>
      </div>

      {/* Standalone Simulator Banner Link */}
      <div className="rounded-2xl border border-sage/30 bg-sage/[0.04] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-sage font-bold">
            <Sliders size={16} weight="bold" />
            <span>Dedicated Watershed Policy & Intervention Simulator Available</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-foreground">
            Want to simulate adding check dams, afforestation, or contour bunds?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Test policy decisions, calculate water recharge yields, and project health index deltas in real-time
            in the dedicated <strong>What-If Simulator</strong> tab.
          </p>
        </div>

        {onNavigateToSimulator ? (
          <button
            onClick={onNavigateToSimulator}
            className="flex items-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-xs font-semibold text-background hover:bg-sage/90 transition-colors cursor-pointer shrink-0"
          >
            <span>Open What-If Simulator</span>
            <ArrowRight size={14} weight="bold" />
          </button>
        ) : (
          <span className="rounded-xl border border-foreground/15 bg-background px-4 py-2 text-xs font-mono text-muted-foreground">
            Switch to &ldquo;What-If Simulator&rdquo; tab above
          </span>
        )}
      </div>

      {/* Actionable Engineering Advisory & Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Engineering Advisory */}
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target size={15} className="text-sage" weight="bold" />
            <span>Engineering Advisory for Field Officers</span>
          </div>
          <div className="mt-4 space-y-3">
            {lowestSubScore === waterScore && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-sky-400 block mb-1">Priority: Water Storage Augmentation</strong>
                Hydrological resilience is the limiting factor in this catchment. Recommend constructing masonry check
                dams on secondary tributaries before the upcoming monsoon to capture runoff.
              </div>
            )}
            {lowestSubScore === soilScore && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-amber-400 block mb-1">Priority: Ridge Soil Stabilization</strong>
                Upper ridge sectors show {barrenHa.toFixed(1)} ha of exposed barren soil. Recommend Continuous Contour
                Trenches (CCT) and gully plugs to arrest progressive topsoil degradation.
              </div>
            )}
            {lowestSubScore === canopyScore && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-emerald-400 block mb-1">Priority: Agroforestry & Fallow Vegetating</strong>
                Biomass canopy is suboptimal. Field workers should encourage farmers to plant horticultural boundary
                species along cropland perimeters.
              </div>
            )}
            <div className="rounded-xl border border-foreground/10 bg-background p-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" weight="bold" />
              <div>
                <strong>Decision Support Rule</strong>: Health score combines AI satellite land classification with
                scientifically calibrated weights from the Indo-German Watershed Development Programme (IWDP).
              </div>
            </div>
          </div>
        </div>

        {/* Right: Automated Satellite Alerts */}
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <WarningOctagon size={15} className="text-rose-500" weight="bold" />
            <span>Automated Satellite Change Alerts</span>
          </div>
          {alerts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {alerts.map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-foreground/10 p-6 text-sm text-muted-foreground">
              No change-based alerts triggered for this location.
            </div>
          )}
        </div>
      </div>

      {/* Formula Transparency Accordion */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.01] p-5">
        <button
          type="button"
          onClick={() => setShowFormula(!showFormula)}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Calculator size={15} className="text-muted-foreground shrink-0" weight="bold" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Mathematical Formula & Weight Transparency
            </span>
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              Auditable Composite
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
            {showFormula ? (
              <>
                <span>Hide Formula</span>
                <CaretUp size={12} weight="bold" />
              </>
            ) : (
              <>
                <span>Inspect Math</span>
                <CaretDown size={12} weight="bold" />
              </>
            )}
          </span>
        </button>

        {showFormula && (
          <div className="mt-5 border-t border-foreground/10 pt-5 text-xs text-muted-foreground space-y-4">
            <p className="leading-relaxed">
              The <strong>Watershed Health Index (0–100)</strong> is computed as an area-weighted composite of every
              10m pixel inside the watershed catchment:
            </p>
            <div className="rounded-xl border border-foreground/10 bg-background p-4 font-mono text-center text-foreground text-sm overflow-x-auto">
              Health Score = Σ (Class Hectares × Class Weight) / Total Valid Hectares
            </div>
            <div className="overflow-x-auto rounded-xl border border-foreground/10 mt-3">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-foreground/[0.04] text-foreground border-b border-foreground/10">
                  <tr>
                    <th className="p-2.5">Land Cover Class</th>
                    <th className="p-2.5">Health Weight</th>
                    <th className="p-2.5">Catchment Area</th>
                    <th className="p-2.5">Ecological Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {Object.entries(CLASS_WEIGHTS).map(([clsId, item]) => {
                    const ha = breakdown[clsId]?.hectares || 0;
                    return (
                      <tr key={clsId} className="hover:bg-foreground/[0.02]">
                        <td className="p-2.5 font-medium text-foreground">{item.name}</td>
                        <td className="p-2.5 font-bold text-sage">{item.weight}/100</td>
                        <td className="p-2.5">{ha.toFixed(1)} ha</td>
                        <td className="p-2.5 text-muted-foreground">{item.desc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              * Note: Cloud shadow and unclassified gaps (Class 255) are strictly excluded from the denominator to
              prevent false score dilution.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
