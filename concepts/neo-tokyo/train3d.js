// 夜行 NIGHT TRAIN: looking forward and sideways from a moving train at night. The track runs ahead toward a glowing
// city; each block's tower stands beside the line (height from gas, windows from its logs bloom, a neon sign with its
// word) and slides past; catenary masts sweep by; the glass carries a faint reflection of the carriage and its LED
// display. Continuous loop.
import { TAU, block, clamp, mixRGB, rgb, wrap, verticalSign, vignette, turn, font, facts, DOT, LATIN } from "./kit.js";
import { camera, tower } from "./kit3d.js";

const FOG = [56, 20, 84], SP = 1.6;
export function train3d(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), L = n * SP;
  const camZ = t * L, bob = Math.sin(TAU * t * 9) * 0.01;
  const cam = camera(S, 0, -0.9 + bob, camZ, 0.62, 0.04, S * 0.55, 0.5);   // yawed right: looking out at the line ahead
  // Sky with the city glow where the line leads.
  const sky = ctx.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, rgb([4, 3, 14])); sky.addColorStop(0.42, rgb([46, 14, 70])); sky.addColorStop(0.52, rgb([170, 50, 140])); sky.addColorStop(0.6, rgb(FOG)); sky.addColorStop(1, rgb([12, 6, 20]));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  const vp = cam.project(0, 0, camZ + 200) ?? [S * 0.2, S * 0.5];
  const glow = ctx.createRadialGradient(vp[0], vp[1], 4, vp[0], vp[1], S * 0.6); glow.addColorStop(0, "rgba(255,190,230,0.85)"); glow.addColorStop(0.18, "rgba(255,70,170,0.4)"); glow.addColorStop(1, "rgba(255,70,170,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
  // Ground and the parallel track.
  const g1 = cam.project(-6, 0.3, camZ + 0.6), g2 = cam.project(12, 0.3, camZ + 0.6);
  ctx.fillStyle = rgb([14, 8, 22]); ctx.fillRect(0, Math.min(g1?.[1] ?? S, g2?.[1] ?? S, vp[1] + 4), S, S);
  for (const rx of [1.0, 1.6]) {
    ctx.strokeStyle = "rgba(200,170,220,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); let first = true;
    for (let z = camZ + 0.4; z < camZ + 60; z *= 1.0 + 0.04, z += 0.1) { const p = cam.project(rx, 0.3, z); if (!p) continue; first ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); first = false; }
    ctx.stroke();
  }
  // Towers beside the line, far to near; one per block, on the window side.
  const [a, b2, mix] = turn(blocks, camZ / SP + 1);
  const items = blocks.map(b => ({ b, dz: wrap(b.i * SP - camZ, L) })).filter(i => i.dz > 0.2).sort((p, q) => q.dz - p.dz);
  for (const { b, dz } of items) {
    const z = camZ + dz, fog = clamp((dz - 1) / (L * 0.85), 0, 1) ** 0.8, x = 3.2 + (b.hash[1] / 255) * 2.4, hw = 0.5 + Math.min(0.35, b.tx / 800), top = -1.8 - Math.min(1, b.gas / 0.3) * 4.5;
    const roof = tower(ctx, cam, b, x, z, hw, hw * 0.8, top, 0.3, { fog, fogColour: FOG, base: [18, 11, 36], rimColour: b.colour, windows: [5, 18] });
    const signAt = cam.project(x - hw - 0.05, top * 0.55, z - hw * 0.8);
    if (signAt) verticalSign(ctx, b.word, signAt[0], signAt[1], clamp(signAt[2] * 0.2, 3, S * 0.08), mixRGB(b.colour, FOG, fog * 0.5), 1 - fog * 0.5);
    // A low background building between the towers.
    tower(ctx, cam, b, x + 2.4, z + SP / 2, 0.6, 0.5, -0.8 - (b.hash[8] / 255) * 1.5, 0.3, { fog: Math.min(1, fog + 0.15), fogColour: FOG, base: [12, 8, 24], windows: [4, 6] });
  }
  // Catenary masts beside the track every 0.8 units, sweeping past.
  for (let z = Math.ceil(camZ / 0.8) * 0.8; z < camZ + 14; z += 0.8) {
    const p = cam.project(0.75, -1.6, z), q = cam.project(0.75, 0.3, z), r = cam.project(0.1, -1.55, z);
    if (!p || !q || !r) continue;
    ctx.strokeStyle = "rgba(8,6,14,0.95)"; ctx.lineWidth = Math.max(1, p[2] * 0.035); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(r[0], r[1]); ctx.stroke();
  }
  // Rain on the glass, streaking back diagonally with the speed.
  ctx.strokeStyle = "rgba(210,225,255,0.28)"; ctx.lineWidth = 1;
  for (let k = 0; k < 40; k++) {
    const h = blocks[k % n].hash, y = S * 0.16 + (h[k % 32] / 255) * S * 0.6, life = wrap(h[(k + 3) % 32] / 255 + t * (2 + k % 3), 1), x = S * (0.05 + (1 - life) * 0.95);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12 + h[(k + 4) % 32] % 14, y + 4); ctx.stroke();
  }
  // Faint reflection of the carriage on the glass: the LED display, mirrored and dim.
  ctx.save(); ctx.globalAlpha = 0.18; ctx.translate(S * 0.75, S * 0.3); ctx.scale(-1, 1); ctx.font = font(DOT, S * 0.03); ctx.fillStyle = "#ffb000"; ctx.fillText(`次は #${a.n}`, 0, 0); ctx.restore();
  // Interior: window frame, straps, the LED display.
  ctx.fillStyle = "#0a0a10"; ctx.fillRect(0, 0, S, S * 0.13); ctx.fillRect(0, S * 0.82, S, S * 0.18); ctx.fillRect(0, 0, S * 0.04, S); ctx.fillRect(S * 0.96, 0, S * 0.04, S);
  ctx.fillStyle = "#1b1b25"; ctx.fillRect(S * 0.04, S * 0.125, S * 0.92, S * 0.01); ctx.fillRect(S * 0.04, S * 0.815, S * 0.92, S * 0.01);
  for (let k = 0; k < 5; k++) {
    const x = S * (0.12 + k * 0.19), swing = Math.sin(TAU * t * 3 + k * 0.7) * S * 0.008;
    ctx.strokeStyle = "#2a2a35"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, S * 0.13); ctx.lineTo(x + swing, S * 0.2); ctx.stroke();
    ctx.strokeStyle = "#e8e8f0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x + swing, S * 0.215, S * 0.013, S * 0.016, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = "#040404"; ctx.fillRect(S * 0.2, S * 0.02, S * 0.6, S * 0.09);
  for (const [blk, alpha] of [[a, 1 - mix], [b2, mix]]) {
    if (alpha < 0.02) continue;
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 10; ctx.fillStyle = "#ffb000"; ctx.font = font(DOT, S * 0.03); ctx.textBaseline = "middle";
    ctx.fillText(`次は #${blk.n}`, S * 0.22, S * 0.045); ctx.font = font(DOT, S * 0.02); ctx.fillStyle = "#ff8a00"; ctx.fillText(`取引 ${blk.tx}件 · ガス ${(blk.gas * 100).toFixed(1)}% · ${blk.word}`, S * 0.22, S * 0.08);
    ctx.shadowBlur = 0; ctx.font = font(LATIN, S * 0.012); ctx.fillStyle = "rgba(255,176,0,0.5)"; ctx.fillText(`NEXT · ${facts(blk)} · ${blk.wordEn}`, S * 0.22, S * 0.1);
    ctx.restore();
  }
  vignette(ctx, 0.45);
}
