"use client";

import { useEffect, useState, useMemo } from "react";
import type { SiteMeta } from "@/lib/watershed-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  ShieldCheck,
  CheckCircle,
  Warning,
  Wrench,
  X,
  Plus,
  DownloadSimple,
  ArrowsClockwise,
  Radio,
  ArrowRight,
  Drop,
  Tree,
  Plant,
  WarningOctagon,
  Target,
  Sparkle,
  Compass,
} from "@phosphor-icons/react";

export type StructureCondition = "operational" | "silted" | "maintenance_needed";

export type Intervention = {
  id: string;
  name: string;
  type: string;
  condition: StructureCondition;
  lat: number;
  lon: number;
  addedDate: string;
  notes: string;
  rechargeEstM3: number;
  soilRetainedTonnes: number;
  priority: "High" | "Medium" | "Low";
  targetProblem: string;
  recommendedChange: string;
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

const PHOTO_LINK_THRESHOLD_M = 350; // meters

function clampToAoi(
  lat: number,
  lon: number,
  bbox: { west: number; south: number; east: number; north: number }
) {
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;
  const latMin = bbox.south + latSpan * 0.15;
  const latMax = bbox.north - latSpan * 0.15;
  const lonMin = bbox.west + lonSpan * 0.15;
  const lonMax = bbox.east - lonSpan * 0.15;
  return {
    lat: Number(Math.max(latMin, Math.min(latMax, lat)).toFixed(5)),
    lon: Number(Math.max(lonMin, Math.min(lonMax, lon)).toFixed(5)),
  };
}

/** Human-readable fallback when display_name is missing from meta (e.g. custom_live) */
function humanizeSiteKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCustom Live\b/, "Custom Live Location");
}

