"use client";

import { useState } from "react";
import { PRESET_SITES, type SiteKey } from "@/lib/watershed-data";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";

export type CustomLocation = {
  name: string;
  lat: number;
  lon: number;
  isCustom: boolean;
};

export default function LocationPicker({
  activeSiteKey,
  customLocation,
  onSelectPreset,
  onSelectCustom,
}: {
  activeSiteKey: SiteKey;
  customLocation: CustomLocation | null;
  onSelectPreset: (key: SiteKey) => void;
  onSelectCustom: (loc: CustomLocation) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showCoordInputs, setShowCoordInputs] = useState(false);
  const [customLat, setCustomLat] = useState("19.8921");
  const [customLon, setCustomLon] = useState("75.9912");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery.trim()
        )}&format=json&limit=1&countrycodes=in`,
        {
          headers: {
            "User-Agent": "watershed-signal-sih2026-demo/1.0 (hackathon prototype)",
          },
        }
      );

      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const data = await res.json();

      if (!data || data.length === 0) {
        setSearchError(`No Indian location matching "${searchQuery}" found.`);
        setIsSearching(false);
        return;
      }

      const place = data[0];
      const parsedLat = parseFloat(place.lat);
      const parsedLon = parseFloat(place.lon);

      onSelectCustom({
        name: place.display_name.split(",")[0] || searchQuery,
        lat: parsedLat,
        lon: parsedLon,
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

    if (isNaN(latNum) || isNaN(lonNum)) {
      setSearchError("Please provide valid numeric coordinates.");
      return;
    }

    onSelectCustom({
      name: `${latNum.toFixed(4)}°N, ${lonNum.toFixed(4)}°E`,
      lat: latNum,
      lon: lonNum,
      isCustom: true,
    });
  }

  return (
    <div className="border-b border-foreground/10 pb-8 space-y-5">
      {/* Preset Buttons & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          {PRESET_SITES.map((site) => {
            const isActive = !customLocation && activeSiteKey === site.key;
            return (
              <button
                key={site.key}
                onClick={() => onSelectPreset(site.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs sm:text-sm font-medium transition-all",
                  isActive
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-foreground/15 hover:border-foreground/40 bg-background text-foreground/80"
                )}
              >
                {site.displayName}
                {isActive && " ✓"}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowCoordInputs(!showCoordInputs)}
          className="font-mono text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {showCoordInputs ? "Hide coordinate inputs" : "Enter custom coordinates ↗"}
        </button>
      </div>

      {/* Free-text Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search any place in India (e.g. Ralegan Siddhi, Paithan, Jamshedpur)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors font-sans"
          />
        </div>
        <Button type="submit" size="sm" disabled={isSearching}>
          {isSearching ? "Searching..." : "Search AOI"}
        </Button>
      </form>

      {/* Manual Coordinates Drawer */}
      {showCoordInputs && (
        <form
          onSubmit={handleCoordinateSubmit}
          className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] max-w-2xl animate-fade-up"
        >
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
              className="mt-1 w-36 rounded-lg border border-foreground/15 bg-background p-2 text-xs font-mono outline-none focus:border-foreground"
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
              className="mt-1 w-36 rounded-lg border border-foreground/15 bg-background p-2 text-xs font-mono outline-none focus:border-foreground"
            />
          </div>

          <Button type="submit" size="sm">
            Inspect Coordinates
          </Button>
        </form>
      )}

      {/* Error Message */}
      {searchError && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2 text-xs text-danger font-mono">
          {searchError}
        </div>
      )}
    </div>
  );
}
