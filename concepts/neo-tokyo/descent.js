// 地下 DESCENT: riding the front of a train down a deep subway tunnel. Each block is a tunnel segment: wall lamps lit
// from its logs bloom, a lit station-style sign with its word and number, a signal at its start; the track runs
// underneath toward the glow at the end of the line. Level camera, no rotation. Continuous loop.
import { TAU, block, bit, clamp, mixRGB, rgb, wrap, verticalSign, hologram, vignette, turn, font, LATIN } from "./kit.js";
import { camera } from "./kit3d.js";

const FOG = [40, 12, 56], END = [255, 90, 170], SP = 1.6, W = 1.7, WALL = -1.5, CROWN = -2.5, RIB = 0.4;
// The tunnel's cross-section: floor, straight walls, an arched roof. y points down; the floor is y = 0.
const PROFILE = [[-W, 0], [-W, WALL], ...Array.from({ length: 9 }, (_, k) => { const a = Math.PI * (1 - (k + 1) / 10); return [Math.cos(a) * W, WALL + Math.sin(a) * (CROWN - WALL)]; }), [W, WALL], [W, 0]];

export function descent(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), L = n * SP, FAR = L * 0.95;
  const camZ = t * L, bob = Math.sin(TAU * t * 12) * 0.008;
  const cam = camera(S, 0, -1.05 + bob, camZ, 0, 0.03, S * 0.5, 0.5);
  const P = (x, y, z) => cam.project(x, y, z), fogAt = dz => clamp(dz / FAR, 0, 1) ** 0.6;
  const vp = P(0, -1.2, camZ + 1e4) ?? [S / 2, S / 2];
  // Darkness, with the glow at the far end of the line.
  ctx.fillStyle = rgb([6, 3, 12]); ctx.fillRect(0, 0, S, S);
  const glow = ctx.createRadialGradient(vp[0], vp[1], 1, vp[0], vp[1], S * 0.45); glow.addColorStop(0, rgb(END, 0.95)); glow.addColorStop(0.12, rgb([150, 40, 140], 0.6)); glow.addColorStop(0.5, rgb(FOG, 0.3)); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);

  const seg = blocks.map(b => ({ b, dz: wrap(b.i * SP - camZ, L) })).sort((p, q) => q.dz - p.dz);
  // Tunnel shell, far to near: each block's segment shaded slightly by its hash so segments read as you pass them.
  for (const { b, dz } of seg) {
    const z0 = camZ + Math.max(0.15, dz), z1 = camZ + dz + SP, fog = fogAt(dz), tone = 0.8 + (b.hash[2] / 255) * 0.4;
    for (let k = 0; k < PROFILE.length - 1; k++) {
      const [x0, y0] = PROFILE[k], [x1, y1] = PROFILE[k + 1], a = P(x0, y0, z1), c = P(x1, y1, z1), d = P(x1, y1, z0), e = P(x0, y0, z0);
      if (!a || !c || !d || !e) continue;
      const roof = y0 < WALL || y1 < WALL;
      ctx.fillStyle = rgb(mixRGB((roof ? [20, 16, 30] : [26, 20, 38]).map(v => v * tone), FOG, fog));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.fill();
    }
    // Floor bed and ballast between the walls.
    const f = [P(-W, 0, z1), P(W, 0, z1), P(W, 0, z0), P(-W, 0, z0)];
    if (f.every(Boolean)) { ctx.fillStyle = rgb(mixRGB([14, 11, 20], FOG, fog)); ctx.beginPath(); f.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.fill(); }
  }
  // Ribs every RIB units: the arch outline, fogged with distance.
  for (let z = Math.ceil(camZ / RIB) * RIB; z < camZ + FAR; z += RIB) {
    const dz = z - camZ; if (dz < 0.2) continue;
    const pts = PROFILE.map(([x, y]) => P(x, y, z)); if (pts.some(p => !p)) continue;
    ctx.strokeStyle = rgb(mixRGB([46, 36, 64], FOG, fogAt(dz)), 0.9); ctx.lineWidth = Math.max(0.6, pts[0][2] * 0.03);
    ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  // The track underneath: sleepers, then two rails running to the end of the line, then the third rail.
  for (let z = Math.ceil(camZ / 0.3) * 0.3; z < camZ + FAR; z += 0.3) {
    const dz = z - camZ; if (dz < 0.15) continue;
    const p = P(-0.55, 0, z), q = P(0.55, 0, z), r = P(0.55, 0, z + 0.1), s = P(-0.55, 0, z + 0.1); if (!p || !q || !r || !s) continue;
    ctx.fillStyle = rgb(mixRGB([44, 34, 40], FOG, fogAt(dz))); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.lineTo(s[0], s[1]); ctx.fill();
  }
  for (const [x, colour] of [[-0.36, [210, 200, 230]], [0.36, [210, 200, 230]], [0.9, [120, 90, 70]]]) {
    let prev = null;
    for (let dz = 0.15; dz < FAR; dz *= 1.12, dz += 0.02) {
      const p = P(x, -0.04, camZ + dz); if (!p) continue;
      if (prev) { ctx.strokeStyle = rgb(mixRGB(colour, END, fogAt(dz) * 0.7), 0.9 - fogAt(dz) * 0.4); ctx.lineWidth = Math.max(0.6, p[2] * 0.035); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
      prev = p;
    }
  }
  // Cable runs along both walls.
  for (const [x, y] of [[-W + 0.02, -1.1], [-W + 0.02, -1.2], [W - 0.02, -1.15]]) {
    ctx.strokeStyle = "rgba(10,8,16,0.9)"; ctx.lineWidth = 1; ctx.beginPath(); let first = true;
    for (let dz = 0.2; dz < FAR; dz *= 1.15, dz += 0.02) { const p = P(x, y, camZ + dz); if (!p) continue; first ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); first = false; }
    ctx.stroke();
  }
  // Per block, far to near: wall lamps from the bloom, a signal at the segment start, and the lit sign.
  for (const { b, dz } of seg) {
    const fog = fogAt(dz), near = clamp((dz - 0.2) / 0.6, 0, 1);
    for (let k = 0; k < 16; k++) {
      if (!bit(b.bloom, k * 7 + b.i) || !bit(b.hash, k)) continue;
      const side = k % 2 ? 1 : -1, z = camZ + dz + (Math.floor(k / 2) + 0.5) * SP / 8, p = P(side * (W - 0.03), -1.35, z); if (!p || z - camZ < 0.2) continue;
      const warm = b.state[k % 32] & 1, sz = clamp(p[2] * 0.05, 0.8, S * 0.03);
      ctx.save(); ctx.shadowColor = warm ? "#ffb060" : "#80e0ff"; ctx.shadowBlur = 6 * (1 - fog);
      ctx.fillStyle = rgb(mixRGB(warm ? [255, 200, 120] : [140, 225, 255], FOG, fog * 0.7), (0.95 - fog * 0.5) * near); ctx.fillRect(p[0] - sz, p[1] - sz / 3, sz * 2, sz * 0.7); ctx.restore();
    }
    // Signal at the segment start, beside the track: green ahead, red once it is near (a block being sealed).
    const sg = P(-W + 0.15, -1.0, camZ + dz + 0.05);
    if (sg && dz > 0.2) { const red = dz < SP * 1.5, sz = clamp(sg[2] * 0.04, 0.8, S * 0.02); ctx.save(); ctx.shadowColor = red ? "#ff2040" : "#30ff90"; ctx.shadowBlur = 8; ctx.fillStyle = red ? "#ff4060" : "#50ffa0"; ctx.globalAlpha = (1 - fog * 0.6) * near; ctx.beginPath(); ctx.arc(sg[0], sg[1], sz, 0, TAU); ctx.fill(); ctx.restore(); }
    // The block's sign on the wall, mid-segment: the word vertically, its number on a plate below.
    const side = b.hash[0] & 1 ? 1 : -1, sp = P(side * (W - 0.05), -1.75, camZ + dz + SP * 0.5);
    if (sp && dz + SP * 0.5 > 0.3) {
      const size = clamp(sp[2] * 0.15, 3, S * 0.09);
      verticalSign(ctx, b.word, sp[0] - side * size * 0.6, sp[1], size, mixRGB(b.colour, FOG, fog * 0.6), (1 - fog * 0.6) * near);
      if (size > S * 0.012) { ctx.save(); ctx.globalAlpha = (0.9 - fog * 0.6) * near; ctx.font = font(LATIN, size * 0.5); ctx.textAlign = "center"; ctx.fillStyle = rgb(b.colour); ctx.shadowColor = rgb(b.colour); ctx.shadowBlur = 6; ctx.fillText(`#${b.n}`, sp[0] - side * size * 0.6, sp[1] + size * (b.word.length + 1.2)); ctx.restore(); }
    }
  }
  // The train's headlights washing the track ahead.
  const beam = ctx.createRadialGradient(S / 2, S, 4, S / 2, S, S * 0.6); beam.addColorStop(0, "rgba(255,240,220,0.22)"); beam.addColorStop(1, "rgba(255,240,220,0)");
  ctx.fillStyle = beam; ctx.fillRect(0, S * 0.5, S, S * 0.5);
  const [a, b2, mix] = turn(blocks, camZ / SP + 1);
  hologram(ctx, a, b2, mix, S / 2, S * 0.14, S / 640 * 0.85, t);
  vignette(ctx, 0.6);
}
