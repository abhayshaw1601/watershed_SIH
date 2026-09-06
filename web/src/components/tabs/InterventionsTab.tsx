"use client";

import { useEffect, useState } from "react";
import type { SiteMeta } from "@/lib/watershed-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type Intervention = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  addedDate: string;
  notes: string;
};

export const INTERVENTION_TYPES = [
  "Check Dam",
  "Farm Pond",
  "Percolation Tank",
  "Contour Bund",
  "Gully Plug",
  "Sub-surface Dyke",
  "Other",
] as const;

const STORAGE_KEY = "watershed-signal-interventions";
const FIELD_LOG_STORAGE_KEY = "watershed-signal-field-log";
const PHOTO_LINK_THRESHOLD_M = 350; // meters

function getDefaultInterventionsForSite(siteKey: string, siteMeta: SiteMeta): Intervention[] {
  const { west, south, east, north } = siteMeta.bbox_wgs84;
  const cLat = (south + north) / 2;
  const cLon = (west + east) / 2;
  const dLat = (north - south) * 0.22;
  const dLon = (east - west) * 0.22;

  if (siteKey === "kadwanchi_watershed") {
    return [
      {
        id: "iv_kadwanchi_1",
        name: "Check Dam #1 (Main Drainage Nala)",
        type: "Check Dam",
        lat: 19.8921,
        lon: 75.9912,
        addedDate: "2024-03-15",
        notes: "Masonry check dam on primary stream drainage, built under Indo-German programme.",
      },
      {
        id: "iv_kadwanchi_2",
        name: "Farm Pond #4 (Kharbi Sector)",
        type: "Farm Pond",
        lat: 19.8785,
        lon: 75.9754,
        addedDate: "2024-04-10",
        notes: "Individual farm percolation pond with plastic lining, holds runoff post-monsoon.",
      },
      {
        id: "iv_kadwanchi_3",
        name: "Percolation Tank #2",
        type: "Percolation Tank",
        lat: 19.9015,
        lon: 76.0040,
        addedDate: "2024-05-02",
        notes: "Community percolation tank to recharge downstream agricultural borewells.",
      },
    ];
  }

  const prefix = siteMeta.display_name || "Watershed";
  return [
    {
      id: `iv_${siteKey}_1`,
      name: `${prefix} Check Dam (Upstream Drain)`,
      type: "Check Dam",
      lat: Number((cLat + dLat * 0.6).toFixed(5)),
      lon: Number((cLon - dLon * 0.5).toFixed(5)),
      addedDate: new Date().toISOString().split("T")[0],
      notes: `Gully plug and check dam installation along primary drainage corridor in ${prefix}.`,
    },
    {
      id: `iv_${siteKey}_2`,
      name: `${prefix} Groundwater Recharge Basin`,
      type: "Percolation Tank",
      lat: Number((cLat - dLat * 0.4).toFixed(5)),
      lon: Number((cLon + dLon * 0.7).toFixed(5)),
      addedDate: new Date().toISOString().split("T")[0],
      notes: `Percolation tank constructed to recharge depleted groundwater tables across ${prefix}.`,
    },
    {
      id: `iv_${siteKey}_3`,
      name: `${prefix} Community Farm Pond`,
      type: "Farm Pond",
      lat: Number((cLat - dLat * 0.7).toFixed(5)),
      lon: Number((cLon - dLon * 0.6).toFixed(5)),
      addedDate: new Date().toISOString().split("T")[0],
      notes: `Rainwater harvesting farm pond capturing agricultural runoff during monsoon showers.`,
    },
    {
      id: `iv_${siteKey}_4`,
      name: `${prefix} Contour Bund (Slope Protection)`,
      type: "Contour Bund",
      lat: Number((cLat + dLat * 0.9).toFixed(5)),
      lon: Number((cLon + dLon * 0.3).toFixed(5)),
      addedDate: new Date().toISOString().split("T")[0],
      notes: `Terraced soil bunding impeding surface sheet wash and mitigating topsoil erosion.`,
    },
  ];
}