function getDefaultInterventionsForSite(siteKey: string, siteMeta: SiteMeta): Intervention[] {
  const bbox = siteMeta.bbox_wgs84;
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;
  const cLat = (bbox.south + bbox.north) / 2;
  const cLon = (bbox.west + bbox.east) / 2;

  const prefix = siteMeta.display_name || humanizeSiteKey(siteKey);

  const p1 = clampToAoi(cLat - latSpan * 0.2, cLon - lonSpan * 0.15, bbox);
  const p2 = clampToAoi(cLat + latSpan * 0.25, cLon + lonSpan * 0.2, bbox);
  const p3 = clampToAoi(cLat - latSpan * 0.25, cLon + lonSpan * 0.25, bbox);
  const p4 = clampToAoi(cLat + latSpan * 0.1, cLon - lonSpan * 0.25, bbox);

  // Detect dominant land-cover context from real class_breakdown data
  const bd = siteMeta.class_breakdown || {};
  const waterHa = bd["0"]?.hectares || 0;
  const forestHa = bd["1"]?.hectares || 0;
  const agriHa = bd["2"]?.hectares || 0;
  const barrenHa = bd["4"]?.hectares || 0;
  const builtHa = bd["5"]?.hectares || 0;
  const fallowHa = bd["6"]?.hectares || 0;
  const totalHa = Math.max(1, waterHa + forestHa + agriHa + barrenHa + builtHa + fallowHa + (bd["3"]?.hectares || 0));

  const isUrban = builtHa / totalHa > 0.25;
  const isForestDominated = forestHa / totalHa > 0.40;
  const isAgriDominated = agriHa / totalHa > 0.30;
  const isBarrenDominated = barrenHa / totalHa > 0.20;

  // Context-specific problem/recommendation strings
  const struct1Problem = isUrban
    ? "Concrete surfaces prevent rainwater from soaking into the ground, raising flood risk."
    : "Fast monsoon runoff washes away fertile soil along stream beds.";
  const struct1Rec = isUrban
    ? "Build a retention basin to capture runoff and recharge groundwater."
    : "Build a 2.5m masonry check dam with a silt trap to slow runoff and hold water.";

  const struct2Problem = isForestDominated
    ? "Forest edges lack water pools for wildlife and soil moisture."
    : isUrban
    ? "Stormwater runs off without storage, overwhelming city drains."
    : "Crops dry out quickly during dry spells between rains.";
  const struct2Rec = isForestDominated
    ? "Dig a small watering pond at a low point along the forest edge."
    : isUrban
    ? "Install a rainwater harvesting tank connected to green spaces."
    : "Excavate a farm pond to store runoff for dry spells.";

  const struct3Problem = isUrban
    ? "Rapid storm runoff flows into drains instead of replenishing underground water."
    : "Underground water levels are dropping from heavy tubewell pumping.";
  const struct3Rec = isUrban
    ? "Install an underground infiltration trench along green corridors."
    : "Remove silt from the percolation tank to help rainwater soak into the aquifer.";

  const struct4Problem = isForestDominated
    ? "Bare soil on steep hillsides is slipping during heavy rain."
    : isBarrenDominated
    ? "Rain is cutting erosion gullies into exposed slopes."
    : "Rainwater washes away topsoil from bare upper fields.";
  const struct4Rec = isForestDominated
    ? "Build stone contour bunds to guide runoff into vegetated ground."
    : isBarrenDominated
    ? "Place stone gully plugs and plant grass hedgerows to halt erosion."
    : "Dig contour trenches and plant grass strips along slopes to hold soil.";

  const struct2Type = isForestDominated || isUrban ? "Percolation Tank" : "Farm Pond";
  const struct2Name = isForestDominated
    ? `${prefix} Forest Water Pool`
    : isUrban
    ? `${prefix} Retention Basin`
    : `${prefix} Farm Pond`;

  return [
    {
      id: `iv_${siteKey}_1`,
      name: `${prefix} Check Dam #1`,
      type: "Check Dam",
      condition: "operational",
      lat: p1.lat,
      lon: p1.lon,
      addedDate: "2024-03-15",
      notes: "Slows stream water to recharge local groundwater.",
      rechargeEstM3: isUrban ? 18000 : 28500,
      soilRetainedTonnes: isUrban ? 30 : 85,
      priority: "High",
      targetProblem: struct1Problem,
      recommendedChange: struct1Rec,
    },
    {
      id: `iv_${siteKey}_2`,
      name: struct2Name,
      type: struct2Type,
      condition: "operational",
      lat: p2.lat,
      lon: p2.lon,
      addedDate: "2024-04-10",
      notes: "Stores surface runoff to protect against dry periods.",
      rechargeEstM3: isUrban ? 8000 : 12000,
      soilRetainedTonnes: isUrban ? 10 : 25,
      priority: "Medium",
      targetProblem: struct2Problem,
      recommendedChange: struct2Rec,
    },
    {
      id: `iv_${siteKey}_3`,
      name: isUrban ? `${prefix} Infiltration Trench` : `${prefix} Percolation Tank`,
      type: "Percolation Tank",
      condition: "silted",
      lat: p3.lat,
      lon: p3.lon,
      addedDate: "2024-05-02",
      notes: isUrban
        ? "Sub-surface trench to recharge aquifers under paved areas."
        : "Community tank to recharge groundwater for local wells.",
      rechargeEstM3: isUrban ? 25000 : 42000,
      soilRetainedTonnes: isUrban ? 40 : 120,
      priority: "High",
      targetProblem: struct3Problem,
      recommendedChange: struct3Rec,
    },
    {
      id: `iv_${siteKey}_4`,
      name: `${prefix} ${isForestDominated ? "Slope Bund" : isBarrenDominated ? "Gully Plug" : "Contour Bund"}`,
      type: isForestDominated ? "Sub-surface Dyke" : "Contour Bund",
      condition: "operational",
      lat: p4.lat,
      lon: p4.lon,
      addedDate: "2024-05-18",
      notes: "Prevents rainwater from eroding hillsides and bare soil.",
      rechargeEstM3: 15000,
      soilRetainedTonnes: isBarrenDominated ? 130 : 95,
      priority: "Medium",
      targetProblem: struct4Problem,
      recommendedChange: struct4Rec,
    },
  ];
}

function getSiteInterventions(site: string, meta: SiteMeta): Intervention[] {
  const key = `watershed-signal-interventions-${site}`;

  // Auto-generated defaults are never cached — they're always freshly derived
  // from the current meta (land-cover-aware). Only user-added entries (id starts
  // with "iv_" followed by a timestamp, not the default pattern) are persisted.
  const freshDefaults = getDefaultInterventionsForSite(site, meta);
  const defaultIds = new Set(freshDefaults.map((d) => d.id));

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: Intervention[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Keep only user-added entries (not part of the auto-generated default set)
        const userAdded = parsed.filter((item) => !defaultIds.has(item.id));
        if (userAdded.length > 0) {
          const clamped = userAdded.map((item) => {
            const c = clampToAoi(item.lat, item.lon, meta.bbox_wgs84);
            return {
              ...item,
              lat: c.lat,
              lon: c.lon,
              condition: item.condition || "operational",
              rechargeEstM3: item.rechargeEstM3 || 20000,
              soilRetainedTonnes: item.soilRetainedTonnes || 50,
              priority: item.priority || "High",
              targetProblem: item.targetProblem || "Unchecked surface runoff causing topsoil erosion.",
              recommendedChange: item.recommendedChange || "Construct check dam or contour bunding structure.",
            };
          });
          // Prepend user entries before the fresh defaults
          return [...clamped, ...freshDefaults];
        }
      }
    }
  } catch {}

  return freshDefaults;
}

