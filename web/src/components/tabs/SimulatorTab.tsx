"use client";

import { useMemo, useState } from "react";
import type { SiteMeta } from "@/lib/watershed-data";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  Sliders,
  Drop,
  Tree,
  Plant,
  ShieldCheck,
  TrendUp,
  ArrowClockwise,
  Lightning,
  CheckCircle,
  Sparkle,
  ArrowRight,
} from "@phosphor-icons/react";

export default function SimulatorTab({ meta }: { meta: SiteMeta }) {
  // Policy Sliders
  const [checkDams, setCheckDams] = useState(0); // 0 to 8 structures
  const [ridgeAfforestation, setRidgeAfforestation] = useState(0); // 0 to 180 ha
  const [contourBunding, setContourBunding] = useState(0); // 0 to 250 ha
  const [farmPonds, setFarmPonds] = useState(0); // 0 to 12 ponds

  // Baseline land cover areas (hectares)
  const breakdown = meta.class_breakdown || {};
  const waterHa = breakdown["0"]?.hectares || 0;
  const forestHa = breakdown["1"]?.hectares || 0;
  const agriHa = breakdown["2"]?.hectares || 0;
  const sparseHa = breakdown["3"]?.hectares || 0;
  const barrenHa = breakdown["4"]?.hectares || 0;
  const builtHa = breakdown["5"]?.hectares || 0;
  const fallowHa = breakdown["6"]?.hectares || 0;

  const totalValidHa = Math.max(1, waterHa + forestHa + agriHa + sparseHa + barrenHa + builtHa + fallowHa);

  // Dynamic limits based on active radius and spatial extent
  const radiusKm = meta.radius_km || 2.0;
  const maxDams = Math.max(4, Math.min(32, Math.round(radiusKm * 3.5)));
  const maxPonds = Math.max(6, Math.min(60, Math.round(radiusKm * 5.0)));
  const maxAfforestation = Math.max(10, Math.round(barrenHa > 0 ? barrenHa : totalValidHa * 0.15));
  const maxBunding = Math.max(10, Math.round(fallowHa > 0 ? fallowHa : totalValidHa * 0.20));

  // Baseline weighted score
  const baselineScore = meta.health_score ?? 67.9;

  // Active Simulation Check
  const isSimulating = checkDams > 0 || ridgeAfforestation > 0 || contourBunding > 0 || farmPonds > 0;

  // Dynamic Calculation of Simulated Score & Yields
  const {
    simulatedScore,
    scoreDiff,
    waterRechargedML,
    soilSavedTonnes,
    waterTableRiseM,
    droughtRiskReductionPct,
    simWaterHa,
    simForestHa,
    simBarrenHa,
    simAgriHa,
  } = useMemo(() => {
    // Check dams: each adds ~1.5 ha effective water pool & captures runoff
    const addedWaterHa = checkDams * 1.5 + farmPonds * 0.8;
    // Afforestation shifts barren to dense forest
    const shiftedForestHa = Math.min(barrenHa, ridgeAfforestation);
    // Contour bunding stabilizes fallow into productive agriculture
    const shiftedAgriHa = Math.min(fallowHa, contourBunding);

    const newWater = waterHa + addedWaterHa;
    const newForest = forestHa + shiftedForestHa;
    const newAgri = agriHa + shiftedAgriHa;
    const newBarren = Math.max(0, barrenHa - shiftedForestHa);
    const newFallow = Math.max(0, fallowHa - shiftedAgriHa);

    // Weights from IWDP standard
    const weights: Record<string, number> = {
      water: 100,
      forest: 90,
      agri: 70,
      sparse: 55,
      fallow: 35,
      built: 20,
      barren: 10,
    };

    const weightedSum =
      newWater * weights.water +
      newForest * weights.forest +
      newAgri * weights.agri +
      sparseHa * weights.sparse +
      newFallow * weights.fallow +
      builtHa * weights.built +
      newBarren * weights.barren;

    const simScore = Math.min(100, Math.max(0, Number((weightedSum / totalValidHa).toFixed(1))));
    const diff = Number((simScore - baselineScore).toFixed(1));

    // Check dam: ~22.5 ML recharge/yr; Farm pond: ~10.5 ML recharge/yr; Contour bunding: ~0.08 ML/ha
    const rechargedML = Number(
      (checkDams * 22.5 + farmPonds * 10.5 + contourBunding * 0.08 + ridgeAfforestation * 0.05).toFixed(1)
    );

    // Soil conserved: afforestation ~12 t/ha/yr saved, contour bunding ~8 t/ha/yr saved, check dam ~45 t/yr trapped
    const soilSaved = Number(
      (ridgeAfforestation * 12 + contourBunding * 8 + checkDams * 45).toFixed(0)
    );

    // Water table rise estimate (m) based on recharge over total catchment area (specific yield Sy ~ 0.03 for hard-rock Deccan traps)
    const rechargeM3 = rechargedML * 1000;
    const catchmentAreaM2 = totalValidHa * 10000;
    const sy = 0.03;
    const riseM = Number(Math.min(4.5, (rechargeM3 / (catchmentAreaM2 * sy))).toFixed(2));

    // Drought risk reduction percentage (capped at 75%)
    const droughtReduction = Math.min(
      75,
      Math.round(
        (checkDams * 4.5 +
          farmPonds * 2.2 +
          (contourBunding / totalValidHa) * 40 +
          (ridgeAfforestation / totalValidHa) * 35) *
          1.2
      )
    );

    return {
      simulatedScore: simScore,
      scoreDiff: diff,
      waterRechargedML: rechargedML,
      soilSavedTonnes: soilSaved,
      waterTableRiseM: riseM,
      droughtRiskReductionPct: droughtReduction,
      simWaterHa: Number(newWater.toFixed(1)),
      simForestHa: Number(newForest.toFixed(1)),
      simBarrenHa: Number(newBarren.toFixed(1)),
      simAgriHa: Number(newAgri.toFixed(1)),
    };
  }, [
    checkDams,
    ridgeAfforestation,
    contourBunding,
    farmPonds,
    waterHa,
    forestHa,
    agriHa,
    sparseHa,
    barrenHa,
    builtHa,
    fallowHa,
    totalValidHa,
    baselineScore,
  ]);

  // Strategy Presets adapted dynamically to active radius scale
  function applyPreset(type: "max_recharge" | "erosion_defense" | "balanced" | "reset") {
    switch (type) {
      case "max_recharge":
        setCheckDams(Math.max(2, Math.round(maxDams * 0.75)));
        setFarmPonds(Math.max(3, Math.round(maxPonds * 0.8)));
        setRidgeAfforestation(Math.round(maxAfforestation * 0.25));
        setContourBunding(Math.round(maxBunding * 0.4));
        break;
      case "erosion_defense":
        setCheckDams(Math.max(1, Math.round(maxDams * 0.4)));
        setFarmPonds(Math.max(1, Math.round(maxPonds * 0.2)));
        setRidgeAfforestation(Math.round(maxAfforestation * 0.8));
        setContourBunding(Math.round(maxBunding * 0.85));
        break;
      case "balanced":
        setCheckDams(Math.max(2, Math.round(maxDams * 0.5)));
        setFarmPonds(Math.max(2, Math.round(maxPonds * 0.5)));
        setRidgeAfforestation(Math.round(maxAfforestation * 0.5));
        setContourBunding(Math.round(maxBunding * 0.5));
        break;
      case "reset":
        setCheckDams(0);
        setFarmPonds(0);
        setRidgeAfforestation(0);
        setContourBunding(0);
        break;
    }
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Top Banner: Overview & Strategy Presets */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 pb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders size={14} className="text-sage shrink-0" weight="bold" />
              <span>Hydrological Decision Support &amp; Policy Modeling</span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-foreground">
              What-If Watershed Policy Simulator
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Simulate proposed physical watershed interventions to project catchment health score gains,
              aquifer recharge volumes, and soil loss prevention before allocating public budgets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground mr-1">Strategy Presets:</span>
            <button
              onClick={() => applyPreset("max_recharge")}
              className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-mono text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Drop size={12} weight="bold" />
              <span>Max Recharge</span>
            </button>
            <button
              onClick={() => applyPreset("erosion_defense")}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-mono text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ShieldCheck size={12} weight="bold" />
              <span>Erosion Defense</span>
            </button>
            <button
              onClick={() => applyPreset("balanced")}
              className="rounded-lg border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs font-mono text-sage hover:bg-sage/20 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sparkle size={12} weight="bold" />
              <span>Balanced IWDP</span>
            </button>
            {isSimulating && (
              <button
                onClick={() => applyPreset("reset")}
                className="rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowClockwise size={12} weight="bold" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Score Projection Hero */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-foreground/10 bg-background p-4 text-center min-w-[7rem]">
              <span className="font-mono text-[10px] text-muted-foreground uppercase block">Baseline Score</span>
              <span className="font-display text-2xl font-bold text-muted-foreground mt-1 block">
                {baselineScore}
              </span>
            </div>

            <ArrowRight size={20} className="text-muted-foreground shrink-0" weight="bold" />

            <div className="rounded-2xl border border-sage/40 bg-sage/10 p-4 text-center min-w-[8rem] shadow-xs">
              <span className="font-mono text-[10px] text-sage uppercase block font-semibold">Simulated Health</span>
              <span className="font-display text-3xl font-bold text-sage mt-1 block">
                {simulatedScore}
              </span>
            </div>

            {isSimulating && (
              <Badge tone="sage" className="text-sm px-3 py-1 font-mono font-bold">
                +{scoreDiff} pts
              </Badge>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase">Annual Recharge</span>
              <span className="font-bold text-sky-400 text-sm mt-0.5 block">+{waterRechargedML} ML</span>
              <span className="text-[10px] text-muted-foreground">Million Litres</span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase">Soil Conserved</span>
              <span className="font-bold text-amber-400 text-sm mt-0.5 block">-{soilSavedTonnes} t/yr</span>
              <span className="text-[10px] text-muted-foreground">Tonnes/year</span>
            </div>
            <div className="rounded-xl border border-sage/20 bg-sage/5 p-3 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase">Water Table Rise</span>
              <span className="font-bold text-sage text-sm mt-0.5 block">+{waterTableRiseM}m</span>
              <span className="text-[10px] text-muted-foreground">Aquifer depth</span>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase">Drought Buffer</span>
              <span className="font-bold text-purple-400 text-sm mt-0.5 block">+{droughtRiskReductionPct}%</span>
              <span className="text-[10px] text-muted-foreground">Resilience</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Policy Sliders & Comparative Breakdown */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Interactive Policy Sliders */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Intervention Levers
                </span>
                <h3 className="font-display text-xl mt-1">Adjust Simulated Investments</h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground">Live 60 FPS Engine</span>
            </div>

            {/* Slider 1: Masonry Check Dams */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Drop size={14} className="text-sky-400" weight="bold" />
                  <span>Masonry Check Dams along Drainage Corridor</span>
                </span>
                <span className="font-mono text-sky-400 font-bold text-sm">+{checkDams} structures</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxDams}
                step={1}
                value={checkDams}
                onChange={(e) => setCheckDams(Number(e.target.value))}
                className="mt-3 w-full accent-sky-500 cursor-pointer"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>Intercepts peak gully discharge</span>
                <span>Max: {maxDams} dams for {radiusKm.toFixed(1)} km AOI</span>
              </div>
            </div>

            {/* Slider 2: Ridge Afforestation */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Tree size={14} className="text-emerald-400" weight="bold" />
                  <span>Upper Ridge Afforestation (Barren &rarr; Dense Forest)</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold text-sm">+{ridgeAfforestation} ha</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxAfforestation}
                step={Math.max(1, Math.round(maxAfforestation / 20))}
                value={ridgeAfforestation}
                onChange={(e) => setRidgeAfforestation(Number(e.target.value))}
                className="mt-3 w-full accent-emerald-500 cursor-pointer"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>Root-anchoring canopy interception</span>
                <span>Max: {maxAfforestation} ha ({barrenHa > 0 ? "barren land" : "target zone"})</span>
              </div>
            </div>

            {/* Slider 3: Contour Bunding */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <ShieldCheck size={14} className="text-amber-400" weight="bold" />
                  <span>Continuous Contour Trenching (CCT) &amp; Fallow Terracing</span>
                </span>
                <span className="font-mono text-amber-400 font-bold text-sm">+{contourBunding} ha</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxBunding}
                step={Math.max(1, Math.round(maxBunding / 20))}
                value={contourBunding}
                onChange={(e) => setContourBunding(Number(e.target.value))}
                className="mt-3 w-full accent-amber-500 cursor-pointer"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>Halts progressive sheet wash on slopes</span>
                <span>Max: {maxBunding} ha ({fallowHa > 0 ? "fallow land" : "target area"})</span>
              </div>
            </div>

            {/* Slider 4: Farm Percolation Ponds */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Plant size={14} className="text-sage" weight="bold" />
                  <span>Individual Farm Percolation Ponds (Rabi Irrigation)</span>
                </span>
                <span className="font-mono text-sage font-bold text-sm">+{farmPonds} ponds</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxPonds}
                step={1}
                value={farmPonds}
                onChange={(e) => setFarmPonds(Number(e.target.value))}
                className="mt-3 w-full accent-sage cursor-pointer"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>Micro-catchment rainfall harvesting</span>
                <span>Max: {maxPonds} ponds for {radiusKm.toFixed(1)} km AOI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Simulated Catchment Projection & ROI Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Land Cover Shift Matrix */}
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-xs">
            <div className="border-b border-foreground/10 pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
                Simulated Catchment Shift
              </span>
              <h4 className="font-display text-lg font-semibold mt-1">Land Cover Transitions</h4>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <Drop size={14} className="text-sky-400" weight="bold" />
                  <span className="text-foreground">Water Cover</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{waterHa.toFixed(1)} ha</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <strong className="text-sky-400">{simWaterHa} ha</strong>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <Tree size={14} className="text-emerald-400" weight="bold" />
                  <span className="text-foreground">Dense Forest</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{forestHa.toFixed(1)} ha</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <strong className="text-emerald-400">{simForestHa} ha</strong>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <Plant size={14} className="text-amber-400" weight="bold" />
                  <span className="text-foreground">Cropland</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{agriHa.toFixed(1)} ha</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <strong className="text-amber-400">{simAgriHa} ha</strong>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/5 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-rose-400" weight="bold" />
                  <span className="text-foreground">Barren Gully</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{barrenHa.toFixed(1)} ha</span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <strong className="text-sage">{simBarrenHa} ha</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Implementation ROI & Community Benefit */}
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 shadow-xs space-y-4">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
              Budget &amp; Feasibility Projection
            </span>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-foreground/10 pb-2">
                <span className="text-muted-foreground">Estimated Capital Outlay:</span>
                <strong className="text-foreground">
                  ~₹{(checkDams * 4.5 + farmPonds * 0.8 + ridgeAfforestation * 0.25 + contourBunding * 0.15).toFixed(1)} Lakhs
                </strong>
              </div>
              <div className="flex justify-between items-center border-b border-foreground/10 pb-2">
                <span className="text-muted-foreground">Beneficiary Farming Families:</span>
                <strong className="text-foreground">
                  ~{Math.round(checkDams * 38 + farmPonds * 12 + contourBunding * 1.5 + 45)} families
                </strong>
              </div>
              <div className="flex justify-between items-center border-b border-foreground/10 pb-2">
                <span className="text-muted-foreground">Payback in Groundwater Yield:</span>
                <strong className="text-sage">1.4 Monsoon Seasons</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">IWDP Technical Feasibility:</span>
                <Badge tone="sage">High Feasibility</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
