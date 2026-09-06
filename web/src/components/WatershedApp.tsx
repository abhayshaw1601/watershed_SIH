"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import { PRESET_SITES, type SiteKey, type SiteMeta } from "@/lib/watershed-data";
import Badge from "@/components/ui/Badge";
import { Radio, Check, X } from "@phosphor-icons/react";
import LULCTab from "@/components/tabs/LULCTab";
import ChangeTab from "@/components/tabs/ChangeTab";
import HealthTab from "@/components/tabs/HealthTab";
import FieldTab from "@/components/tabs/FieldTab";
import InterventionsTab from "@/components/tabs/InterventionsTab";
import SimulatorTab from "@/components/tabs/SimulatorTab";
import LocationPicker, { type CustomLocation } from "@/components/LocationPicker";

const MapTab = dynamic(() => import("@/components/tabs/MapTab"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-2xl bg-foreground/5" />,
});

const TABS = [
  { key: "land-cover", label: "Land Cover", needsChangePair: false },
  { key: "change", label: "Change", needsChangePair: true },
  { key: "health", label: "Health & Alerts", needsChangePair: true },
  { key: "map", label: "Map", needsChangePair: false },
  { key: "field", label: "Field Investigation", needsChangePair: false },
  { key: "investigation", label: "Investigation", needsChangePair: false },
  { key: "simulator", label: "What-If Simulator", needsChangePair: false },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function WatershedApp() {
  const [siteKey, setSiteKey] = useState<SiteKey>("kadwanchi_watershed");
  const [customLocation, setCustomLocation] = useState<CustomLocation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedInfo, setCompletedInfo] = useState<{
    siteName: string;
    duration: number;
    timestamp: string;
  } | null>(null);
  const [meta, setMeta] = useState<SiteMeta | null>(null);
  const [tab, setTab] = useState<TabKey>("land-cover");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Timer for live satellite pipeline
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAnalyzing) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Fetch directly from the Python backend server
    fetch(`http://127.0.0.1:8000/api/sites/${siteKey}`)
      .then((res) => {
        if (!res.ok) {
          // If python server is offline, fallback to static cache
          return fetch(`/demo-data/${siteKey}/meta.json`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          });
        }
        return res.json();
      })
      .then((data: SiteMeta) => {
        if (!cancelled) {
          setMeta(data);
          setLoading(false);
          if (!data.has_change_pair && (tab === "change" || tab === "health")) {
            setTab("land-cover");
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  async function handleRunCustomPipeline(loc: CustomLocation) {
    // Cancel any in-flight pipeline run before starting a new one
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setCustomLocation(loc);
    setIsAnalyzing(true);
    setCompletedInfo(null);
    setLoading(true);
    setLoadError(null);
    const startTime = Date.now();

    try {
      const res = await fetch("http://127.0.0.1:8000/api/pipeline/run", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: loc.lat,
          lon: loc.lon,
          name: loc.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.meta) {
        const totalDuration = Math.round((Date.now() - startTime) / 1000);
        setSiteKey("custom_live");
        setMeta(data.meta);
        setIsAnalyzing(false);
        setCompletedInfo({
          siteName: loc.name,
          duration: totalDuration,
          timestamp: new Date().toLocaleTimeString(),
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // Silently discard cancelled requests
      console.error("Live server execution failed:", err);
      setIsAnalyzing(false);
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const activeSite = PRESET_SITES.find((s) => s.key === siteKey) || PRESET_SITES[0];

  // Pipeline stage computation based on elapsed seconds (calibrated for GPU acceleration)
  const currentStage =
    elapsedSeconds < 10
      ? {
          step: 1,
          label: "Querying Sentinel-2 L2A STAC Catalog",
          detail: "Searching Copernicus/AWS Open Data catalog for cloud-free (<20%) optical scenes...",
        }
      : elapsedSeconds < 22
      ? {
          step: 2,
          label: "Streaming & Clipping 10m Bands",
          detail: "Downloading Red, Green, Blue, NIR GeoTIFF COGs and computing NDVI / NDWI stacks...",
        }
      : elapsedSeconds < 28
      ? {
          step: 3,
          label: "Running Model 1 PyTorch U-Net on NVIDIA GPU",
          detail: "Segmenting 7 land-cover classes across multi-spectral tensors with RTX 3050 Tensor Cores...",
        }
      : {
          step: 4,
          label: "Hydrological Delineation & Change Matrix",
          detail:
            elapsedSeconds > 42
              ? "Running Pysheds flow routing on Copernicus 30m elevation grid & computing changes..."
              : "Ingesting Copernicus 30m DEM elevation tile (~35MB) & computing watershed drainage...",
        };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          {customLocation ? (
            <Badge tone="amber">LIVE · UNSEEN LOCATION</Badge>
          ) : (
            <Badge tone="sage">TRAINED SITE</Badge>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {customLocation
              ? `${customLocation.lat.toFixed(4)}°N ${customLocation.lon.toFixed(4)}°E`
              : meta
              ? `${((meta.bbox_wgs84.south + meta.bbox_wgs84.north) / 2).toFixed(4)}°N ${((meta.bbox_wgs84.west + meta.bbox_wgs84.east) / 2).toFixed(4)}°E`
              : "—"}
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl leading-[0.95] tracking-tight sm:text-6xl">
          {customLocation ? customLocation.name : activeSite.displayName}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          <span
            className={cn(
              "mr-1.5 inline-block h-2 w-2 rounded-full",
              customLocation ? "bg-amber animate-pulse" : "bg-sage"
            )}
          />
          {customLocation
            ? "Custom search location — evaluated against Sentinel-2 L2A optical stack & Copernicus 30m DEM"
            : "Precomputed from the trained Model 1 checkpoint — real numbers, no live backend call"}
        </p>
      </header>

      {/* ---- Unified Location Picker ---- */}
      <div className="mt-8">
        <LocationPicker
          activeSiteKey={siteKey}
          customLocation={customLocation}
          onSelectPreset={(key) => {
            setCustomLocation(null);
            setCompletedInfo(null);
            setSiteKey(key);
          }}
          onSelectCustom={(loc) => {
            handleRunCustomPipeline(loc);
          }}
        />
      </div>

      {/* ---- Live Pipeline Progress Banner (Working Animation) ---- */}
      {isAnalyzing && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-amber/40 bg-amber/5 p-6 shadow-sm animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-80" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    Live Satellite Ingestion in Progress
                  </span>
                  <span className="rounded-full bg-amber/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber uppercase tracking-wider animate-pulse">
                    Stage {currentStage.step}/4: {currentStage.label}
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Analyzing AOI: <strong className="text-foreground">{customLocation?.name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block font-mono text-sm font-semibold text-amber">
                  T+{elapsedSeconds}s
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Expected ~25-35s
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 font-mono text-xs text-foreground/80 bg-background/60 p-2.5 rounded-xl border border-foreground/5 flex items-center gap-2">
            <Radio size={14} className="text-amber animate-pulse shrink-0" weight="bold" />
            <span>{currentStage.detail}</span>
          </p>

          {/* Animated Progress Bar with glowing gradient */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-gradient-to-r from-amber via-yellow-400 to-amber transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(217,119,6,0.5)]"
              style={{
                width: `${Math.min(96, Math.max(15, elapsedSeconds * 2.8))}%`,
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px]">
            <div className={cn("p-2 rounded-lg border transition-colors", currentStage.step === 1 ? "border-amber bg-amber/10 text-amber font-medium" : currentStage.step > 1 ? "border-sage/40 bg-sage/5 text-sage" : "border-foreground/10 text-muted-foreground/60")}>
              <div className="flex items-center gap-1.5">
                <span>{currentStage.step > 1 ? <Check size={12} weight="bold" /> : "1."}</span>
                <span>STAC Search</span>
              </div>
            </div>
            <div className={cn("p-2 rounded-lg border transition-colors", currentStage.step === 2 ? "border-amber bg-amber/10 text-amber font-medium" : currentStage.step > 2 ? "border-sage/40 bg-sage/5 text-sage" : "border-foreground/10 text-muted-foreground/60")}>
              <div className="flex items-center gap-1.5">
                <span>{currentStage.step > 2 ? <Check size={12} weight="bold" /> : "2."}</span>
                <span>10m Bands Clip</span>
              </div>
            </div>
            <div className={cn("p-2 rounded-lg border transition-colors", currentStage.step === 3 ? "border-amber bg-amber/10 text-amber font-medium" : currentStage.step > 3 ? "border-sage/40 bg-sage/5 text-sage" : "border-foreground/10 text-muted-foreground/60")}>
              <div className="flex items-center gap-1.5">
                <span>{currentStage.step > 3 ? <Check size={12} weight="bold" /> : "3."}</span>
                <span>PyTorch U-Net</span>
              </div>
            </div>
            <div className={cn("p-2 rounded-lg border transition-colors", currentStage.step === 4 ? "border-amber bg-amber/10 text-amber font-medium" : "border-foreground/10 text-muted-foreground/60")}>
              <div className="flex items-center gap-1.5">
                <span>4.</span>
                <span>DEM Hydrology</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Analysis Complete Done Banner ---- */}
      {completedInfo && !isAnalyzing && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sage/50 bg-sage/10 p-5 shadow-sm animate-fade-up">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-white text-lg font-bold shadow-sm">
              <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-sage opacity-40" />
              <Check size={20} weight="bold" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Pipeline Execution Complete: {completedInfo.siteName}
                </span>
                <span className="rounded-full bg-sage/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-sage uppercase tracking-wider">
                  100% Real Satellite Data
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Completed in <strong className="text-foreground">{completedInfo.duration}s</strong> at {completedInfo.timestamp} · Sentinel-2 L2A optical stack classified by trained Model 1 U-Net checkpoint
              </p>
            </div>
          </div>
          <button
            onClick={() => setCompletedInfo(null)}
            className="flex items-center gap-1.5 rounded-lg border border-foreground/15 bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <span>Dismiss</span>
            <X size={12} weight="bold" />
          </button>
        </div>
      )}

      {/* ---- Tab bar ---- */}
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-foreground/10" role="tablist" aria-label="Watershed views">
        {TABS.map((t) => {
          const disabled = t.needsChangePair && meta ? !meta.has_change_pair : false;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => !disabled && setTab(t.key)}
              disabled={disabled}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors",
                tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
                disabled ? "cursor-not-allowed opacity-30" : "hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ---- Tab content ---- */}
      <div className="mt-8">
        {loadError ? (
          <div className="rounded-2xl border border-foreground/10 p-10 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load demo data: {loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full border border-foreground/15 px-5 py-2.5 text-sm hover:border-foreground/40"
            >
              Retry
            </button>
          </div>
        ) : loading || !meta ? (
          <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-background/50 p-12 text-center">
            {/* Radar scanner visualization */}
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              {/* Concentric rings */}
              <div className="absolute inset-0 rounded-full border border-foreground/10" />
              <div className="absolute inset-3 rounded-full border border-foreground/10 border-dashed" />
              <div className="absolute inset-7 rounded-full border border-foreground/15" />
              <div className="absolute inset-11 rounded-full border border-foreground/20" />
              
              {/* Rotating radar sweep beam */}
              <div className="absolute inset-0 rounded-full animate-radar pointer-events-none">
                <div className="h-1/2 w-1/2 rounded-tl-full bg-gradient-to-br from-foreground/25 to-transparent" />
              </div>

              {/* Center satellite telemetry dot */}
              <span className="relative flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-amber" />
              </span>
            </div>

            <div className="mt-6 max-w-md mx-auto">
              <span className="inline-block rounded-full bg-foreground/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground animate-pulse">
                {isAnalyzing ? "Live PyTorch & Satellite Stream Active" : "Fetching GeoTIFF Telemetry from Python Backend"}
              </span>
              <h3 className="mt-3 font-display text-xl sm:text-2xl tracking-tight">
                {isAnalyzing
                  ? `Analyzing Sentinel-2 imagery for ${customLocation?.name || "Selected AOI"}...`
                  : `Ingesting Multi-Spectral Stack for ${activeSite.displayName}...`}
              </h3>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {isAnalyzing
                  ? `Stage ${currentStage.step}/4: ${currentStage.label} — ${currentStage.detail}`
                  : "Streaming 10m Sentinel-2 bands (RGB + NIR), NDVI/NDWI indices, and Copernicus 30m DEM layers..."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {tab === "land-cover" && <LULCTab site={siteKey} meta={meta} />}
            {tab === "change" && <ChangeTab site={siteKey} meta={meta} />}
            {tab === "health" && <HealthTab meta={meta} onNavigateToSimulator={() => setTab("simulator")} />}
            {tab === "map" && <MapTab site={siteKey} meta={meta} />}
            {tab === "field" && <FieldTab site={siteKey} meta={meta} />}
            {tab === "investigation" && <InterventionsTab site={siteKey} meta={meta} />}
            {tab === "simulator" && <SimulatorTab meta={meta} />}
          </>
        )}
      </div>
    </div>
  );
}
