"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// Types & Math Helpers
// ============================================================================
type Point3D = {
  x: number;
  y: number;
  z: number;
  isAccent?: boolean;
  isTeal?: boolean;
  baseSize: number;
};

type RingSegment = {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
};

// Colors from design system (monochrome base + sage/teal accents)
const SAGE_RGB = "78, 122, 61";
const TEAL_RGB = "43, 110, 130";
const CHARCOAL_RGB = "20, 20, 20";

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
    let rotX = 0.28; // initial axial tilt ~16 deg
    let rotY = 0.45;
    let targetRotX = 0.28;
    let targetRotY = 0.45;
    let rotVelY = 0.0028; // base idle spin speed
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    // --- Generate Fibonacci Sphere Point Cloud (1,050 points)
    const POINT_COUNT = 1050;
    const PHI = Math.PI * (3 - Math.sqrt(5)); // Golden angle ~2.39996 rad
    const spherePoints: Point3D[] = [];

    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (i / (POINT_COUNT - 1)) * 2; // from 1 to -1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = PHI * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Designate periodic points as active geospatial / sensor nodes
      const isAccent = i % 83 === 0 || i % 117 === 0;
      const isTeal = !isAccent && (i % 97 === 0 || i % 139 === 0);
      const baseSize = isAccent || isTeal ? 2.6 : 1.35;

      spherePoints.push({ x, y, z, isAccent, isTeal, baseSize });
    }

    // --- Pre-compute Latitude Parallels (wireframe rings)
    const latRings: RingSegment[][] = [];
    const latDegrees = [-65, -45, -25, 0, 25, 45, 65];
    const SEGMENTS_PER_RING = 72;

    latDegrees.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      const y = Math.sin(rad);
      const r = Math.cos(rad);
      const ring: RingSegment[] = [];

      for (let s = 0; s < SEGMENTS_PER_RING; s++) {
        const theta1 = (s / SEGMENTS_PER_RING) * Math.PI * 2;
        const theta2 = ((s + 1) / SEGMENTS_PER_RING) * Math.PI * 2;
        ring.push({
          x1: Math.cos(theta1) * r,
          y1: y,
          z1: Math.sin(theta1) * r,
          x2: Math.cos(theta2) * r,
          y2: y,
          z2: Math.sin(theta2) * r,
        });
      }
      latRings.push(ring);
    });

    // --- Pre-compute Longitude Meridians (great circles)
    const lonRings: RingSegment[][] = [];
    const lonCount = 6;
    for (let m = 0; m < lonCount; m++) {
      const lonAngle = (m / lonCount) * Math.PI;
      const ring: RingSegment[] = [];
      for (let s = 0; s < SEGMENTS_PER_RING; s++) {
        const theta1 = (s / SEGMENTS_PER_RING) * Math.PI * 2;
        const theta2 = ((s + 1) / SEGMENTS_PER_RING) * Math.PI * 2;
        // Circle in plane rotated by lonAngle
        const p1x = Math.sin(theta1) * Math.cos(lonAngle);
        const p1y = Math.cos(theta1);
        const p1z = Math.sin(theta1) * Math.sin(lonAngle);

        const p2x = Math.sin(theta2) * Math.cos(lonAngle);
        const p2y = Math.cos(theta2);
        const p2z = Math.sin(theta2) * Math.sin(lonAngle);

        ring.push({ x1: p1x, y1: p1y, z1: p1z, x2: p2x, y2: p2y, z2: p2z });
      }
      lonRings.push(ring);
    }

    // --- Orbiting Satellite Trackers
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

    // --- Rotation Helpers (Yaw around Y, then Pitch around X)
    function rotatePoint(x: number, y: number, z: number, rx: number, ry: number) {
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

    // --- Light direction for 3D diffuse reflection (upper-left-front)
    const lx = -0.45;
    const ly = -0.55;
    const lz = 0.7;
    const lMag = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const nlx = lx / lMag;
    const nly = ly / lMag;
    const nlz = lz / lMag;

    // --- Main Render Loop
    function render(timestamp: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Smooth physics / dampening
      if (!isDragging) {
        // Natural idle rotation + smooth return to target
        targetRotY += rotVelY;
        rotX += (targetRotX - rotX) * 0.05;
        rotY += (targetRotY - rotY) * 0.08;
      } else {
        rotX = targetRotX;
        rotY = targetRotY;
      }

      satelliteAngle += 0.016;

      const sphereRadius = Math.min(width, height) * 0.38;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const focalLength = sphereRadius * 3.5;

      // 1. Soft atmospheric back-glow / ambient halo behind sphere
      const haloGrad = ctx.createRadialGradient(cx, cy, sphereRadius * 0.3, cx, cy, sphereRadius * 1.35);
      haloGrad.addColorStop(0, `rgba(${SAGE_RGB}, 0.08)`);
      haloGrad.addColorStop(0.5, `rgba(${TEAL_RGB}, 0.035)`);
      haloGrad.addColorStop(1, "rgba(240, 240, 240, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Faint subtle outer boundary ring
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, 0.06)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Render Latitude and Longitude Wireframe Rings
      const renderRing = (ring: RingSegment[], isEquator = false) => {
        // Process segments with depth
        for (let i = 0; i < ring.length; i += 2) {
          const seg = ring[i];
          const p1 = rotatePoint(seg.x1, seg.y1, seg.z1, rotX, rotY);
          const p2 = rotatePoint(seg.x2, seg.y2, seg.z2, rotX, rotY);

          const midZ = (p1.z + p2.z) * 0.5;
          const isFront = midZ > 0;

          const scale1 = focalLength / (focalLength + p1.z * sphereRadius);
          const scale2 = focalLength / (focalLength + p2.z * sphereRadius);

          const sx1 = cx + p1.x * sphereRadius * scale1;
          const sy1 = cy + p1.y * sphereRadius * scale1;
          const sx2 = cx + p2.x * sphereRadius * scale2;
          const sy2 = cy + p2.y * sphereRadius * scale2;

          let alpha = isFront ? 0.16 + midZ * 0.22 : 0.04 + (midZ + 1) * 0.06;
          if (isEquator && isFront) alpha = Math.min(0.45, alpha * 1.4);

          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.strokeStyle = isEquator
            ? `rgba(${SAGE_RGB}, ${alpha})`
            : `rgba(${CHARCOAL_RGB}, ${alpha})`;
          ctx.lineWidth = isFront ? 1.1 : 0.75;
          ctx.stroke();
        }
      };

      latRings.forEach((ring, idx) => renderRing(ring, idx === 3));
      lonRings.forEach((ring) => renderRing(ring, false));

      // 4. Render 3D Inclined Orbital Satellite Ring
      const ORBIT_RADIUS = sphereRadius * 1.28;
      const ORBIT_TILT_X = 0.52; // ~30 deg
      const orbitSegments = 80;

      ctx.save();
      for (let s = 0; s < orbitSegments; s += 2) {
        const a1 = (s / orbitSegments) * Math.PI * 2;
        const a2 = ((s + 1) / orbitSegments) * Math.PI * 2;

        const ox1 = Math.cos(a1);
        const oy1 = 0;
        const oz1 = Math.sin(a1);

        const ox2 = Math.cos(a2);
        const oy2 = 0;
        const oz2 = Math.sin(a2);

        // Tilt orbit plane around X
        const cosTx = Math.cos(ORBIT_TILT_X);
        const sinTx = Math.sin(ORBIT_TILT_X);
        const toy1 = oy1 * cosTx - oz1 * sinTx;
        const toz1 = oy1 * sinTx + oz1 * cosTx;
        const toy2 = oy2 * cosTx - oz2 * sinTx;
        const toz2 = oy2 * sinTx + oz2 * cosTx;

        // Apply sphere global rotation
        const op1 = rotatePoint(ox1, toy1, toz1, rotX * 0.7, rotY * 0.85);
        const op2 = rotatePoint(ox2, toy2, toz2, rotX * 0.7, rotY * 0.85);

        const midZ = (op1.z + op2.z) * 0.5;
        const isFront = midZ > 0;
        const alpha = isFront ? 0.24 + midZ * 0.28 : 0.05 + (midZ + 1) * 0.06;

        const sScale1 = focalLength / (focalLength + op1.z * ORBIT_RADIUS);
        const sScale2 = focalLength / (focalLength + op2.z * ORBIT_RADIUS);

        ctx.beginPath();
        ctx.moveTo(cx + op1.x * ORBIT_RADIUS * sScale1, cy + op1.y * ORBIT_RADIUS * sScale1);
        ctx.lineTo(cx + op2.x * ORBIT_RADIUS * sScale2, cy + op2.y * ORBIT_RADIUS * sScale2);
        ctx.strokeStyle = `rgba(${TEAL_RGB}, ${alpha})`;
        ctx.lineWidth = isFront ? 1.2 : 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // 5. Orbiting Satellite Node (Sentinel-2 survey pulse)
      const satBaseX = Math.cos(satelliteAngle);
      const satBaseY = 0;
      const satBaseZ = Math.sin(satelliteAngle);
      const satTiltY = satBaseY * Math.cos(ORBIT_TILT_X) - satBaseZ * Math.sin(ORBIT_TILT_X);
      const satTiltZ = satBaseY * Math.sin(ORBIT_TILT_X) + satBaseZ * Math.cos(ORBIT_TILT_X);
      const satRot = rotatePoint(satBaseX, satTiltY, satTiltZ, rotX * 0.7, rotY * 0.85);

      const satScale = focalLength / (focalLength + satRot.z * ORBIT_RADIUS);
      const satScreenX = cx + satRot.x * ORBIT_RADIUS * satScale;
      const satScreenY = cy + satRot.y * ORBIT_RADIUS * satScale;
      const satAlpha = satRot.z > 0 ? 0.9 : 0.25;

      // Draw satellite core
      ctx.beginPath();
      ctx.arc(satScreenX, satScreenY, 3.2 * satScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL_RGB}, ${satAlpha})`;
      ctx.fill();

      // Pulsing telemetry radar ring
      const pulsePhase = (timestamp * 0.003) % 1;
      const pulseRadius = 3.5 + pulsePhase * 16;
      const pulseAlpha = Math.max(0, (1 - pulsePhase) * (satRot.z > 0 ? 0.6 : 0.15));
      ctx.beginPath();
      ctx.arc(satScreenX, satScreenY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${TEAL_RGB}, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 6. Project & Depth-Sort Sphere Surface Points
      type ProjectedPoint = {
        sx: number;
        sy: number;
        z: number;
        scale: number;
        alpha: number;
        size: number;
        isAccent?: boolean;
        isTeal?: boolean;
      };

      const projected: ProjectedPoint[] = [];

      for (let i = 0; i < spherePoints.length; i++) {
        const pt = spherePoints[i];
        const r = rotatePoint(pt.x, pt.y, pt.z, rotX, rotY);

        // Perspective scale
        const scale = focalLength / (focalLength + r.z * sphereRadius);
        const sx = cx + r.x * sphereRadius * scale;
        const sy = cy + r.y * sphereRadius * scale;

        // Diffuse surface lighting
        const diffuse = Math.max(0, r.x * nlx + r.y * nly + r.z * nlz);

        let alpha: number;
        let size: number;

        if (r.z > 0) {
          // Front hemisphere: crisp, depth-modulated, illuminated
          const frontFactor = r.z; // 0 to 1
          alpha = 0.28 + frontFactor * 0.45 + diffuse * 0.25;
          size = pt.baseSize * (0.85 + frontFactor * 0.65) * scale;
        } else {
          // Back hemisphere: faded, smaller, optical depth
          const backFactor = (r.z + 1) * 0.5; // 0 (far back) to 0.5 (equator edge)
          alpha = 0.04 + backFactor * 0.18;
          size = (pt.baseSize * 0.7) * scale;
        }

        projected.push({
          sx,
          sy,
          z: r.z,
          scale,
          alpha: Math.min(1, Math.max(0.02, alpha)),
          size: Math.max(0.7, size),
          isAccent: pt.isAccent,
          isTeal: pt.isTeal,
        });
      }

      // Sort points back-to-front for proper depth rendering
      projected.sort((a, b) => a.z - b.z);

      // 7. Render Surface Constellation Mesh (connect close front-facing points)
      ctx.lineWidth = 0.75;
      const MAX_DIST = sphereRadius * 0.19;

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        if (p1.z <= 0.15) continue; // Only front hemisphere connections

        // Check nearby neighbors
        for (let j = i + 1; j < Math.min(i + 14, projected.length); j++) {
          const p2 = projected[j];
          if (p2.z <= 0.15) continue;

          const dx = p1.sx - p2.sx;
          const dy = p1.sy - p2.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_DIST) {
            const lineAlpha = (1 - dist / MAX_DIST) * 0.14 * ((p1.z + p2.z) * 0.5);
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.strokeStyle = `rgba(${CHARCOAL_RGB}, ${lineAlpha})`;
            ctx.stroke();
          }
        }
      }

      // 8. Render All Projected Points
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];

        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, pt.size, 0, Math.PI * 2);

        if (pt.isAccent) {
          ctx.fillStyle = `rgba(${SAGE_RGB}, ${pt.alpha * 1.2})`;
          ctx.fill();

          // Subtle glowing halo around active sensor nodes (if front-facing)
          if (pt.z > 0.35) {
            ctx.beginPath();
            ctx.arc(pt.sx, pt.sy, pt.size * 2.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${SAGE_RGB}, ${pt.alpha * 0.2})`;
            ctx.fill();
          }
        } else if (pt.isTeal) {
          ctx.fillStyle = `rgba(${TEAL_RGB}, ${pt.alpha * 1.15})`;
          ctx.fill();

          if (pt.z > 0.35) {
            ctx.beginPath();
            ctx.arc(pt.sx, pt.sy, pt.size * 2.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${TEAL_RGB}, ${pt.alpha * 0.18})`;
            ctx.fill();
          }
        } else {
          ctx.fillStyle = `rgba(${CHARCOAL_RGB}, ${pt.alpha})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    // --- Interactive Mouse / Touch Handlers
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
        // Parallax cursor tracking
        const nx = (clientX / width - 0.5) * 2;
        const ny = (clientY / height - 0.5) * 2;
        targetRotX = 0.28 + ny * 0.22;
        rotVelY = 0.0028 + nx * 0.0035;
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
      rotVelY = 0.0028;
    }

    function onMouseLeave() {
      isDragging = false;
      targetRotX = 0.28;
      rotVelY = 0.0028;
    }

    // Touch events for mobile
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
      rotVelY = 0.0028;
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
