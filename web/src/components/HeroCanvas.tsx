"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// Types & Math Helpers
// ============================================================================
type Point3D = { x: number; y: number; z: number };
type Segment3D = { p1: Point3D; p2: Point3D };

type WatershedSite = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  z: number;
  isPrimary?: boolean;
  code: string;
  tile: string;
};

// Design system colors
const SAGE_RGB = "78, 122, 61";
const TEAL_RGB = "43, 110, 130";
const CHARCOAL_RGB = "20, 20, 20";

// Lat/Lon to Cartesian 3D coordinates on unit sphere
function latLonToXYZ(latDeg: number, lonDeg: number): Point3D {
  const phi = (latDeg * Math.PI) / 180;
  const lambda = (lonDeg * Math.PI) / 180;
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: -Math.sin(phi), // Canvas Y points downward
    z: Math.cos(phi) * Math.cos(lambda),
  };
}

// Catmull-Rom spline interpolation for silky-smooth organic curves
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// ============================================================================
// Continental Keypoints (Smooth Geographic Silhouettes)
// ============================================================================
const CONTINENT_POLYGONS: [number, number][][] = [
  // Africa (Smooth North, Horn of Africa, Cape of Good Hope, Gulf of Guinea)
  [
    [36, -5], [37, 3], [37, 10], [33, 11], [32, 20], [31, 31],
    [27, 34], [22, 37], [13, 43], [11, 48], [11, 51],
    [5, 48], [-1, 42], [-6, 39], [-12, 40], [-18, 36], [-25, 33],
    [-30, 31], [-34, 25], [-34, 18], [-29, 16],
    [-22, 14], [-15, 12], [-8, 12], [-2, 9], [4, 7], [5, 1], [4, -6], [5, -10],
    [10, -15], [15, -17], [22, -16], [28, -13], [33, -8], [36, -5],
  ],
  // Eurasia & Indian Subcontinent
  [
    [36, -6], [38, -9], [43, -9], [47, -3], [50, 1], [54, 8], [57, 8],
    [60, 5], [63, 10], [70, 20], [71, 28], [68, 40], [67, 55], [71, 75],
    [73, 95], [76, 115], [72, 140], [66, 168], [62, 175],
    [58, 162], [52, 142], [46, 137], [40, 128], [36, 121], [32, 121],
    [25, 119], [22, 114], [21, 108],
    [16, 107], [10, 104], [3, 102], [1, 104], [6, 100], [12, 100], [16, 96], [21, 92],
    // Indian Subcontinent: Bengal -> Coromandel -> Kanyakumari -> Malabar -> Gujarat
    [22, 89], [19, 85], [16, 82], [13, 80], [10, 79.5],
    [8.2, 77.5], // Southern tip of India
    [10, 76], [13, 74.5], [16, 73.5], [19, 72.8], [21, 72.5],
    [22.5, 69.5], [23.5, 68.5], [24.5, 69],
    [25, 66], [25, 62], [25, 57],
    // Arabian Peninsula & Mediterranean
    [26, 56], [23, 58], [18, 56], [14, 50], [12.5, 44], [18, 41], [27, 35], [31, 35],
    [34, 35], [36, 36], [37, 30], [39, 26], [37, 22], [40, 18], [42, 14], [44, 9], [43, 3], [36, -5], [36, -6],
  ],
  // North America (Alaska, Canada, Florida, Gulf of Mexico, California)
  [
    [71, -156], [68, -140], [68, -125], [60, -85], [58, -65], [52, -56], [47, -53],
    [44, -66], [40, -73], [35, -75], [30, -81], [25, -80],
    [29, -84], [29, -89], [28, -96], [22, -97], [19, -93],
    [16, -88], [11, -84], [8, -78], [9, -83], [14, -92], [18, -102],
    [23, -107], [29, -114], [34, -119], [38, -123], [44, -124], [49, -125],
    [55, -132], [58, -137], [60, -145], [65, -168], [71, -156],
  ],
  // South America (Caribbean, Brazil bulge, Cape Horn, Chile)
  [
    [12, -72], [10, -64], [6, -56], [2, -50], [-2, -43], [-6, -35], [-12, -37], [-18, -39],
    [-23, -42], [-28, -48], [-34, -53], [-40, -62], [-48, -66], [-54, -68],
    [-54, -72], [-48, -74], [-40, -73], [-32, -71], [-22, -70], [-14, -76],
    [-5, -81], [0, -80], [6, -77], [12, -72],
  ],
  // Australia (Carpentaria, Great Barrier, Sydney, Melbourne, Bight, Perth)
  [
    [-12, 131], [-12, 136], [-11, 142], [-16, 145], [-22, 149], [-28, 153],
    [-34, 151], [-38, 147], [-38, 141], [-35, 137], [-32, 132], [-32, 126],
    [-35, 117], [-30, 114], [-24, 113], [-19, 120], [-15, 126], [-12, 131],
  ],
  // British Isles
  [[58, -4], [56, -1], [53, 0], [50, 1], [50, -5], [54, -5], [58, -4]],
  // Japan Arc
  [[45, 142], [41, 140], [36, 138], [33, 132], [31, 130], [34, 135], [43, 145], [45, 142]],
];

