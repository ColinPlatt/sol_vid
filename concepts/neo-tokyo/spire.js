// 摩天楼 SPIRE: orbiting one endless megatower built from the epoch, one segment per block, as the camera spirals up
// through the haze. Segment height follows gas, lit windows its logs bloom, and each carries a neon ring and a
// vertical sign with its word. Lower city towers and flying traffic circle below. One full orbit per loop.
import { TAU, block, bit, clamp, mixRGB, rgb, wrap, verticalSign, hologram, rain, vignette, turn } from "./kit.js";

const FOG = [20, 40, 70], GLOW = [0, 229, 255];
export function spire(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block);
  const yaw = t * TAU, rise = t * n, F = S * 0.9, CAM = 7.5, VY = S * 0.52;
  // World point (x, y, z) around the tower axis -> screen, orbiting by yaw. y is up, in segments relative to the camera.
  const proj = (x, y, z) => {
    const cx = x * Math.cos(yaw) - z * Math.sin(yaw), cz = x * Math.sin(yaw) + z * Math.cos(yaw) + CAM;
    return cz <= 0.2 ? null : [S / 2 + cx * F / cz, VY - y * F / cz, F / cz, cz];
  };
  // Teal-and-amber night, a second palette for the series.
  const sky = ctx.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, rgb([3, 8, 16])); sky.addColorStop(0.6, rgb(FOG)); sky.addColorStop(1, rgb([60, 40, 30]));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  // Distant towers on a ring, parallaxing as we orbit.
  for (let k = 0; k < 40; k++) {
    const h = blocks[k % n].hash, ang = k / 40 * TAU, r = 18 + h[k % 32] / 255 * 10, height = 2 + h[(k + 1) % 32] / 255 * 9;
    const base = proj(Math.cos(ang) * r, -6 - wrap(rise * 0.3, 1), Math.sin(ang) * r), top = proj(Math.cos(ang) * r, -6 + height - wrap(rise * 0.3, 1), Math.sin(ang) * r);
    if (!base || !top) continue;
    const w = Math.max(2, base[2] * 1.4), fog = clamp(base[3] / 32, 0, 1);
    ctx.fillStyle = rgb(mixRGB([10, 16, 30], FOG, 0.5 + fog * 0.4)); ctx.fillRect(top[0] - w / 2, top[1], w, base[1] - top[1]);
    for (let q = 0; q < 8; q++) if (h[(k + q) % 32] & 1) { ctx.fillStyle = rgb(mixRGB([255, 180, 90], FOG, 0.5), 0.6); ctx.fillRect(top[0] - w * 0.3, top[1] + (base[1] - top[1]) * q / 8, 1.2, 1.2); }
  }
  // The tower: segments stacked upward; the camera rises one segment per block, so they stream down past us.
  const segs = [];
  for (const b of blocks) for (const lap of [-1, 0, 1]) {
    const y0 = (b.i + lap * n - rise) * 1.4;   // 10 segments span 14 > the 13 units in view
    if (y0 < -6 || y0 > 7) continue;
    segs.push({ b, y0 });
  }
  const rOf = b => 1.1 + (b.hash[1] / 255) * 0.5 + Math.min(1, b.gas / 0.3) * 0.4;
  for (const { b, y0 } of segs.sort((a, c) => a.y0 - c.y0)) {
    const r = rOf(b), h = 1.25, sides = 8;
    // Faces of an octagonal prism, back to front.
    const faces = [];
    for (let s = 0; s < sides; s++) {
      const a0 = s / sides * TAU, a1 = (s + 1) / sides * TAU;
      const p = [proj(Math.cos(a0) * r, y0, Math.sin(a0) * r), proj(Math.cos(a1) * r, y0, Math.sin(a1) * r), proj(Math.cos(a1) * r, y0 + h, Math.sin(a1) * r), proj(Math.cos(a0) * r, y0 + h, Math.sin(a0) * r)];
      if (p.some(q => !q)) continue;
      const mid = (a0 + a1) / 2, facing = Math.cos(mid + yaw + Math.PI / 2);   // >0 faces the camera
      faces.push({ s, p, depth: (p[0][3] + p[1][3]) / 2, facing, mid });
    }
    faces.sort((a, c) => c.depth - a.depth);
    for (const { s, p, facing } of faces) {
      if (facing < -0.05) continue;
      const light = 0.25 + facing * 0.75;
      ctx.fillStyle = rgb(mixRGB([10, 14, 26], mixRGB(GLOW, [255, 170, 80], (s % 2) * 0.5), light * 0.12));
      ctx.beginPath(); p.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill();
      // Windows: the bloom decides; a grid across each face.
      for (let r2 = 0; r2 < 7; r2++) for (let q = 0; q < 4; q++) {
        const k = (s * 28 + r2 * 4 + q); if (!bit(b.bloom, k * 3 + b.i) || !bit(b.hash, k)) continue;
        const u = (q + 0.5) / 4, v = (r2 + 0.5) / 7;
        const x = p[0][0] + (p[1][0] - p[0][0]) * u + (p[3][0] - p[0][0]) * v, y = p[0][1] + (p[1][1] - p[0][1]) * u + (p[3][1] - p[0][1]) * v;
        ctx.fillStyle = rgb(b.state[k % 32] & 1 ? [255, 196, 110] : [140, 230, 255], 0.35 + facing * 0.6); ctx.fillRect(x, y, Math.max(0.8, p[0][2] * 0.04), Math.max(0.8, p[0][2] * 0.025));
      }
    }
    // Neon ring at the top of the segment.
    ctx.save(); ctx.strokeStyle = rgb(b.colour, 0.85); ctx.shadowColor = rgb(b.colour); ctx.shadowBlur = 10; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU, q = proj(Math.cos(a) * (r + 0.05), y0 + h, Math.sin(a) * (r + 0.05)); if (q) k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.restore();
    // Vertical sign on the segment's front, at an angle from the hash.
    const sa = b.hash[4] / 255 * TAU, q = proj(Math.cos(sa) * (r + 0.15), y0 + h * 0.85, Math.sin(sa) * (r + 0.15));
    if (q && Math.cos(sa + yaw + Math.PI / 2) > 0.1) verticalSign(ctx, b.word, q[0], q[1], clamp(q[2] * 0.22, 4, S * 0.05), b.colour, 0.95);
  }
  // Flying traffic orbiting the tower at several heights.
  const [a, b2, mix] = turn(blocks, rise + 1);
  for (let k = 0; k < 14 + Math.round(a.tx / 14); k++) {
    const h = blocks[k % n].hash, ang = h[k % 32] / 255 * TAU + t * TAU * (k % 2 ? 2 : -1), rr = 2.4 + h[(k + 1) % 32] / 255 * 3, y = -4 + h[(k + 2) % 32] / 255 * 9;
    const q = proj(Math.cos(ang) * rr, y, Math.sin(ang) * rr), q2 = proj(Math.cos(ang - 0.15) * rr, y, Math.sin(ang - 0.15) * rr);
    if (!q || !q2) continue;
    ctx.strokeStyle = k % 2 ? "rgba(255,90,110,0.9)" : "rgba(210,240,255,0.9)"; ctx.lineWidth = Math.max(0.8, q[2] * 0.03); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
  }
  hologram(ctx, a, b2, mix, S / 2, S * 0.14, S / 640 * 0.85, t);
  // Low cloud deck below.
  const cloud = ctx.createLinearGradient(0, S * 0.7, 0, S); cloud.addColorStop(0, "rgba(40,70,100,0)"); cloud.addColorStop(1, "rgba(80,110,140,0.55)");
  ctx.fillStyle = cloud; ctx.fillRect(0, S * 0.7, S, S * 0.3);
  rain(ctx, epoch, t, 50, { slant: 0.25 });
  vignette(ctx, 0.6);
}
