"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import { MagnifyingGlass, Crosshair, ArrowUpRight, Warning } from "@phosphor-icons/react";

export type CustomLocation = {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  isCustom: boolean;
};

const RADIUS_OPTIONS = [
  { value: 0.5, label: "0.5 km", desc: "Micro-Site (Immediate surroundings)" },
  { value: 1.0, label: "1.0 km", desc: "Local context" },
  { value: 2.0, label: "2.0 km (Standard)", desc: "Standard catchment focus (Default)" },
  { value: 5.0, label: "5.0 km", desc: "Broad regional catchment" },
] as const;

export default function LocationPicker({
  customLocation,
  onSelectCustom,
}: {
  activeSiteKey?: string;
  customLocation: CustomLocation | null;
  onSelectPreset?: (key: any) => void;
  onSelectCustom: (loc: CustomLocation) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<number>(customLocation?.radiusKm || 2.0);
  const [isCustomRadius, setIsCustomRadius] = useState(false);
  const [customRadiusValue, setCustomRadiusValue] = useState("2.0");

  const [showCoordInputs, setShowCoordInputs] = useState(false);
  const [customLat, setCustomLat] = useState("");
  const [customLon, setCustomLon] = useState("");
  const [coordRadius, setCoordRadius] = useState("2.0");

  // Keep search input and radius in sync when customLocation updates
  useEffect(() => {
    if (customLocation) {
      if (customLocation.name) {
        setSearchQuery(customLocation.name);
      }
      setSelectedRadius(customLocation.radiusKm);
      if (![0.5, 1.0, 2.0, 5.0].includes(customLocation.radiusKm)) {
        setIsCustomRadius(true);
        setCustomRadiusValue(String(customLocation.radiusKm));
      } else {
        setIsCustomRadius(false);
      }
      setCoordRadius(String(customLocation.radiusKm));
    }
  }, [customLocation]);

  const effectiveRadius = isCustomRadius
    ? Math.max(0.2, Math.min(25, parseFloat(customRadiusValue) || 2.0))
    : selectedRadius;

  function handleRadiusPresetClick(val: number) {
    setIsCustomRadius(false);
    setSelectedRadius(val);
    // If a location is currently active and radius is being changed, re-run analysis immediately!
    if (customLocation && customLocation.radiusKm !== val) {
      onSelectCustom({
        ...customLocation,
        radiusKm: val,
      });
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim();

    // If active location exists and query is empty or matches current location,
    // re-run pipeline with current effective radius without redundant external geocoding!
    if (customLocation && (!query || query.toLowerCase() === customLocation.name.toLowerCase())) {
      onSelectCustom({
        ...customLocation,
        radiusKm: effectiveRadius,
      });
      return;
    }

    if (!query) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      // Force English language in parameters and headers to avoid Hindi/Devanagari text
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=5&countrycodes=in&accept-language=en&namedetails=1`,
        {
          headers: {
            "User-Agent": "watershed-signal-sih2026-demo/1.0 (hackathon prototype)",
            "Accept-Language": "en-US,en;q=0.9",
          },
        }
      );

      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const data = await res.json();

      if (!data || data.length === 0) {
        setSearchError(`No Indian location matching "${query}" found.`);
        setIsSearching(false);
        return;
      }

      const place = data[0];
      const parsedLat = parseFloat(place.lat);
      const parsedLon = parseFloat(place.lon);

      // Strict English name extraction to avoid Hindi/Devanagari text
      const englishName =
        place.namedetails?.["name:en"] ||
        place.name ||
        place.display_name.split(",")[0].trim() ||
        query;

      onSelectCustom({
        name: englishName,
        lat: parsedLat,
        lon: parsedLon,
        radiusKm: effectiveRadius,
        isCustom: true,
      });
      setIsSearching(false);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Geocoding network error");
      setIsSearching(false);
    }
  }

  function handleCoordinateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = parseFloat(customLat);
    const lonNum = parseFloat(customLon);
    const radNum = parseFloat(coordRadius) || 2.0;

    if (isNaN(latNum) || isNaN(lonNum)) {
      setSearchError("Please provide valid numeric coordinates.");
      return;
    }

    onSelectCustom({
      name: `${latNum.toFixed(4)}°N, ${lonNum.toFixed(4)}°E`,
      lat: latNum,
      lon: lonNum,
      radiusKm: radNum,
      isCustom: true,
    });
  }

  return (
    <div className="space-y-6">
      {/* Search Header & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl sm:text-2xl tracking-tight">
            Select Watershed Area of Interest
          </h3>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Query Sentinel-2 imagery & Copernicus 30m DEM elevation for any location in India
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCoordInputs(!showCoordInputs)}
          className="font-mono text-xs text-foreground/80 hover:text-foreground underline underline-offset-4 flex items-center gap-1.5 cursor-pointer rounded-lg border border-foreground/15 px-3 py-1.5 bg-background hover:bg-foreground/5 transition-colors"
        >
          <Crosshair size={14} weight="bold" />
          <span>{showCoordInputs ? "Switch to Place Name Search" : "Enter Coordinates Directly"}</span>
          {!showCoordInputs && <ArrowUpRight size={12} weight="bold" />}
        </button>
      </div>

      {/* Place Search Form */}
      {!showCoordInputs ? (
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <MagnifyingGlass size={16} weight="bold" />
              </span>
              <input
                type="text"
                placeholder="Search any place in India (e.g. Ralegan Siddhi, Paithan, Hiware Bazar, Pune)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-foreground/15 bg-background pl-10 pr-4 py-3 text-sm outline-none focus:border-foreground transition-colors font-sans placeholder:text-muted-foreground/70"
              />
            </div>
            <Button type="submit" size="md" disabled={isSearching}>
              {isSearching ? "Searching..." : "Search & Ingest AOI"}
            </Button>
          </div>

          {/* Analysis Radius & Area Selection Controls */}
          <div className="rounded-xl border border-foreground/10 bg-background/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                — Analysis Radius & Spatial Extent
              </span>
              <span className="font-mono text-xs text-foreground/80">
                Active Radius: <strong className="text-foreground">{effectiveRadius.toFixed(1)} km</strong> (~{(Math.PI * effectiveRadius * effectiveRadius).toFixed(1)} km² area)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {RADIUS_OPTIONS.map((opt) => {
                const isSelected = !isCustomRadius && selectedRadius === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRadiusPresetClick(opt.value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 font-mono text-xs transition-all cursor-pointer",
                      isSelected
                        ? "border-foreground bg-foreground text-background shadow-sm font-semibold"
                        : "border-foreground/15 bg-background text-foreground/80 hover:border-foreground/40 hover:text-foreground"
                    )}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomRadius(true)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 font-mono text-xs transition-all cursor-pointer",
                  isCustomRadius
                    ? "border-foreground bg-foreground text-background shadow-sm font-semibold"
                    : "border-foreground/15 bg-background text-foreground/80 hover:border-foreground/40 hover:text-foreground"
                )}
              >
                Custom Radius...
              </button>

              {isCustomRadius && (
                <div className="flex items-center gap-2 animate-fade-up">
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="25"
                    value={customRadiusValue}
                    onChange={(e) => setCustomRadiusValue(e.target.value)}
                    className="w-20 rounded-lg border border-foreground/20 bg-background px-2.5 py-1 text-xs font-mono outline-none focus:border-foreground"
                  />
                  <span className="font-mono text-xs text-muted-foreground">km</span>
                  {customLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        const r = Math.max(0.2, Math.min(25, parseFloat(customRadiusValue) || 2.0));
                        onSelectCustom({
                          ...customLocation,
                          radiusKm: r,
                        });
                      }}
                      className="rounded-lg border border-foreground/30 bg-foreground text-background px-3 py-1 font-mono text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                      Apply Radius
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Caution Notice about Processing Time for Larger Radii */}
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-[11px] font-mono leading-relaxed transition-colors",
                effectiveRadius > 2.0
                  ? "border-amber/40 bg-amber/10 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.02] text-muted-foreground"
              )}
            >
              <Warning
                size={16}
                className={cn("shrink-0 mt-0.5", effectiveRadius > 2.0 ? "text-amber" : "text-muted-foreground")}
                weight="bold"
              />
              <div>
                <strong className={effectiveRadius > 2.0 ? "text-amber font-semibold" : "text-foreground"}>
                  Processing Time Notice:
                </strong>{" "}
                Bigger radius sizes (e.g. 5.0 km or custom &gt; 3.0 km) cover substantially larger spatial areas (~10,000+ ha) and require streaming expanded multi-spectral 10m Sentinel-2 bands and 30m DEM elevation tiles. Higher radius means higher processing time (~30–50s vs ~10–20s for smaller radii).
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Manual Coordinates Drawer with Radius input */
        <form
          onSubmit={handleCoordinateSubmit}
          className="rounded-2xl border border-foreground/15 bg-background/80 p-5 space-y-4 animate-fade-up"
        >
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            — Precise Coordinate & Radius Entry
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Latitude (°N)
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="e.g. 19.8921"
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background p-2.5 text-sm font-mono outline-none focus:border-foreground"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Longitude (°E)
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                placeholder="e.g. 75.9912"
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background p-2.5 text-sm font-mono outline-none focus:border-foreground"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Radius (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="25"
                required
                value={coordRadius}
                onChange={(e) => setCoordRadius(e.target.value)}
                placeholder="2.0"
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background p-2.5 text-sm font-mono outline-none focus:border-foreground"
              />
            </div>
          </div>

          {/* Coordinate Mode Radius Processing Time Notice */}
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-[11px] font-mono leading-relaxed transition-colors",
              parseFloat(coordRadius) > 2.0
                ? "border-amber/40 bg-amber/10 text-foreground"
                : "border-foreground/10 bg-foreground/[0.02] text-muted-foreground"
            )}
          >
            <Warning
              size={15}
              className={cn("shrink-0 mt-0.5", parseFloat(coordRadius) > 2.0 ? "text-amber" : "text-muted-foreground")}
              weight="bold"
            />
            <div>
              <strong className={parseFloat(coordRadius) > 2.0 ? "text-amber font-semibold" : "text-foreground"}>
                Processing Time Notice:
              </strong>{" "}
              Larger radius values expand the satellite download footprint and PyTorch tensor size, resulting in longer pipeline processing time (~30–50s).
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="md">
              Inspect Custom Coordinates & Radius →
            </Button>
          </div>
        </form>
      )}

      {/* Error Feedback */}
      {searchError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-xs text-danger font-mono">
          {searchError}
        </div>
      )}
    </div>
  );
}
