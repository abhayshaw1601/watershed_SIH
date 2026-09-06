"use client";

import { useState } from "react";
import { MapContainer, TileLayer, ImageOverlay } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { SiteMeta } from "@/lib/watershed-data";
import { rgbToCss } from "@/lib/watershed-data";

export default function MapTab({ site, meta }: { site: string; meta: SiteMeta }) {
  const [opacity, setOpacity] = useState(0.65);
  const [showLulc, setShowLulc] = useState(true);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showDrainage, setShowDrainage] = useState(true);

  const { west, south, east, north } = meta.bbox_wgs84;
  const bounds: [[number, number], [number, number]] = [
    [south, west],
    [north, east],
  ];
  const center: [number, number] = [(south + north) / 2, (west + east) / 2];
  
  const lulcImg = `/demo-data/${site}/${meta.has_change_pair ? "t2" : "s1"}.png`;
  const boundaryImg = `/demo-data/${site}/watershed_boundary.png`;
  const drainageImg = `/demo-data/${site}/drainage_network.png`;

  const legend = Object.entries(meta.class_names);
  const nodataPixels = (meta.class_breakdown["255"]?.pixels ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Scientific Honesty Caveat */}
      <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-xs text-amber leading-relaxed flex items-start gap-2.5">
        <span className="text-base shrink-0">⚠️</span>
        <div>
          <span className="font-semibold">Hydrological Model Note:</span> Watershed boundary &amp; drainage
          channels are algorithmically delineated from Copernicus 30m DEM elevation data (pour point snapped
          to max flow accumulation). This serves as a defensible topographic approximation; no official government
          survey boundary is published for ground-truth comparison.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Map Container */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10">
          <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* 1. LULC Land Cover Overlay */}
            {showLulc && <ImageOverlay url={lulcImg} bounds={bounds} opacity={opacity} />}

            {/* 2. DEM-Derived Watershed Boundary (Orange line) */}
            {showBoundary && <ImageOverlay url={boundaryImg} bounds={bounds} opacity={1.0} />}

            {/* 3. DEM-Derived Drainage Network (Cyan stream paths) */}
            {showDrainage && <ImageOverlay url={drainageImg} bounds={bounds} opacity={1.0} />}
          </MapContainer>

          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-background/90 px-3 py-1.5 font-mono text-[11px] shadow-sm backdrop-blur-sm border border-foreground/10">
            {center[0].toFixed(4)}°N · {center[1].toFixed(4)}°E
          </div>
        </div>

        {/* Layer Controls & Legend */}
        <div className="space-y-6">
          {/* Layer Controls Panel */}
          <div className="rounded-2xl border border-foreground/10 p-5 bg-background">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Map Layers
            </div>
            
            <div className="mt-4 space-y-3">
              {/* LULC Toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showLulc}
                    onChange={(e) => setShowLulc(e.target.checked)}
                    className="accent-foreground rounded"
                  />
                  <span className="text-sm font-medium">Model 1 LULC (T2)</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">10m raster</span>
              </label>

              {/* Watershed Boundary Toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showBoundary}
                    onChange={(e) => setShowBoundary(e.target.checked)}
                    className="accent-amber rounded"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block w-3 h-1 bg-[#ff8c00] rounded-full" />
                    Watershed Catchment
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">DEM approx</span>
              </label>

              {/* Drainage Network Toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showDrainage}
                    onChange={(e) => setShowDrainage(e.target.checked)}
                    className="accent-teal rounded"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block w-3 h-1 bg-[#00c8ff] rounded-full" />
                    Drainage Network
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">Flow &ge; 500</span>
              </label>
            </div>

            {/* Opacity Slider */}
            {showLulc && (
              <div className="mt-5 border-t border-foreground/10 pt-4">
                <div className="flex items-center justify-between font-mono text-xs">
                  <label htmlFor="overlay-opacity" className="uppercase tracking-wider text-muted-foreground">
                    LULC Opacity
                  </label>
                  <span className="font-mono text-muted-foreground">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  id="overlay-opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="mt-2 w-full accent-foreground cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Categorical Land-Cover Legend */}
          <div className="rounded-2xl border border-foreground/10 p-5 bg-background">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Land Cover Classes
            </div>
            <div className="mt-3 space-y-2">
              {legend.filter(([cls]) => cls !== "255" || nodataPixels).map(([cls, name]) => (
                <div key={cls} className="flex items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-sm shadow-sm" style={{ background: rgbToCss(meta.class_colors[cls]) }} />
                  <span className="text-xs text-foreground/90">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