// ============================================================================
// Watershed Checkpoints: Widely separated across different continents
// ============================================================================
const RAW_WATERSHED_SITES = [
  {
    id: "kadwanchi",
    name: "KADWANCHI BASIN",
    region: "MH, INDIA",
    lat: 19.84,
    lon: 75.91,
    isPrimary: true,
    code: "ISRO EO TARGET",
    tile: "TILE 43QFB",
  },
  {
    id: "rhine",
    name: "UPPER RHINE",
    region: "EUROPE",
    lat: 48.58,
    lon: 7.75,
    isPrimary: false,
    code: "HYDRO STATION",
    tile: "TILE 32ULA",
  },
  {
    id: "sudd",
    name: "SUDD WETLANDS",
    region: "AFRICA",
    lat: 8.52,
    lon: 31.54,
    isPrimary: false,
    code: "NILE CATCHMENT",
    tile: "TILE 36NVK",
  },
  {
    id: "murray",
    name: "MURRAY-DARLING",
    region: "AUSTRALIA",
    lat: -34.18,
    lon: 142.12,
    isPrimary: false,
    code: "ARID BASIN",
    tile: "TILE 54HYF",
  },
  {
    id: "colorado",
    name: "COLORADO BASIN",
    region: "N. AMERICA",
    lat: 36.14,
    lon: -112.14,
    isPrimary: false,
    code: "RESERVOIR REF",
    tile: "TILE 12STA",
  },
];