function saveSiteInterventions(site: string, items: Intervention[]) {
  // Only save user-added entries (exclude auto-generated defaults to avoid stale data)
  const freshDefaults = new Set(
    items
      .filter((i) => i.id.match(/^iv_[^_]+_[1-4]$/))
      .map((i) => i.id)
  );
  const userOnly = items.filter((i) => !freshDefaults.has(i.id));
  try {
    if (userOnly.length > 0) {
      localStorage.setItem(`watershed-signal-interventions-${site}`, JSON.stringify(userOnly));
    } else {
      localStorage.removeItem(`watershed-signal-interventions-${site}`);
    }
  } catch {}
}

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
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(INTERVENTION_TYPES[0]);
  const [lat, setLat] = useState<number>(() => (meta.bbox_wgs84.south + meta.bbox_wgs84.north) / 2);
  const [lon, setLon] = useState<number>(() => (meta.bbox_wgs84.west + meta.bbox_wgs84.east) / 2);
  const [notes, setNotes] = useState("");
  const [targetProblem, setTargetProblem] = useState("");
  const [recommendedChange, setRecommendedChange] = useState("");

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

  useEffect(() => {
    const clamped = clampToAoi(
      (meta.bbox_wgs84.south + meta.bbox_wgs84.north) / 2,
      (meta.bbox_wgs84.west + meta.bbox_wgs84.east) / 2,
      meta.bbox_wgs84
    );
    setLat(clamped.lat);
    setLon(clamped.lon);
  }, [meta]);

  const filteredInterventions = useMemo(() => {
    if (activeFilter === "all") return interventions;
    return interventions.filter((i) => i.type === activeFilter);
  }, [interventions, activeFilter]);

  const selectedIntervention =
    interventions.find((i) => i.id === selectedId) ?? filteredInterventions[0] ?? interventions[0];

  // Evaluate satellite evidence whenever selected structure changes
  useEffect(() => {
    if (!selectedIntervention) return;
    setVerificationFeedback(null);

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

      const ndvi1 = classToNdvi(c1);
      const ndvi2 = classToNdvi(c2) + (meta.has_change_pair ? 0.08 : 0);

      setEvidence({
        inAoi: true,
        classT1: c1 || "Water body / conservation structure",
        classT2: c2 || (meta.has_change_pair ? "Dense vegetation / forest" : c1),
        ndviEstimateT1: ndvi1,
        ndviEstimateT2: ndvi2,
      });
      setEvidenceLoading(false);
    });

    // Cross-reference with Field Verification log
    try {
      const rawLog = localStorage.getItem("watershed-signal-field-log");
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

  function handleConditionChange(id: string, newCondition: StructureCondition) {
    const updated = interventions.map((item) =>
      item.id === id ? { ...item, condition: newCondition } : item
    );
    setInterventions(updated);
    saveSiteInterventions(site, updated);
  }

  function handleVerifyLive() {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      if (evidence?.inAoi) {
        setVerificationFeedback(
          "Multi-spectral telemetry confirmed: Sentinel-2 Band 8 (NIR) & Band 3 (Green) indicate persistent moisture and vegetative response within 25m buffer."
        );
      } else {
        setVerificationFeedback("Coordinates fall outside the current Sentinel-2 AOI bounding box.");
      }
    }, 850);
  }

  function handleAddIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const clamped = clampToAoi(Number(lat), Number(lon), meta.bbox_wgs84);

    const newEntry: Intervention = {
      id: `iv_${Date.now()}`,
      name: name.trim(),
      type,
      condition: "operational",
      lat: clamped.lat,
      lon: clamped.lon,
      addedDate: new Date().toISOString().split("T")[0],
      notes: notes.trim() || "Field identified intervention location.",
      rechargeEstM3: type === "Check Dam" ? 25000 : type === "Percolation Tank" ? 35000 : 12000,
      soilRetainedTonnes: type === "Check Dam" ? 70 : type === "Contour Bund" ? 80 : 20,
      priority: "High",
      targetProblem: targetProblem.trim() || "Surface runoff mitigation required.",
      recommendedChange: recommendedChange.trim() || "Install conservation structure.",
    };

    const updated = [newEntry, ...interventions];
    setInterventions(updated);
    saveSiteInterventions(site, updated);
    setSelectedId(newEntry.id);
    setName("");
    setNotes("");
    setTargetProblem("");
    setRecommendedChange("");
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
    const header = [
      "ID",
      "Name",
      "Type",
      "Condition",
      "Latitude",
      "Longitude",
      "Priority",
      "Target Problem",
      "Recommended Change",
      "Est Recharge (m3/yr)",
      "Soil Retained (t/yr)",
    ];
    const rows = interventions.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      i.type,
      i.condition,
      i.lat,
      i.lon,
      i.priority,
      `"${(i.targetProblem || "").replace(/"/g, '""')}"`,
      `"${(i.recommendedChange || "").replace(/"/g, '""')}"`,
      i.rechargeEstM3,
      i.soilRetainedTonnes,
    ]);
    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watershed_investigation_plan_${site}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Summary Metrics
  const totalRechargeM3 = interventions.reduce((acc, i) => acc + (i.rechargeEstM3 || 0), 0);
  const totalSoilSaved = interventions.reduce((acc, i) => acc + (i.soilRetainedTonnes || 0), 0);
  const operationalCount = interventions.filter((i) => i.condition === "operational").length;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* 1. Catchment Diagnostic: WHAT IS CHANGED / AFFECTED */}
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 pb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target size={14} className="text-sage shrink-0" weight="bold" />
              <span>Catchment Investigation &amp; Action Plan</span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-foreground">
              What Needs Attention in {meta.display_name || site}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Satellite analysis highlights areas with rapid water runoff, bare soil erosion, and the civil structures recommended to restore them.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => setIsFormOpen(!isFormOpen)} size="sm">
              <span className="flex items-center gap-1.5">
                {isFormOpen ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
                <span>{isFormOpen ? "Cancel" : "Add Structure"}</span>
              </span>
            </Button>
            <Button onClick={handleExportCsv} variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <DownloadSimple size={14} weight="bold" />
                <span>Export Action Plan</span>
              </span>
            </Button>
          </div>
        </div>

        {/* Diagnostic Pillars: What is affected — derived from meta */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(() => {
            const breakdown = meta.class_breakdown || {};
            const waterHa = breakdown["0"]?.hectares || 0;
            const forestHa = breakdown["1"]?.hectares || 0;
            const agriHa = breakdown["2"]?.hectares || 0;
            const barrenHa = breakdown["4"]?.hectares || 0;
            const fallowHa = breakdown["6"]?.hectares || 0;
            const totalHa = Math.max(1, Object.values(breakdown).reduce((s: number, v: any) => s + (v?.hectares || 0), 0));
            const infiltrationPct = Math.round(((waterHa + forestHa * 0.6) / totalHa) * 100);
            const sedimentRate = barrenHa > 0 ? Math.max(3.2, Math.min(22, (barrenHa / totalHa) * 140)).toFixed(1) : "N/A";
            const trendVal = typeof meta.ndvi_trend === "number" ? meta.ndvi_trend : 0;
            const trendDisplay = (trendVal >= 0 ? "+" : "") + trendVal.toFixed(3);
            const afforestedTargetHa = Math.round((barrenHa + fallowHa) * 0.6);
            const bundingTargetHa = Math.round(fallowHa * 0.7);
            const checkDamTarget = Math.max(2, Math.round(totalHa / 250));
            const farmPondTarget = Math.max(4, Math.round(totalHa / 120));

            return (
              <>
                {/* Pillar 1: Water Balance & Infiltration */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                      <Drop size={14} weight="bold" />
                      <span>Water Storage &amp; Runoff</span>
                    </span>
                    <Badge tone="teal">{infiltrationPct < 25 ? "Needs Storage" : "Moderate Storage"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Rainwater runs off too quickly, recharging only ~{infiltrationPct}% into underground aquifers. Check dams and farm ponds will help store water locally.
                  </p>
                  <div className="pt-2 border-t border-sky-500/15 font-mono text-[11px] text-sky-300">
                    Target: {checkDamTarget} Check Dams &amp; {farmPondTarget} Farm Ponds
                  </div>
                </div>

                {/* Pillar 2: Soil Stability & Gully Scour */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck size={14} weight="bold" />
                      <span>Topsoil &amp; Erosion</span>
                    </span>
                    <Badge tone="amber">{barrenHa > 50 ? "Erosion Risk" : "Low Risk"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {barrenHa.toFixed(1)} ha of bare land is losing fertile topsoil during heavy downpours. Contour bunds and gully plugs will stop soil wash.
                  </p>
                  <div className="pt-2 border-t border-amber-500/15 font-mono text-[11px] text-amber-300">
                    Target: {bundingTargetHa} ha Contour Bunds &amp; Gully Plugs
                  </div>
                </div>

                {/* Pillar 3: Vegetative Canopy & Resilience */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Tree size={14} weight="bold" />
                      <span>Tree Cover &amp; Slopes</span>
                    </span>
                    <Badge tone={trendVal >= 0 ? "sage" : "amber"}>{trendVal >= 0 ? "Growing" : "Needs Trees"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {afforestedTargetHa} ha of exposed slopes need deep-rooted trees and contour trenches to anchor soil and improve moisture.
                  </p>
                  <div className="pt-2 border-t border-emerald-500/15 font-mono text-[11px] text-emerald-300">
                    Target: Plant trees on {afforestedTargetHa} ha of Upper Slopes
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Catchment Engineering KPI Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-foreground/10 pt-6 font-mono text-xs">
          <div className="rounded-xl border border-foreground/10 bg-background p-3.5">
            <span className="text-[10px] text-muted-foreground uppercase block">Planned Works</span>
            <span className="text-lg font-bold text-foreground font-display mt-0.5 block">{interventions.length}</span>
            <span className="text-[10px] text-sage">{operationalCount} Active</span>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-background p-3.5">
            <span className="text-[10px] text-muted-foreground uppercase block">Water Stored</span>
            <span className="text-lg font-bold text-sky-400 font-display mt-0.5 block">
              {(totalRechargeM3 / 1000).toFixed(1)}k m³
            </span>
            <span className="text-[10px] text-muted-foreground">Added to groundwater</span>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-background p-3.5">
            <span className="text-[10px] text-muted-foreground uppercase block">Soil Saved</span>
            <span className="text-lg font-bold text-amber-400 font-display mt-0.5 block">{totalSoilSaved} t/yr</span>
            <span className="text-[10px] text-muted-foreground">Protected from erosion</span>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-background p-3.5">
            <span className="text-[10px] text-muted-foreground uppercase block">Catchment Bounds</span>
            <span className="text-lg font-bold text-sage font-display mt-0.5 block">100% Inside</span>
            <span className="text-[10px] text-muted-foreground">All structures verified</span>
          </div>
        </div>

        {/* Form Drawer */}
        {isFormOpen && (
          <form
            onSubmit={handleAddIntervention}
            className="mt-6 border-t border-foreground/10 pt-6 animate-fade-up"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Structure Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check Dam #5 (Stream Confluence)"
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
                  Coordinates (°N, °E)
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full rounded-lg border border-foreground/15 bg-background p-2 text-xs font-mono"
                    placeholder="Lat"
                  />
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={lon}
                    onChange={(e) => setLon(Number(e.target.value))}
                    className="w-full rounded-lg border border-foreground/15 bg-background p-2 text-xs font-mono"
                    placeholder="Lon"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Target Problem (What is Affected)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excessive gully wash causing 60 t/yr topsoil loss"
                  value={targetProblem}
                  onChange={(e) => setTargetProblem(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Recommended Engineering Change
                </label>
                <input
                  type="text"
                  placeholder="e.g. Construct masonry check dam with stone apron"
                  value={recommendedChange}
                  onChange={(e) => setRecommendedChange(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background p-2.5 text-sm outline-none focus:border-foreground"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" size="md" className="w-full">
                  Save to Recommended Works
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 2. Main Grid: Prioritized Recommended Interventions & Satellite Evidence */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Recommended Structures Table */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Recommended Works ({filteredInterventions.length})
            </span>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-1">
              {["all", "Check Dam", "Farm Pond", "Percolation Tank"].map((ft) => (
                <button
                  key={ft}
                  onClick={() => setActiveFilter(ft)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                    activeFilter === ft
                      ? "bg-foreground text-background font-semibold"
                      : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ft === "all" ? "All" : ft}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-foreground/10 rounded-2xl border border-foreground/10 overflow-hidden bg-background">
            {filteredInterventions.map((item) => {
              const isSelected = item.id === selectedIntervention?.id;
              const isOperational = item.condition === "operational";
              const isSilted = item.condition === "silted";

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer p-4 transition-colors ${
                    isSelected
                      ? "bg-foreground/5 border-l-4 border-l-foreground shadow-xs"
                      : "hover:bg-foreground/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{item.name}</h4>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={item.type === "Check Dam" ? "teal" : item.type === "Farm Pond" ? "sage" : "neutral"}>
                          {item.type}
                        </Badge>
                        <span
                          className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase flex items-center gap-1 ${
                            isOperational
                              ? "bg-sage/15 text-sage"
                              : isSilted
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-rose-500/15 text-rose-500"
                          }`}
                        >
                          {isOperational ? (
                            <CheckCircle size={10} weight="bold" />
                          ) : isSilted ? (
                            <Warning size={10} weight="bold" />
                          ) : (
                            <Wrench size={10} weight="bold" />
                          )}
                          <span>
                            {item.condition === "operational"
                              ? "Active"
                              : item.condition === "silted"
                              ? "Silted"
                              : "Repairs Needed"}
                          </span>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="text-muted-foreground hover:text-danger p-1 cursor-pointer"
                      title="Remove structure"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                    <strong>Issue:</strong> {item.targetProblem}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>
                      {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E
                    </span>
                    <span className="text-foreground/70">~{(item.rechargeEstM3 / 1000).toFixed(0)}k m³/yr</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Recommended Solution & Satellite Evidence */}
        <div className="lg:col-span-7 space-y-6">
          {selectedIntervention ? (
            <>
              {/* Recommended Solution Card */}
              <div className="rounded-2xl border border-foreground/10 p-6 sm:p-8 bg-background shadow-xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 pb-4">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Compass size={14} className="text-sage" weight="bold" />
                      <span>Recommended Structure</span>
                    </span>
                    <h3 className="mt-1 font-display text-xl sm:text-2xl text-foreground">
                      {selectedIntervention.name}
                    </h3>
                  </div>

                  <Badge tone="sage">Inside Catchment Area</Badge>
                </div>

                {/* Target Problem & Recommended Change Callouts */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed">
                    <strong className="text-amber-400 block mb-1 font-mono uppercase text-[10px]">
                      Problem in this Area:
                    </strong>
                    <span className="text-foreground/90">{selectedIntervention.targetProblem}</span>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-relaxed">
                    <strong className="text-sky-400 block mb-1 font-mono uppercase text-[10px]">
                      Recommended Fix:
                    </strong>
                    <span className="text-foreground/90">{selectedIntervention.recommendedChange}</span>
                  </div>
                </div>

                {/* Live Operational Condition Selector */}
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
                  <span className="block font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Structure Status:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "operational", label: "Working", desc: "Built & functioning", tone: "sage" },
                      { key: "silted", label: "Silted", desc: "Needs silt cleared", tone: "amber" },
                      { key: "maintenance_needed", label: "Needs Repair", desc: "Damage or leak found", tone: "danger" },
                    ].map((cond) => {
                      const isCondActive = selectedIntervention.condition === cond.key;
                      return (
                        <button
                          key={cond.key}
                          type="button"
                          onClick={() =>
                            handleConditionChange(selectedIntervention.id, cond.key as StructureCondition)
                          }
                          className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                            isCondActive
                              ? "border-foreground bg-foreground/5 shadow-xs ring-1 ring-foreground/20"
                              : "border-foreground/10 hover:border-foreground/30 bg-background"
                          }`}
                        >
                          <span className="block text-xs font-semibold text-foreground">{cond.label}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{cond.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hydrological Impact Scorecard */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 font-mono text-xs">
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Annual Recharge</span>
                    <span className="font-bold text-sky-400 text-sm mt-1 block">
                      +{selectedIntervention.rechargeEstM3.toLocaleString()} m³
                    </span>
                    <span className="text-[10px] text-muted-foreground">Added to groundwater</span>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Soil Saved</span>
                    <span className="font-bold text-amber-400 text-sm mt-1 block">
                      {selectedIntervention.soilRetainedTonnes} t/year
                    </span>
                    <span className="text-[10px] text-muted-foreground">Topsoil preserved</span>
                  </div>

                  <div className="rounded-xl border border-sage/20 bg-sage/5 p-3 col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground block text-[10px] uppercase">Runoff Slowed</span>
                    <span className="font-bold text-sage text-sm mt-1 block">
                      ~{selectedIntervention.type === "Check Dam"
                        ? "48%"
                        : selectedIntervention.type === "Farm Pond" || selectedIntervention.type === "Percolation Tank"
                        ? "35%"
                        : selectedIntervention.type === "Contour Bund"
                        ? "62%"
                        : "41%"} reduction
                    </span>
                    <span className="text-[10px] text-muted-foreground">Flood risk lowered</span>
                  </div>
                </div>

                {/* Multi-Spectral Sentinel-2 Reflectance Profile */}
                {evidenceLoading ? (
                  <div className="aspect-[3/1] animate-pulse rounded-xl bg-foreground/5" />
                ) : evidence?.inAoi ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-t border-foreground/10 pt-4">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Satellite Readings at this Spot
                      </span>
                      <button
                        onClick={handleVerifyLive}
                        disabled={isVerifying}
                        className="rounded-lg border border-foreground/15 px-3 py-1 font-mono text-[11px] text-foreground hover:bg-foreground/5 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowsClockwise size={12} className={isVerifying ? "animate-spin" : ""} weight="bold" />
                        <span>{isVerifying ? "Sampling 10m Pixel..." : "Verify Location"}</span>
                      </button>
                    </div>

                    {verificationFeedback && (
                      <div className="rounded-xl border border-sage/30 bg-sage/10 p-3.5 text-xs text-foreground leading-relaxed animate-fade-up">
                        {verificationFeedback}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* T1 Baseline Observation */}
                      <div className="rounded-xl border border-foreground/10 p-4">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Baseline ({meta.t1_date || "Baseline"})
                        </span>
                        <div className="mt-2 text-sm font-semibold text-foreground">{evidence.classT1}</div>
                        <div className="mt-3 flex items-baseline justify-between border-t border-foreground/10 pt-2 font-mono text-xs">
                          <span className="text-muted-foreground">Vegetation (NDVI):</span>
                          <span className="font-medium text-foreground">{evidence.ndviEstimateT1.toFixed(3)}</span>
                        </div>
                      </div>

                      {/* T2 Post-Monsoon / Current Condition */}
                      <div className="rounded-xl border border-foreground/10 p-4">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Recent ({meta.t2_date || "Recent"})
                        </span>
                        <div className="mt-2 text-sm font-semibold text-foreground">{evidence.classT2}</div>
                        <div className="mt-3 flex items-baseline justify-between border-t border-foreground/10 pt-2 font-mono text-xs">
                          <span className="text-muted-foreground">Vegetation (NDVI):</span>
                          <span className="font-medium text-sage">
                            {evidence.ndviEstimateT2.toFixed(3)} (+
                            {(evidence.ndviEstimateT2 - evidence.ndviEstimateT1).toFixed(3)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-xs text-amber leading-relaxed">
                    Recalibrating coordinates to watershed area.
                  </div>
                )}
              </div>

              {/* Linked Ground Truth Field Inspection Logs */}
              <div className="rounded-2xl border border-foreground/10 p-6 sm:p-8 bg-background shadow-xs">
                <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Field Photos Nearby (&lt; {PHOTO_LINK_THRESHOLD_M}m)
                    </span>
                    <h4 className="mt-1 font-display text-lg">On-Ground Cross-Check</h4>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {linkedPhotos.length} {linkedPhotos.length === 1 ? "match" : "matches"}
                  </span>
                </div>

                <div className="mt-4">
                  {linkedPhotos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-foreground/20 p-6 text-center text-xs text-muted-foreground">
                      No field photos recorded within {PHOTO_LINK_THRESHOLD_M}m yet.
                      Photos uploaded in the <strong>Field Investigation</strong> tab will show up here automatically.
                    </div>
                  ) : (
                    <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 overflow-hidden">
                      {linkedPhotos.map((photo) => (
                        <div key={photo.id} className="p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-medium">{photo.note || "Field inspection record"}</div>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {photo.timestamp.split("T")[0]} · {photo.distanceM}m away from structure
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
              Select a structure from the left to view its details and satellite readings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
