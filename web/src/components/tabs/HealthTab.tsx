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
  "0": { weight: 100, name: "Water Bodies & Dams", desc: "Stores runoff and directly recharges groundwater" },
  "1": { weight: 90, name: "Forests & Trees", desc: "Deep roots anchor soil and absorb rainfall" },
  "2": { weight: 70, name: "Farmland & Crops", desc: "Crops provide seasonal soil cover and food" },
  "3": { weight: 55, name: "Grassland & Shrubs", desc: "Slows surface water flow and protects soil" },
  "6": { weight: 35, name: "Bare & Fallow Fields", desc: "Uncovered soil vulnerable to rain wash" },
  "5": { weight: 20, name: "Villages & Buildings", desc: "Hard surfaces where rainwater runs off without soaking in" },
  "4": { weight: 10, name: "Barren & Degraded Land", desc: "Severely eroded ground with no water infiltration" },
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
              Watershed Health Score
            </div>
            <div className="mt-4 flex justify-center">
              <HealthGauge score={meta.health_score} size={180} />
            </div>
            
            <div className="mt-3 flex justify-center">
              {meta.health_score >= 65 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-sage/10 px-3 py-0.5 text-xs font-semibold text-sage">
                  <ShieldCheck size={13} weight="bold" />
                  <span>Healthy Condition</span>
                </span>
              ) : meta.health_score >= 35 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-0.5 text-xs font-semibold text-amber">
                  <Lightbulb size={13} weight="bold" />
                  <span>Moderate Condition</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-3 py-0.5 text-xs font-semibold text-danger">
                  <WarningOctagon size={13} weight="bold" />
                  <span>Needs Conservation</span>
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              A single score from 0 (degraded) to 100 (abundant water &amp; trees).
            </p>
          </div>

          <div className="mt-6 w-full border-t border-foreground/10 pt-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              5-Year Growth Trend
            </div>
            <div
              className={`mt-1 font-display text-base font-semibold ${
                trendVal >= 0 ? "text-sage" : "text-danger"
              }`}
            >
              {trendVal >= 0 ? "+" : ""}
              {trendVal.toFixed(3)} · {trendVal >= 0 ? "Vegetation Growing" : "Vegetation Declining"}
            </div>
          </div>
        </div>

        {/* 4 Multi-Factor Diagnostic Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 1. Water Storage */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Drop size={15} className="text-sky-400" weight="bold" />
                <span>Water Storage</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                  waterScore >= 60 ? "bg-sky-500/10 text-sky-400 border border-sky-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                }`}>
                  {waterScore >= 60 ? "Adequate" : "Low Water"}
                </span>
                <span className="font-display text-lg font-bold text-sky-400">{waterScore}/100</span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-700"
                style={{ width: `${waterScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {waterHa.toFixed(1)} ha water bodies ({waterPercent.toFixed(1)}% of area).{" "}
              {waterScore >= 60 ? "Dams and ponds hold sufficient water to refill wells." : "Very little open water; check dams needed to catch monsoon runoff."}
            </p>
          </div>

          {/* 2. Plant & Tree Cover */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tree size={15} className="text-emerald-400" weight="bold" />
                <span>Plant &amp; Tree Cover</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                  canopyScore >= 65 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                }`}>
                  {canopyScore >= 65 ? "Good Cover" : "Thin Trees"}
                </span>
                <span className="font-display text-lg font-bold text-emerald-400">{canopyScore}/100</span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${canopyScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {(forestHa + agriHa).toFixed(1)} ha trees and crops.{" "}
              {canopyScore >= 65 ? "Healthy crop and tree canopy shields the soil and retains moisture." : "Low plant cover; bare land needs tree and grass planting."}
            </p>
          </div>

          {/* 3. Soil Protection */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-amber-400" weight="bold" />
                <span>Soil Protection</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                  soilScore >= 70 ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}>
                  {soilScore >= 70 ? "Stable Soil" : "Erosion Risk"}
                </span>
                <span className="font-display text-lg font-bold text-amber-400">{soilScore}/100</span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                style={{ width: `${soilScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {barrenHa.toFixed(1)} ha bare slopes ({((barrenHa / totalValidHa) * 100).toFixed(1)}%).{" "}
              {soilScore >= 70 ? "Ground is well-protected with low risk of soil loss." : "Bare slopes risk losing topsoil; contour bunds recommended."}
            </p>
          </div>

          {/* 4. 5-Year Growth Trend */}
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendUp size={15} className="text-indigo-400" weight="bold" />
                <span>5-Year Growth Trend</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                  trendVal >= 0 ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}>
                  {trendVal >= 0 ? "Improving" : "Declining"}
                </span>
                <span className="font-display text-lg font-bold text-indigo-400">{trendScore}/100</span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${trendScore}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Multi-year satellite data.{" "}
              {trendVal >= 0 ? "Vegetation and biomass have expanded over the last 5 years." : "Vegetation has declined in recent seasons."}
            </p>
          </div>
        </div>
      </div>

      {/* Standalone Simulator Banner Link */}
      <div className="rounded-2xl border border-sage/30 bg-sage/[0.04] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-sage font-bold">
            <Sliders size={16} weight="bold" />
            <span>Interactive What-If Score Simulator</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-foreground">
            Want to see how building dams or planting trees raises this score?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Test conservation structures in real-time, calculate water recharge gains, and see immediate score improvements in the <strong>What-If Simulator</strong>.
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
            <span>Recommended Priority Actions</span>
          </div>
          <div className="mt-4 space-y-3">
            {lowestSubScore === waterScore && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-sky-400 block mb-1 font-semibold">Priority: Build Water Storage</strong>
                Water storage is the main bottleneck. Construct check dams and percolation tanks on streams to hold monsoon runoff and refill farm wells.
              </div>
            )}
            {lowestSubScore === soilScore && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-amber-400 block mb-1 font-semibold">Priority: Stop Slope Soil Erosion</strong>
                {barrenHa.toFixed(1)} ha of upper hillside is bare and shedding soil. Construct contour trenches and earthen gully plugs to stop erosion.
              </div>
            )}
            {lowestSubScore === canopyScore && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed">
                <strong className="text-emerald-400 block mb-1 font-semibold">Priority: Increase Tree &amp; Plant Cover</strong>
                Plant cover is thin. Planting fruit and native trees along farm boundaries will hold soil moisture and improve the health score.
              </div>
            )}
            <div className="rounded-xl border border-foreground/10 bg-background p-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" weight="bold" />
              <div>
                <strong>How to read this score</strong>: Scores between 65–100 indicate healthy land, 35–64 indicates moderate stress, and below 35 requires immediate conservation works.
              </div>
            </div>
          </div>
        </div>

        {/* Right: Automated Satellite Alerts */}
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <WarningOctagon size={15} className="text-rose-500" weight="bold" />
            <span>Satellite Alerts &amp; Detected Changes</span>
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
              How is the Health Score Calculated?
            </span>
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              Transparent Method
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
            {showFormula ? (
              <>
                <span>Hide Explanation</span>
                <CaretUp size={12} weight="bold" />
              </>
            ) : (
              <>
                <span>Explain Math</span>
                <CaretDown size={12} weight="bold" />
              </>
            )}
          </span>
        </button>

        {showFormula && (
          <div className="mt-5 border-t border-foreground/10 pt-5 text-xs text-muted-foreground space-y-4">
            <p className="leading-relaxed">
              Every piece of land is given a score from <strong>0 to 100</strong> based on its environmental value.
              The overall score is simply the weighted average across the entire watershed:
            </p>
            <div className="rounded-xl border border-foreground/10 bg-background p-4 font-mono text-center text-foreground text-sm overflow-x-auto">
              Health Score = Sum of (Area of each Land Type × Health Weight) ÷ Total Area
            </div>
            <div className="overflow-x-auto rounded-xl border border-foreground/10 mt-3">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-foreground/[0.04] text-foreground border-b border-foreground/10">
                  <tr>
                    <th className="p-2.5">Land Type</th>
                    <th className="p-2.5">Health Weight</th>
                    <th className="p-2.5">Area</th>
                    <th className="p-2.5">Why It Matters</th>
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
              * Clouds and unclassified pixels are excluded to keep the score accurate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
