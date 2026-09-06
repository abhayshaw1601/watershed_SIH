"use client";

import { useState } from "react";
import type { SiteMeta } from "@/lib/watershed-data";
import { rgbToCss } from "@/lib/watershed-data";
import { Lightbulb, X, ArrowRight } from "@phosphor-icons/react";

export default function ChangeTab({ site, meta }: { site: string; meta: SiteMeta }) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [blendMode, setBlendMode] = useState<"change" | "overlay-t2" | "overlay-t1">("change");
  const [opacity, setOpacity] = useState<number>(85);
  const [showExplanation, setShowExplanation] = useState<boolean>(true);

  if (!meta.has_change_pair || !meta.change_summary || !meta.change_class_colors) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-10 text-center text-sm text-muted-foreground">
        This is a single-date, training-only site (no T1→T2 pair) — no multi-year change comparison available.
        Select Kadwanchi Watershed or enter custom coordinates for live change analysis.
      </div>
    );
  }

  const rows = Object.entries(meta.change_summary);
  const total = rows.reduce((sum, [, v]) => sum + v.hectares, 0);
  const nameToCls: Record<string, string> = {};
  for (const [cls, n] of Object.entries(meta.change_class_names ?? {})) nameToCls[n] = cls;

  // Filter descriptions for each class
  const classDescriptions: Record<string, { desc: string; action: string }> = {
    "1": {
      desc: "New standing water or check dam retention basin formed between T1 and T2.",
      action: "Log as positive watershed intervention; record GPS for asset maintenance registry.",
    },
    "2": {
      desc: "New impervious built-up surface or building construction detected on previous soil/green cover.",
      action: "Field audit recommended to verify whether construction conforms to watershed zoning laws.",
    },
    "3": {
      desc: "Severe topsoil stripping, severe gully expansion, or permanent waterbody drying.",
      action: "Priority zone for earthen gully plugs, loose boulder structures, or vetiver grass contouring.",
    },
    "4": {
      desc: "Successful greening: previous barren or fallow ground converted to dense tree canopy or perennial crops.",
      action: "Successful afforestation zone; monitor sapling survival into subsequent dry seasons.",
    },
  };

  const filteredRows = activeFilter === "all"
    ? rows
    : rows.filter(([name]) => nameToCls[name] === activeFilter || name === "No change");

  return (
    <div className="space-y-6">
      {/* Educational Banner: Why Land Cover shows more, but Change shows focused */}
      {showExplanation && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-5 shadow-xs transition-all relative">
          <button
            onClick={() => setShowExplanation(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xs font-mono flex items-center gap-1 cursor-pointer"
            title="Dismiss explanation"
          >
            <span>Dismiss</span>
            <X size={12} weight="bold" />
          </button>
          <div className="flex items-start gap-3.5 pr-8">
            <Lightbulb size={22} className="text-amber shrink-0 mt-0.5" weight="bold" />
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <strong className="text-foreground text-sm block">
                Understanding Watershed Change Detection vs. Land Cover Differences
              </strong>
              <p className="leading-relaxed">
                On the <strong>Land Cover</strong> tab, sliding between T1 and T2 shows large color shifts across agricultural
                fields. In Indian agrarian landscapes, crops are planted in the Kharif monsoon and harvested before the Rabi dry season,
                temporarily leaving fields as bare fallow soil.
              </p>
              <p className="leading-relaxed">
                <strong>Why doesn&apos;t this tab flag those as deforestation or degradation?</strong> Routine crop harvesting is
                normal seasonal farming, not environmental destruction. If seasonal cycles were flagged, the dashboard would produce
                over <strong>75% false alarms</strong>. The AI change engine intentionally filters out crop rotations and single-pixel
                jitter (minimum mappable unit: 1,200 m²), displaying <strong>strictly permanent, structural transitions</strong> within
                the watershed basin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Grid: Image Canvas + Controls */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Left: Interactive Map Viewer with Layer Blending */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10 bg-black/40 shadow-sm select-none">
            {/* Base Satellite / Land Cover image depending on mode */}
            {blendMode === "overlay-t2" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/demo-data/${site}/t2.png`}
                alt="T2 Recent Satellite"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {blendMode === "overlay-t1" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/demo-data/${site}/t1.png`}
                alt="T1 Baseline Satellite"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {/* Change Overlay Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/demo-data/${site}/change.png`}
              alt="Change detection map"
              style={{
                opacity: blendMode === "change" ? 1 : opacity / 100,
                filter: activeFilter !== "all" ? "contrast(1.15)" : "none",
              }}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
            />

            {/* Corner Metadata Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground border border-foreground/10">
                T1: {meta.t1_date || "2020"} → T2: {meta.t2_date || "2025"}
              </span>
              {blendMode !== "change" && (
                <span className="rounded-full bg-sky-500/80 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] uppercase text-white">
                  Blend {opacity}%
                </span>
              )}
            </div>

            {activeFilter !== "all" && (
              <div className="absolute bottom-3 left-3 rounded-full bg-foreground/90 backdrop-blur-md px-3 py-1 font-mono text-[10px] uppercase text-background">
                Focusing on: {meta.change_class_names?.[activeFilter]}
              </div>
            )}
          </div>

          {/* Layer View Mode & Opacity Blend Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground uppercase">Display View:</span>
              <div className="flex rounded-lg border border-foreground/15 p-0.5 bg-background">
                <button
                  type="button"
                  onClick={() => setBlendMode("change")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    blendMode === "change" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Change Map
                </button>
                <button
                  type="button"
                  onClick={() => setBlendMode("overlay-t2")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    blendMode === "overlay-t2" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Overlay on T2 (2025)
                </button>
                <button
                  type="button"
                  onClick={() => setBlendMode("overlay-t1")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    blendMode === "overlay-t1" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Overlay on T1 (2020)
                </button>
              </div>
            </div>

            {blendMode !== "change" && (
              <div className="flex items-center gap-2 w-48">
                <span className="font-mono text-[10px] text-muted-foreground">Opacity:</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-foreground cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Interactive Transition Class Filter & Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Transition Breakdown
            </div>
            {activeFilter !== "all" && (
              <button
                onClick={() => setActiveFilter("all")}
                className="font-mono text-[11px] text-sky-400 hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Clickable Filter Chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all cursor-pointer border ${
                activeFilter === "all"
                  ? "border-foreground bg-foreground text-background font-semibold"
                  : "border-foreground/10 bg-background text-muted-foreground hover:border-foreground/30"
              }`}
            >
              All Changes
            </button>
            {rows
              .filter(([name]) => name !== "No change")
              .map(([name]) => {
                const clsIdx = nameToCls[name] ?? "0";
                const isSelected = activeFilter === clsIdx;
                const color = meta.change_class_colors?.[clsIdx];
                return (
                  <button
                    key={clsIdx}
                    onClick={() => setActiveFilter(clsIdx)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all cursor-pointer border ${
                      isSelected
                        ? "border-foreground bg-foreground/15 text-foreground font-semibold shadow-xs"
                        : "border-foreground/10 bg-background text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {color && <span className="h-2 w-2 rounded-full" style={{ background: rgbToCss(color) }} />}
                    <span>{name}</span>
                  </button>
                );
              })}
          </div>

          {/* Change Summary Rows */}
          <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background">
            {filteredRows.map(([name, stats], i) => {
              const clsIdx = nameToCls[name] ?? "0";
              const color = meta.change_class_colors?.[clsIdx];
              const pct = total > 0 ? ((stats.hectares / total) * 100).toFixed(1) : "0.0";
              const isSelected = activeFilter === clsIdx;
              const isNoChange = name === "No change";

              return (
                <div
                  key={name}
                  onClick={() => !isNoChange && setActiveFilter(clsIdx)}
                  className={`flex flex-col gap-1 p-3.5 transition-colors ${
                    !isNoChange ? "cursor-pointer hover:bg-foreground/[0.02]" : ""
                  } ${isSelected ? "bg-foreground/5 border-l-2 border-foreground" : ""} ${
                    i !== filteredRows.length - 1 ? "border-b border-foreground/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {color && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: rgbToCss(color) }}
                        />
                      )}
                      <span className={`truncate text-sm ${isSelected ? "font-bold text-foreground" : ""}`}>
                        {name}
                      </span>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {stats.hectares} ha <span className="text-foreground/40">· {pct}%</span>
                    </div>
                  </div>

                  {/* Context note for selected class */}
                  {classDescriptions[clsIdx] && (isSelected || activeFilter === "all") && (
                    <div className="mt-1 text-[11px] text-muted-foreground/80 pl-5.5 space-y-0.5">
                      <p>{classDescriptions[clsIdx].desc}</p>
                      {isSelected && (
                        <p className="text-sage font-medium pt-0.5 flex items-center gap-1.5">
                          <ArrowRight size={12} className="text-sage shrink-0" weight="bold" />
                          <span>{classDescriptions[clsIdx].action}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