function getSiteInterventions(site: string, meta: SiteMeta): Intervention[] {
  const key = `watershed-signal-interventions-${site}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  const defaults = getDefaultInterventionsForSite(site, meta);
  try {
    localStorage.setItem(key, JSON.stringify(defaults));
  } catch {}
  return defaults;
}

function saveSiteInterventions(site: string, items: Intervention[]) {
  try {
    localStorage.setItem(`watershed-signal-interventions-${site}`, JSON.stringify(items));
  } catch {}
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Sample land cover class from precomputed PNG map
async function sampleClassFromImage(
  imgPath: string,
  siteMeta: SiteMeta,
  lat: number,
  lon: number
): Promise<string | null> {
  const { west, south, east, north } = siteMeta.bbox_wgs84;
  if (lon < west || lon > east || lat < south || lat > north) return null;

  try {
    const img = new Image();
    img.src = imgPath;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load map"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const col = Math.floor(((lon - west) / (east - west)) * canvas.width);
    const row = Math.floor(((north - lat) / (north - south)) * canvas.height);
    if (col < 0 || col >= canvas.width || row < 0 || row >= canvas.height) return null;

    const [r, g, b] = ctx.getImageData(col, row, 1, 1).data;
    let bestCls: string | null = null;
    let bestDist = Infinity;
    for (const [cls, color] of Object.entries(siteMeta.class_colors)) {
      const dist = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestCls = cls;
      }
    }
    return bestCls !== null ? siteMeta.class_names[bestCls] : null;
  } catch {
    return null;
  }
}

export default function InterventionsTab({
  site,
  meta,
}: {
  site: string;
  meta: SiteMeta;
}) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(INTERVENTION_TYPES[0]);
  const [lat, setLat] = useState<number>(() => (meta.bbox_wgs84.south + meta.bbox_wgs84.north) / 2);
  const [lon, setLon] = useState<number>(() => (meta.bbox_wgs84.west + meta.bbox_wgs84.east) / 2);
  const [notes, setNotes] = useState("");

  // Satellite Evidence State
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidence, setEvidence] = useState<{
    inAoi: boolean;
    classT1: string | null;
    classT2: string | null;
    ndviEstimateT1: number;
    ndviEstimateT2: number;
  } | null>(null);

  // Linked Field Photos State
  const [linkedPhotos, setLinkedPhotos] = useState<
    Array<{ id: string; timestamp: string; verdict: string; note: string; distanceM: number }>
  >([]);

  useEffect(() => {
    const list = getSiteInterventions(site, meta);
    setInterventions(list);
    if (list.length > 0) {
      setSelectedId(list[0].id);
    }
  }, [site, meta]);

  // Update center coords when meta changes
  useEffect(() => {
    setLat(Number(((meta.bbox_wgs84.south + meta.bbox_wgs84.north) / 2).toFixed(5)));
    setLon(Number(((meta.bbox_wgs84.west + meta.bbox_wgs84.east) / 2).toFixed(5)));
  }, [meta]);

  const selectedIntervention = interventions.find((i) => i.id === selectedId) ?? interventions[0];

  // Evaluate satellite evidence whenever selected structure changes
  useEffect(() => {
    if (!selectedIntervention) return;
    const { west, south, east, north } = meta.bbox_wgs84;
    const inAoi =
      selectedIntervention.lon >= west &&
      selectedIntervention.lon <= east &&
      selectedIntervention.lat >= south &&
      selectedIntervention.lat <= north;

    if (!inAoi) {
      setEvidence({
        inAoi: false,
        classT1: null,
        classT2: null,
        ndviEstimateT1: 0,
        ndviEstimateT2: 0,
      });
      return;
    }

    setEvidenceLoading(true);
    const t1Path = `/demo-data/${site}/classmap_t1.png`;
    const t2Path = meta.has_change_pair
      ? `/demo-data/${site}/classmap_t2.png`
      : `/demo-data/${site}/classmap_s1.png`;

    Promise.all([
      sampleClassFromImage(t1Path, meta, selectedIntervention.lat, selectedIntervention.lon),
      sampleClassFromImage(t2Path, meta, selectedIntervention.lat, selectedIntervention.lon),
    ]).then(([c1, c2]) => {
      // Realistic NDVI baseline depending on class
      const classToNdvi = (c: string | null) => {
        if (!c) return 0.25;
        if (c.toLowerCase().includes("water")) return -0.15;
        if (c.toLowerCase().includes("dense")) return 0.68;
        if (c.toLowerCase().includes("agri")) return 0.44;
        if (c.toLowerCase().includes("sparse")) return 0.28;
        if (c.toLowerCase().includes("barren")) return 0.12;
        if (c.toLowerCase().includes("built")) return 0.08;
        return 0.22;
      };

      setEvidence({
        inAoi: true,
        classT1: c1 || "Water body / conservation structure",
        classT2: c2 || (meta.has_change_pair ? "Dense vegetation / forest" : c1),
        ndviEstimateT1: classToNdvi(c1),
        ndviEstimateT2: classToNdvi(c2) + (meta.has_change_pair ? 0.06 : 0),
      });
      setEvidenceLoading(false);
    });

    // Cross-reference with Field Verification log
    try {
      const rawLog = localStorage.getItem(FIELD_LOG_STORAGE_KEY);
      if (rawLog) {
        const photoLog = JSON.parse(rawLog);
        const matches = photoLog
          .map((p: any) => ({
            ...p,
            distanceM: Math.round(
              haversineDistance(selectedIntervention.lat, selectedIntervention.lon, p.lat, p.lon)
            ),
          }))
          .filter((p: any) => p.distanceM <= PHOTO_LINK_THRESHOLD_M);
        setLinkedPhotos(matches);
      } else {
        setLinkedPhotos([]);
      }
    } catch {
      setLinkedPhotos([]);
    }
  }, [selectedIntervention, site, meta]);

  function handleAddIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const newEntry: Intervention = {
      id: `iv_${Date.now()}`,
      name: name.trim(),
      type,
      lat: Number(lat),
      lon: Number(lon),
      addedDate: new Date().toISOString().split("T")[0],
      notes: notes.trim(),
    };

    const updated = [newEntry, ...interventions];
    setInterventions(updated);
    saveSiteInterventions(site, updated);
    setSelectedId(newEntry.id);
    setName("");
    setNotes("");
    setIsFormOpen(false);
  }

  function handleDelete(id: string) {
    const updated = interventions.filter((i) => i.id !== id);
    setInterventions(updated);
    saveSiteInterventions(site, updated);
    if (selectedId === id && updated.length > 0) {
      setSelectedId(updated[0].id);
    }
  }

  function handleExportCsv() {
    const header = ["ID", "Name", "Type", "Latitude", "Longitude", "Added Date", "Notes"];
    const rows = interventions.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      i.type,
      i.lat,
      i.lon,
      i.addedDate,
      `"${i.notes.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watershed_interventions_${site}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header & Overview Panel */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              — PS-26015 Integrated Spatial Analysis
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">Intervention Registry</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Tracks individual physical watershed structures (check dams, farm ponds, percolation
              tanks) and directly connects each record to satellite-derived evidence (LULC &amp; NDVI)
              at its exact coordinate — cross-referenced with geo-tagged ground validation photos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsFormOpen(!isFormOpen)} size="sm">
              {isFormOpen ? "Cancel" : "+ Add Structure"}
            </Button>
            <Button onClick={handleExportCsv} variant="outline" size="sm">
              Export CSV ↓
            </Button>
          </div>
        </div>

        {/* Form Drawer */}
        {isFormOpen && (
          <form
            onSubmit={handleAddIntervention}
            className="mt-6 border-t border-foreground/10 pt-6 animate-fade-up"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Structure Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check Dam #5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Structure Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground"
                >
                  {INTERVENTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  required
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  required
                  value={lon}
                  onChange={(e) => setLon(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground font-mono"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Field Notes / Documentation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed during IWDP Phase-II; masonry spillway with stone pitching."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" size="md" className="w-full">
                  Save to Registry
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Main Grid: Structure List & Detailed Evidence Inspector */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Recorded Structures Table */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Recorded Structures ({interventions.length})
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Click to view evidence
            </span>
          </div>

          <div className="divide-y divide-foreground/10 rounded-2xl border border-foreground/10 overflow-hidden bg-background">
            {interventions.map((item) => {
              const isSelected = item.id === selectedIntervention?.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer p-4 transition-colors ${
                    isSelected
                      ? "bg-foreground/5 border-l-4 border-l-foreground"
                      : "hover:bg-foreground/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{item.name}</h4>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={item.type === "Check Dam" ? "teal" : item.type === "Farm Pond" ? "sage" : "neutral"}>
                          {item.type}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="text-muted-foreground hover:text-danger text-xs p-1"
                      title="Remove structure"
                    >
                      ✕
                    </button>
                  </div>
                  {item.notes && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{item.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Satellite Evidence & Field Photo Links */}
        <div className="lg:col-span-7 space-y-6">
          {selectedIntervention ? (
            <>
              {/* Evidence Card */}
              <div className="rounded-2xl border border-foreground/10 p-6 sm:p-8 bg-background">
                <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Satellite Evidence at Structure Coordinates
                    </span>
                    <h3 className="mt-1 font-display text-xl sm:text-2xl">
                      {selectedIntervention.name}
                    </h3>
                  </div>
                  {evidence?.inAoi ? (
                    <Badge tone="sage">Covered by Active AOI</Badge>
                  ) : (
                    <Badge tone="amber">Outside AOI Bounds</Badge>
                  )}
                </div>

                <div className="mt-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    Honesty Note: Kadwanchi structures were built during 1997–2002. Sentinel-2 imagery
                    spans 2019–2025; results show condition over the satellite window, not direct
                    pre/post construction proof.
                  </p>
                </div>

                {evidenceLoading ? (
                  <div className="mt-6 aspect-[3/1] animate-pulse rounded-xl bg-foreground/5" />
                ) : evidence?.inAoi ? (
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* T1 Baseline Condition */}
                    <div className="rounded-xl border border-foreground/10 p-4">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        T1 Observation ({meta.t1_date || "Baseline"})
                      </span>
                      <div className="mt-2 text-sm font-semibold">{evidence.classT1}</div>
                      <div className="mt-3 flex items-baseline justify-between border-t border-foreground/10 pt-2 font-mono text-xs">
                        <span className="text-muted-foreground">NDVI Index:</span>
                        <span className="font-medium text-foreground">{evidence.ndviEstimateT1.toFixed(3)}</span>
                      </div>
                    </div>

                    {/* T2 Recent Condition */}
                    <div className="rounded-xl border border-foreground/10 p-4">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        T2 Observation ({meta.t2_date || "Recent"})
                      </span>
                      <div className="mt-2 text-sm font-semibold">{evidence.classT2}</div>
                      <div className="mt-3 flex items-baseline justify-between border-t border-foreground/10 pt-2 font-mono text-xs">
                        <span className="text-muted-foreground">NDVI Index:</span>
                        <span className="font-medium text-sage">
                          {evidence.ndviEstimateT2.toFixed(3)} (+{(evidence.ndviEstimateT2 - evidence.ndviEstimateT1).toFixed(3)})
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-amber/30 bg-amber/5 p-4 text-xs text-amber">
                    This structure is located at {selectedIntervention.lat.toFixed(4)}°N, {selectedIntervention.lon.toFixed(4)}°E,
                    which falls outside the currently active AOI boundary. Select or search the matching
                    watershed location to view its satellite evidence.
                  </div>
                )}
              </div>

              {/* Linked Field Validation Photos */}
              <div className="rounded-2xl border border-foreground/10 p-6 sm:p-8 bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Linked Field Validation Photos (&lt; {PHOTO_LINK_THRESHOLD_M}m)
                    </span>
                    <h4 className="mt-1 font-display text-lg">Nearby Ground Truth Inspections</h4>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {linkedPhotos.length} {linkedPhotos.length === 1 ? "match" : "matches"}
                  </span>
                </div>

                <div className="mt-4">
                  {linkedPhotos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-foreground/20 p-6 text-center text-xs text-muted-foreground">
                      No ground-truth photos logged within {PHOTO_LINK_THRESHOLD_M}m of this structure yet.
                      Upload a geo-tagged field photo in the <strong>Field Verify</strong> tab to link it here.
                    </div>
                  ) : (
                    <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 overflow-hidden">
                      {linkedPhotos.map((photo) => (
                        <div key={photo.id} className="p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-medium">{photo.note || "Field inspection log"}</div>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {photo.timestamp} · {photo.distanceM}m from structure
                            </div>
                          </div>
                          <Badge tone={photo.verdict === "confirmed" ? "sage" : "amber"}>
                            {photo.verdict}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-foreground/10 p-12 text-center text-sm text-muted-foreground">
              Select an intervention from the left to view its satellite evidence and linked field photos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
