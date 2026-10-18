// A small 3D toolkit for the flyover and train scenes: a camera with position, yaw and pitch, perspective projection,
// and lit boxes (towers) with windows from a block's logs bloom, depth fog and neon. Plain canvas JS concepts.
import { bit, clamp, mixRGB, rgb } from "./kit.js";

/** Camera at (x, y, z) looking along +z rotated by yaw (right-positive) and pitch (down-positive); y points down. */
export function camera(S, x, y, z, yaw, pitch, F, vy = 0.5) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    S, F,
    project(px, py, pz) {
      const dx = px - x, dy = py - y, dz = pz - z;
      const rx = dx * cy - dz * sy, rz1 = dx * sy + dz * cy;          // yaw
      const ry = dy * cp - rz1 * sp, rz = dy * sp + rz1 * cp;         // pitch
      return rz <= 0.05 ? null : [S / 2 + rx * F / rz, S * vy + ry * F / rz, F / rz, rz];
    },
  };
}

const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };

/**
 * A tower: footprint centred at (cx, cz), half-sizes (hw, hd), from yTop (negative = up) to yBase. Draws the faces that
 * face the camera with windows from the block's bloom, fogged by distance. Returns the projected top centre.
 */
export function tower(ctx, cam, b, cx, cz, hw, hd, yTop, yBase, { fog, fogColour, base = [14, 10, 30], rimColour, windows = [6, 14] }) {
  const c = (x, y, z) => cam.project(x, y, z);
  // Faces are culled by their projected winding.
  const faces = [
    { n: [0, -1], a: [cx - hw, cz - hd], b: [cx + hw, cz - hd] },   // front (toward -z)
    { n: [1, 0], a: [cx + hw, cz - hd], b: [cx + hw, cz + hd] },    // right
    { n: [-1, 0], a: [cx - hw, cz + hd], b: [cx - hw, cz - hd] },   // left
    { n: [0, 1], a: [cx + hw, cz + hd], b: [cx - hw, cz + hd] },    // back
  ];
  for (const [k, f] of faces.entries()) {
    const p1 = c(f.a[0], yTop, f.a[1]), p2 = c(f.b[0], yTop, f.b[1]), p3 = c(f.b[0], yBase, f.b[1]), p4 = c(f.a[0], yBase, f.a[1]);
    if (!p1 || !p2 || !p3 || !p4) continue;
    if ((p2[0] - p1[0]) * (p4[1] - p1[1]) - (p2[1] - p1[1]) * (p4[0] - p1[0]) <= 0) continue;   // back-facing
    const shade = k === 0 ? 1 : k === 3 ? 0.55 : 0.75;
    ctx.fillStyle = rgb(mixRGB(base.map(v => v * shade), fogColour, fog)); poly(ctx, [p1, p2, p3, p4]);
    // Windows: a grid across the face, lit where the bloom and hash agree.
    const [cols, rows] = windows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const i = (k * rows + r) * cols + q; if (!bit(b.bloom, i * 3 + b.i) || !bit(b.hash, i)) continue;
      const u = (q + 0.5) / cols, v = (r + 0.4) / rows;
      const x = p1[0] + (p2[0] - p1[0]) * u + (p4[0] - p1[0]) * v + (p3[0] - p2[0] - p4[0] + p1[0]) * u * v;
      const y = p1[1] + (p2[1] - p1[1]) * u + (p4[1] - p1[1]) * v + (p3[1] - p2[1] - p4[1] + p1[1]) * u * v;
      const s = Math.max(0.7, Math.min(Math.abs(p2[0] - p1[0]) / cols * 0.4, cam.S * 0.012));
      ctx.fillStyle = rgb(mixRGB(b.state[i % 32] & 1 ? [255, 190, 110] : [120, 220, 255], fogColour, fog * 0.85), (0.9 - fog * 0.5) * shade);
      ctx.fillRect(x - s / 2, y, s, Math.max(0.7, s * 0.7));
    }
  }
  // Roof and its neon rim.
  const r1 = c(cx - hw, yTop, cz - hd), r2 = c(cx + hw, yTop, cz - hd), r3 = c(cx + hw, yTop, cz + hd), r4 = c(cx - hw, yTop, cz + hd);
  if (r1 && r2 && r3 && r4) {
    ctx.fillStyle = rgb(mixRGB(base.map(v => v * 0.8), fogColour, fog)); poly(ctx, [r1, r2, r3, r4]);
    if (rimColour) { ctx.save(); ctx.strokeStyle = rgb(mixRGB(rimColour, fogColour, fog * 0.6), 0.9 - fog * 0.5); ctx.lineWidth = 1.2; ctx.shadowColor = rgb(rimColour); ctx.shadowBlur = 8 * (1 - fog); ctx.beginPath(); [r1, r2, r3, r4, r1].forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore(); }
  }
  return c(cx, yTop, cz);
}
