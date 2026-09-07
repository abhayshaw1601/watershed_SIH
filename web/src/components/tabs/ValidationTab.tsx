"use client";

import Badge from "@/components/ui/Badge";
import { CheckCircle, ShieldCheck, Target, ChartLineUp, FileText, Database } from "@phosphor-icons/react";

const LULC_METRICS = [
  { name: "Water body / conservation structure", support: "1,490", precision: "0.917", recall: "0.953", iou: "0.878", f1: "0.935" },
  { name: "Dense vegetation / forest", support: "4,215", precision: "0.914", recall: "0.913", iou: "0.842", f1: "0.914" },
  { name: "Agriculture / cropland", support: "9,545", precision: "0.893", recall: "0.882", iou: "0.799", f1: "0.887" },
  { name: "Sparse vegetation / grassland", support: "3,660", precision: "0.718", recall: "0.724", iou: "0.565", f1: "0.721" },
  { name: "Barren / degraded land", support: "1,455", precision: "0.654", recall: "0.632", iou: "0.478", f1: "0.643" },
  { name: "Built-up / settlement", support: "1,112", precision: "0.698", recall: "0.701", iou: "0.536", f1: "0.700" },
  { name: "Fallow / bare agricultural land", support: "572", precision: "0.490", recall: "0.420", iou: "0.297", f1: "0.452" },
];

export default function ValidationTab() {
  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
              Scientific Audit &amp; Performance Telemetry
            </span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Model &amp; System Validation Report
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="sage">VERIFIED INDEPENDENTLY</Badge>
            <Badge tone="neutral">PS-26015 BENCHMARK</Badge>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Validation metrics turning experimental prototypes into defensible operational indicators.
          Evaluated across ground-truth holdout splits, 20 manually verified reference change patches,
          and geo-tagged field photo inspections.
        </p>
      </div>

      {/* Top Readout Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-foreground/10 bg-background p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
            Model 1 Pixel Accuracy
          </span>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-sage">82.6%</div>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">Holdout test set</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
            Model 1 Mean IoU
          </span>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-sage">61.4%</div>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">7-class average</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
            Change Detection F1
          </span>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-teal">0.911</div>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">20 verified regions</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
            Field Photo Agreement
          </span>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-bold text-sage">86.7%</div>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">13 / 15 audited points</p>
        </div>
      </div>

      {/* Section 1: Model 1 Per-Class Performance Table */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.015] p-6">
        <div className="flex items-center justify-between border-b border-foreground/10 pb-4 mb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
              Classification Rigor
            </span>
            <h3 className="font-display text-xl font-bold text-foreground">
              Model 1 Land Use / Land Cover Per-Class Metrics
            </h3>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Trained U-Net (ResNet18 Backbone · 10m Ground Resolution)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-foreground/15 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4 font-semibold">Land Cover Class</th>
                <th className="pb-3 px-3 font-semibold text-right">Support (px)</th>
                <th className="pb-3 px-3 font-semibold text-right">Precision</th>
                <th className="pb-3 px-3 font-semibold text-right">Recall</th>
                <th className="pb-3 px-3 font-semibold text-right">IoU</th>
                <th className="pb-3 pl-3 font-semibold text-right">F1 Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {LULC_METRICS.map((row, idx) => (
                <tr key={idx} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="py-3 pr-4 font-sans font-medium text-foreground">{row.name}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{row.support}</td>
                  <td className="py-3 px-3 text-right font-medium text-foreground">{row.precision}</td>
                  <td className="py-3 px-3 text-right font-medium text-foreground">{row.recall}</td>
                  <td className="py-3 px-3 text-right font-bold text-sage">{row.iou}</td>
                  <td className="py-3 pl-3 text-right font-medium text-foreground">{row.f1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Change Detection Validation */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.015] p-6">
        <div className="border-b border-foreground/10 pb-4 mb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
            Bi-Temporal Verification
          </span>
          <h3 className="font-display text-xl font-bold text-foreground">
            Change Detection Evaluation (20 Manually Verified Reference Regions)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Evaluated against hand-delineated ground truth patches covering new water structures, construction, vegetative canopy gain, and stable controls.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-foreground/10 bg-background p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Precision</span>
            <div className="font-mono text-lg font-bold text-foreground mt-1">0.897</div>
            <p className="text-[10px] text-muted-foreground">Low false alarm rate</p>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-background p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Recall</span>
            <div className="font-mono text-lg font-bold text-foreground mt-1">0.925</div>
            <p className="text-[10px] text-muted-foreground">High change capture sensitivity</p>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-background p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">F1 Score</span>
            <div className="font-mono text-lg font-bold text-sage mt-1">0.911</div>
            <p className="text-[10px] text-muted-foreground">Harmonic balance</p>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-background p-3">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Intersection / Union</span>
            <div className="font-mono text-lg font-bold text-sage mt-1">0.837</div>
            <p className="text-[10px] text-muted-foreground">Area overlap agreement</p>
          </div>
        </div>
      </div>

      {/* Section 3: Government Data Sources & Architectural Seam */}
      <div className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4">
        <div className="border-b border-foreground/10 pb-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
            Integration Seam Architecture
          </span>
          <h3 className="font-display text-xl font-bold text-foreground">
            Government Platform Compatibility &amp; Limitation Notice
          </h3>
        </div>

        <p className="text-xs text-foreground/90 leading-relaxed">
          Due to unavailable or unauthorized access to certain government datasets and APIs during development,
          this prototype uses equivalent open-access and reference datasets to demonstrate the analytical workflow.
          The data ingestion layer is designed to accept authorized SRISHTI-DRISHTI, Bhuvan, and Bhoonidhi data sources
          when access becomes available.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            <span className="text-muted-foreground text-[10px] uppercase block">Bhuvan Integration</span>
            <span className="font-semibold text-foreground">WMS / WCS 1:50k LULC</span>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">Plug-in driver maps NRSC 18-class scheme to 7 categories.</p>
          </div>

          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            <span className="text-muted-foreground text-[10px] uppercase block">SRISHTI-DRISHTI</span>
            <span className="font-semibold text-foreground">MGNREGA Asset REST API</span>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">Direct geo-coordinate ingestion into Intervention Registry.</p>
          </div>

          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            <span className="text-muted-foreground text-[10px] uppercase block">Bhoonidhi ISRO</span>
            <span className="font-semibold text-foreground">IRS LISS-IV / CartoDEM</span>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">Higher-resolution terrain &amp; spectral replacement rasters.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