const WATERSHED_SITES: WatershedSite[] = RAW_WATERSHED_SITES.map((s) => {
  const coords = latLonToXYZ(s.lat, s.lon);
  return { ...s, ...coords };
});

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;

    // --- State for 3D rotation & physics
    let rotX = 0.28;
    let rotY = -1.35;
    let targetRotX = 0.28;
    let targetRotY = -1.35;
    let rotVelY = 0.0016; // Base gentle rotation
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    // --- 1. Generate Smoothly Curved Dotted Continent Coastlines using Catmull-Rom Splines
    const smoothContinentSegments: Segment3D[] = [];
    const SPLINE_SUBDIVISIONS = 12; // 12 smooth sub-points per vertex pair

    CONTINENT_POLYGONS.forEach((poly) => {
      const n = poly.length;
      if (n < 3) return;

      const smoothPoints: Point3D[] = [];

      for (let i = 0; i < n; i++) {
        const p0 = poly[(i - 1 + n) % n];
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];
        const p3 = poly[(i + 2) % n];

        for (let s = 0; s < SPLINE_SUBDIVISIONS; s++) {
          const t = s / SPLINE_SUBDIVISIONS;
          const lat = catmullRom(p0[0], p1[0], p2[0], p3[0], t);
          const lon = catmullRom(p0[1], p1[1], p2[1], p3[1], t);
          smoothPoints.push(latLonToXYZ(lat, lon));
        }
      }

      // Connect consecutive smooth points into 3D segments
      for (let i = 0; i < smoothPoints.length; i++) {
        const pA = smoothPoints[i];
        const pB = smoothPoints[(i + 1) % smoothPoints.length];
        smoothContinentSegments.push({ p1: pA, p2: pB });
      }
    });

    // --- 2. Generate Minimal Ambient Sphere Points (Fibonacci distribution)
    const POINT_COUNT = 600;
    const PHI = Math.PI * (3 - Math.sqrt(5));
    const spherePoints: Point3D[] = [];

    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (i / (POINT_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = PHI * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      spherePoints.push({ x, y, z });
    }

    // --- 3. Pre-compute Latitude Parallels
    type WireSegment = { p1: Point3D; p2: Point3D };
    const latRings: WireSegment[][] = [];
    const latDegrees = [-60, -30, 0, 30, 60];
    const SEGMENTS_PER_RING = 60;

    latDegrees.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      const y = -Math.sin(rad);
      const r = Math.cos(rad);
      const ring: WireSegment[] = [];

      for (let s = 0; s < SEGMENTS_PER_RING; s++) {
        const theta1 = (s / SEGMENTS_PER_RING) * Math.PI * 2;
        const theta2 = ((s + 1) / SEGMENTS_PER_RING) * Math.PI * 2;
        ring.push({
          p1: { x: Math.sin(theta1) * r, y, z: Math.cos(theta1) * r },
          p2: { x: Math.sin(theta2) * r, y, z: Math.cos(theta2) * r },
        });
      }
      latRings.push(ring);
    });

    // --- 4. Satellite Orbit Parameters (Revolving outside the Earth in its orbit)
    const ORBIT_RADIUS_RATIO = 1.28;
    const ORBIT_TILT_X = 0.42;
    const ORBIT_TILT_Z = 0.32;
    let satelliteAngle = 0;

    // --- Resize handler
    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(1, 0, 0, 1, 0, 0);
      ctx?.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    // --- 3D Rotation (Yaw around Y, Pitch around X)
    function rotatePoint(x: number, y: number, z: number, rx: number, ry: number): Point3D {
      // Rotate around Y
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate around X
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      return { x: x1, y: y2, z: z2 };
    }

    // --- Main Animation Render Loop
    function render(timestamp: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Smooth damping / physics
      if (!isDragging) {
        targetRotY += rotVelY;
        rotX += (targetRotX - rotX) * 0.05;
        rotY += (targetRotY - rotY) * 0.08;
      } else {
        rotX = targetRotX;
        rotY = targetRotY;
      }

      // Satellite revolving in outer orbit
      satelliteAngle += 0.015;

      const sphereRadius = Math.min(width, height) * 0.38;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const focalLength = sphereRadius * 3.5;

      // ----------------------------------------------------------------------
      // 1. Atmospheric Back-Glow & Earth Base Disc
      // ----------------------------------------------------------------------
      const haloGrad = ctx.createRadialGradient(cx, cy, sphereRadius * 0.25, cx, cy, sphereRadius * 1.32);
      haloGrad.addColorStop(0, `rgba(${SAGE_RGB}, 0.08)`);
      haloGrad.addColorStop(0.5, `rgba(${TEAL_RGB}, 0.03)`);
      haloGrad.addColorStop(1, "rgba(240, 240, 240, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.32, 0, Math.PI * 2);
      ctx.fill();

      // Earth body perimeter circle
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, 0.09)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // ----------------------------------------------------------------------
      // 2. Latitude Wireframe Graticules
      // ----------------------------------------------------------------------
      ctx.save();
      latRings.forEach((ring, idx) => {
        const isEquator = idx === 2;
        for (let i = 0; i < ring.length; i += 2) {
          const seg = ring[i];
          const p1 = rotatePoint(seg.p1.x, seg.p1.y, seg.p1.z, rotX, rotY);
          const p2 = rotatePoint(seg.p2.x, seg.p2.y, seg.p2.z, rotX, rotY);
          const midZ = (p1.z + p2.z) * 0.5;

          const scale1 = focalLength / (focalLength + p1.z * sphereRadius);
          const scale2 = focalLength / (focalLength + p2.z * sphereRadius);

          const sx1 = cx + p1.x * sphereRadius * scale1;
          const sy1 = cy + p1.y * sphereRadius * scale1;
          const sx2 = cx + p2.x * sphereRadius * scale2;
          const sy2 = cy + p2.y * sphereRadius * scale2;

          let alpha = midZ > 0 ? 0.06 + midZ * 0.09 : 0.02;
          if (isEquator && midZ > 0) alpha = Math.min(0.22, alpha * 1.4);

          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.strokeStyle = isEquator ? `rgba(${SAGE_RGB}, ${alpha})` : `rgba(${CHARCOAL_RGB}, ${alpha})`;
          ctx.lineWidth = isEquator && midZ > 0 ? 0.85 : 0.5;
          ctx.stroke();
        }
      });
      ctx.restore();

      // ----------------------------------------------------------------------
      // 3. Ambient Fibonacci Dot Grid
      // ----------------------------------------------------------------------
      for (let i = 0; i < spherePoints.length; i++) {
        const pt = spherePoints[i];
        const r = rotatePoint(pt.x, pt.y, pt.z, rotX, rotY);
        const scale = focalLength / (focalLength + r.z * sphereRadius);
        const sx = cx + r.x * sphereRadius * scale;
        const sy = cy + r.y * sphereRadius * scale;

        if (r.z > 0) {
          const alpha = 0.08 + r.z * 0.18;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.0 * scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${alpha})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, 0.65 * scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, 0.02)`;
          ctx.fill();
        }
      }

      // ----------------------------------------------------------------------
      // 4. Smooth Curved Continents with DOTTED EDGES (Zero Sharp Corners)
      // ----------------------------------------------------------------------
      ctx.save();
      // Set architectural dotted line pattern
      ctx.setLineDash([2, 3.5]);

      smoothContinentSegments.forEach((seg) => {
        const p1 = rotatePoint(seg.p1.x, seg.p1.y, seg.p1.z, rotX, rotY);
        const p2 = rotatePoint(seg.p2.x, seg.p2.y, seg.p2.z, rotX, rotY);

        const midZ = (p1.z + p2.z) * 0.5;

        // Front-facing continent smooth curves
        if (midZ > 0) {
          const scale1 = focalLength / (focalLength + p1.z * sphereRadius);
          const scale2 = focalLength / (focalLength + p2.z * sphereRadius);

          const sx1 = cx + p1.x * sphereRadius * scale1;
          const sy1 = cy + p1.y * sphereRadius * scale1;
          const sx2 = cx + p2.x * sphereRadius * scale2;
          const sy2 = cy + p2.y * sphereRadius * scale2;

          // Lighter, elegant dotted continent contours
          const alpha = Math.min(0.45, 0.15 + midZ * 0.28);

          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, ${alpha})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        } else if (midZ > -0.25) {
          // Faint optical limb falloff
          const scale1 = focalLength / (focalLength + p1.z * sphereRadius);
          const scale2 = focalLength / (focalLength + p2.z * sphereRadius);

          const sx1 = cx + p1.x * sphereRadius * scale1;
          const sy1 = cy + p1.y * sphereRadius * scale1;
          const sx2 = cx + p2.x * sphereRadius * scale2;
          const sy2 = cy + p2.y * sphereRadius * scale2;

          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, 0.04)`;
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      });
      ctx.restore();

      // ----------------------------------------------------------------------
      // 5. Outer Satellite Orbit Ring & Satellite Revolving Outside
      // ----------------------------------------------------------------------
      const ORBIT_RADIUS = sphereRadius * ORBIT_RADIUS_RATIO;
      const ORBIT_STEPS = 80;

      // Draw the complete 3D Outer Orbit Path
      ctx.save();
      ctx.setLineDash([3, 4]);

      for (let s = 0; s < ORBIT_STEPS; s += 2) {
        const a1 = (s / ORBIT_STEPS) * Math.PI * 2;
        const a2 = ((s + 1) / ORBIT_STEPS) * Math.PI * 2;

        let ox1 = Math.cos(a1);
        let oy1 = 0;
        let oz1 = Math.sin(a1);

        let ox2 = Math.cos(a2);
        let oy2 = 0;
        let oz2 = Math.sin(a2);

        // Apply orbital inclination tilt
        const cosTx = Math.cos(ORBIT_TILT_X);
        const sinTx = Math.sin(ORBIT_TILT_X);
        const cosTz = Math.cos(ORBIT_TILT_Z);
        const sinTz = Math.sin(ORBIT_TILT_Z);

        const toy1 = oy1 * cosTx - oz1 * sinTx;
        const toz1 = oy1 * sinTx + oz1 * cosTx;
        const tox1 = ox1 * cosTz - toy1 * sinTz;
        const tfy1 = ox1 * sinTz + toy1 * cosTz;

        const toy2 = oy2 * cosTx - oz2 * sinTx;
        const toz2 = oy2 * sinTx + oz2 * cosTx;
        const tox2 = ox2 * cosTz - toy2 * sinTz;
        const tfy2 = ox2 * sinTz + toy2 * cosTz;

        // Apply globe rotation
        const op1 = rotatePoint(tox1, tfy1, toz1, rotX * 0.7, rotY * 0.75);
        const op2 = rotatePoint(tox2, tfy2, toz2, rotX * 0.7, rotY * 0.75);

        const midZ = (op1.z + op2.z) * 0.5;
        const isFront = midZ > 0;
        const alpha = isFront ? 0.22 + midZ * 0.22 : 0.04 + (midZ + 1) * 0.05;

        const sScale1 = focalLength / (focalLength + op1.z * ORBIT_RADIUS);
        const sScale2 = focalLength / (focalLength + op2.z * ORBIT_RADIUS);

        ctx.beginPath();
        ctx.moveTo(cx + op1.x * ORBIT_RADIUS * sScale1, cy + op1.y * ORBIT_RADIUS * sScale1);
        ctx.lineTo(cx + op2.x * ORBIT_RADIUS * sScale2, cy + op2.y * ORBIT_RADIUS * sScale2);
        ctx.strokeStyle = `rgba(${TEAL_RGB}, ${alpha})`;
        ctx.lineWidth = isFront ? 1.1 : 0.7;
        ctx.stroke();
      }
      ctx.restore();

      // Satellite Craft revolving outside in orbit
      const satBaseX = Math.cos(satelliteAngle);
      const satBaseY = 0;
      const satBaseZ = Math.sin(satelliteAngle);

      const cosTx = Math.cos(ORBIT_TILT_X);
      const sinTx = Math.sin(ORBIT_TILT_X);
      const cosTz = Math.cos(ORBIT_TILT_Z);
      const sinTz = Math.sin(ORBIT_TILT_Z);

      const stoy = satBaseY * cosTx - satBaseZ * sinTx;
      const stoz = satBaseY * sinTx + satBaseZ * cosTx;
      const stox = satBaseX * cosTz - stoy * sinTz;
      const stfy = satBaseX * sinTz + stoy * cosTz;

      const satRot = rotatePoint(stox, stfy, stoz, rotX * 0.7, rotY * 0.75);
      const satScale = focalLength / (focalLength + satRot.z * ORBIT_RADIUS);
      const satX = cx + satRot.x * ORBIT_RADIUS * satScale;
      const satY = cy + satRot.y * ORBIT_RADIUS * satScale;

      const satAlpha = satRot.z > 0 ? 0.95 : 0.25;

      // Sub-satellite tracking line down to Earth surface
      const groundScale = focalLength / (focalLength + satRot.z * sphereRadius);
      const groundX = cx + satRot.x * sphereRadius * groundScale;
      const groundY = cy + satRot.y * sphereRadius * groundScale;

      if (satRot.z > 0.05) {
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(groundX, groundY);
        ctx.strokeStyle = `rgba(${TEAL_RGB}, ${satAlpha * 0.4})`;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(groundX, groundY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${SAGE_RGB}, ${satAlpha * 0.75})`;
        ctx.fill();
      }

      // Render Satellite Craft
      ctx.save();
      ctx.translate(satX, satY);

      // Central bus
      ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${satAlpha})`;
      ctx.fillRect(-3.5, -3, 7, 6);

      // Solar Array Wings
      ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, ${satAlpha * 0.85})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();

      // Blue photovoltaic panels
      ctx.fillStyle = `rgba(${TEAL_RGB}, ${satAlpha * 0.9})`;
      ctx.fillRect(-11, -2, 5, 4);
      ctx.fillRect(6, -2, 5, 4);

      // Radar strobe ring
      const pingProgress = (timestamp * 0.0028) % 1;
      const pingRadius = 4 + pingProgress * 15;
      const pingAlpha = (1 - pingProgress) * (satRot.z > 0 ? 0.65 : 0.15);

      ctx.beginPath();
      ctx.arc(0, 0, pingRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${TEAL_RGB}, ${pingAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Satellite label tag (when front-facing)
      if (satRot.z > 0.1) {
        ctx.font = "bold 9px var(--font-mono, monospace)";
        ctx.fillStyle = `rgba(${TEAL_RGB}, ${satAlpha * 0.95})`;
        ctx.fillText("ResourceSat-2A", 15, -3);

        ctx.font = "8px var(--font-mono, monospace)";
        ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${satAlpha * 0.7})`;
        ctx.fillText("ISRO // 817KM ORBIT", 15, 7);
      }
      ctx.restore();

      // ----------------------------------------------------------------------
      // 6. Watershed Geo-Coordinate Callouts (Widely spaced, no collision)
      // ----------------------------------------------------------------------
      WATERSHED_SITES.forEach((site) => {
        const r = rotatePoint(site.x, site.y, site.z, rotX, rotY);

        // Only display if facing front of globe to prevent collision
        if (r.z <= 0.28) return;

        const scale = focalLength / (focalLength + r.z * sphereRadius);
        const pinX = cx + r.x * sphereRadius * scale;
        const pinY = cy + r.y * sphereRadius * scale;

        const depthAlpha = Math.min(1, Math.max(0, (r.z - 0.28) / 0.45));
        const isPrimary = site.isPrimary;
        const accentRgb = isPrimary ? SAGE_RGB : TEAL_RGB;

        // Target Reticle
        ctx.beginPath();
        ctx.arc(pinX, pinY, isPrimary ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentRgb}, ${depthAlpha})`;
        ctx.fill();

        // Pulsing radar ring on primary site (Kadwanchi)
        if (isPrimary) {
          const pingPhase = (timestamp * 0.0022) % 1;
          const pingRadius = 4 + pingPhase * 16;
          const pingOpacity = (1 - pingPhase) * depthAlpha * 0.7;
          ctx.beginPath();
          ctx.arc(pinX, pinY, pingRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${SAGE_RGB}, ${pingOpacity})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Leader Line & Callout Box
        const elbowDirX = pinX > cx ? 1 : -1;
        const elbowDirY = pinY > cy ? 1 : -1;
        const elbowX = pinX + elbowDirX * (isPrimary ? 24 : 18);
        const elbowY = pinY + elbowDirY * (isPrimary ? 22 : 16);
        const endX = elbowX + elbowDirX * (isPrimary ? 64 : 48);

        ctx.beginPath();
        ctx.moveTo(pinX, pinY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(endX, elbowY);
        ctx.strokeStyle = `rgba(${accentRgb}, ${depthAlpha * (isPrimary ? 0.75 : 0.45)})`;
        ctx.lineWidth = isPrimary ? 1.2 : 0.85;
        ctx.stroke();

        // Monospace Text
        ctx.save();
        const textAnchor = elbowDirX > 0 ? "left" : "right";
        ctx.textAlign = textAnchor;
        const textX = elbowDirX > 0 ? elbowX + 4 : elbowX - 4;

        if (isPrimary) {
          ctx.font = "bold 11px var(--font-mono, monospace)";
          ctx.fillStyle = `rgba(${SAGE_RGB}, ${depthAlpha})`;
          ctx.fillText(`[ ${site.name} ]`, textX, elbowY - 6);

          ctx.font = "9px var(--font-mono, monospace)";
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${depthAlpha * 0.85})`;
          ctx.fillText(`${site.lat.toFixed(2)}°N, ${site.lon.toFixed(2)}°E // ${site.tile}`, textX, elbowY + 12);
        } else {
          ctx.font = "10px var(--font-mono, monospace)";
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${depthAlpha * 0.9})`;
          ctx.fillText(site.name, textX, elbowY - 4);

          ctx.font = "8.5px var(--font-mono, monospace)";
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${depthAlpha * 0.6})`;
          ctx.fillText(`${Math.abs(site.lat).toFixed(1)}°${site.lat >= 0 ? "N" : "S"}, ${Math.abs(site.lon).toFixed(1)}°${site.lon >= 0 ? "E" : "W"} // ${site.region}`, textX, elbowY + 10);
        }
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    // --- Interactive Pointer Handlers
    function onPointerMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (isDragging) {
        const deltaX = clientX - lastPointerX;
        const deltaY = clientY - lastPointerY;
        lastPointerX = clientX;
        lastPointerY = clientY;

        targetRotY += deltaX * 0.007;
        targetRotX = Math.max(-0.85, Math.min(0.85, targetRotX + deltaY * 0.007));
      } else {
        const nx = (clientX / width - 0.5) * 2;
        const ny = (clientY / height - 0.5) * 2;
        targetRotX = 0.28 + ny * 0.22;
        rotVelY = 0.0016 + nx * 0.003;
      }
    }

    function onPointerDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      lastPointerX = e.clientX - rect.left;
      lastPointerY = e.clientY - rect.top;
      isDragging = true;
      rotVelY = 0;
    }

    function onPointerUp() {
      isDragging = false;
      rotVelY = 0.0016;
    }

    function onMouseLeave() {
      isDragging = false;
      targetRotX = 0.28;
      rotVelY = 0.0016;
    }

    // Touch handlers for mobile
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        const rect = canvas!.getBoundingClientRect();
        lastPointerX = e.touches[0].clientX - rect.left;
        lastPointerY = e.touches[0].clientY - rect.top;
        isDragging = true;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (isDragging && e.touches.length === 1) {
        const rect = canvas!.getBoundingClientRect();
        const clientX = e.touches[0].clientX - rect.left;
        const clientY = e.touches[0].clientY - rect.top;
        const deltaX = clientX - lastPointerX;
        const deltaY = clientY - lastPointerY;
        lastPointerX = clientX;
        lastPointerY = clientY;

        targetRotY += deltaX * 0.008;
        targetRotX = Math.max(-0.85, Math.min(0.85, targetRotX + deltaY * 0.008));
      }
    }

    function onTouchEnd() {
      isDragging = false;
      rotVelY = 0.0016;
    }

    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("mouseleave", onMouseLeave);

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);

      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing select-none"
      aria-hidden="true"
    />
  );
}
