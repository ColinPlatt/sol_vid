// 夜景 SKYLINE: a slow flyover above the megacity at night. Each block is a tower rising from a low fog sea along the
// flight path (height from gas, windows from its logs bloom, a neon rim and a rooftop sign with its word); lanes of
// flying traffic run alongside; the horizon glows ahead. The hologram shows the block ahead. Continuous loop.
import { TAU, block, clamp, mixRGB, rgb, wrap, verticalSign, hologram, rain, vignette, turn } from "./kit.js";
import { camera, tower } from "./kit3d.js";

const FOG = [70, 26, 96], SP = 2.2, FOG_Y = 2.2;
export function skyline3d(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), L = n * SP;
  const camZ = t * L, sway = Math.sin(TAU * t) * 0.35;
  const CAM_Y = -3.4, cam = camera(S, sway, CAM_Y, camZ, Math.sin(TAU * t) * 0.06, 0.24, S * 0.62, 0.48);
  // The true horizon: where a point at the camera's height, infinitely far ahead, projects. The backdrop hangs on it.
  const H = clamp(cam.project(sway, CAM_Y, camZ + 1e5)?.[1] ?? S * 0.3, S * 0.08, S * 0.7), hf = H / S;
  // Sky and the glowing horizon ahead.
  const sky = ctx.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, rgb([5, 3, 16])); sky.addColorStop(hf * 0.7, rgb([36, 10, 58])); sky.addColorStop(hf, rgb([210, 70, 160])); sky.addColorStop(Math.min(1, hf + 0.08), rgb(FOG)); sky.addColorStop(1, rgb([18, 8, 30]));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  const glow = ctx.createRadialGradient(S / 2, H, 4, S / 2, H, S * 0.55); glow.addColorStop(0, "rgba(255,200,235,0.9)"); glow.addColorStop(0.2, "rgba(255,80,180,0.4)"); glow.addColorStop(1, "rgba(255,80,180,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
  // Distant city: a dense silhouette band standing on the horizon, sinking into the haze below it.
  for (let k = 0; k < 90; k++) {
    const h = blocks[k % n].hash, x = (k / 90) * S + (h[k % 32] % 7), ht = S * (0.015 + (h[(k + 1) % 32] / 255) * 0.05);
    ctx.fillStyle = rgb([60, 22, 84]); ctx.fillRect(x, H - ht, S / 90 + 2, ht + S * 0.015);
    if (h[(k + 2) % 32] & 1) { ctx.fillStyle = "rgba(255,190,140,0.6)"; ctx.fillRect(x + 1, H - ht + 2, 1.2, 1.2); }
  }
  const haze = ctx.createLinearGradient(0, H - S * 0.01, 0, H + S * 0.12); haze.addColorStop(0, rgb(FOG, 0)); haze.addColorStop(0.4, rgb([150, 50, 130], 0.6)); haze.addColorStop(1, rgb(FOG, 0.9));
  ctx.fillStyle = haze; ctx.fillRect(0, H - S * 0.01, S, S);
  // Towers along the flight path, far to near; two per block (left and right of the path), the block's own on its side.
  const items = blocks.map(b => ({ b, dz: wrap(b.i * SP - camZ, L), side: b.hash[0] & 1 ? 1 : -1 })).filter(i => i.dz > 0.3);
  items.sort((a, c) => c.dz - a.dz);
  for (const { b, dz, side } of items) {
    const z = camZ + dz, fog = clamp((dz - 1) / (L * 0.8), 0, 1) ** 0.8;
    for (const s of [side, -side]) {
      const own = s === side, x = s * (2.2 + (b.hash[own ? 1 : 6] / 255) * 1.6), hw = 0.32 + Math.min(0.3, b.tx / 900) * (own ? 1 : 0.6), top = own ? -1.2 - Math.min(1, b.gas / 0.3) * 3.6 : -0.4 - (b.hash[7] / 255) * 1.6;
      const roof = tower(ctx, cam, b, x, z, hw, hw, top, FOG_Y + 1, { fog, fogColour: FOG, base: own ? [20, 12, 40] : [14, 9, 28], rimColour: own ? b.colour : null, windows: own ? [7, 26] : [5, 12] });
      if (own && roof) verticalSign(ctx, b.word, roof[0], roof[1] - roof[2] * 0.9, clamp(roof[2] * 0.26, 4, S * 0.08), mixRGB(b.colour, FOG, fog * 0.5), 1 - fog * 0.4);
      if (own && roof && wrap(t * 2 + b.hash[3] / 255, 1) < 0.3) { ctx.save(); ctx.shadowColor = "#ff2a2a"; ctx.shadowBlur = 10; ctx.fillStyle = "#ff5050"; ctx.fillRect(roof[0] - 1.5, roof[1] - roof[2] * 0.7, 3, 3); ctx.restore(); }
    }
  }
  // The fog sea the towers rise from: from the horizon down, thickening toward the camera.
  const sea = ctx.createLinearGradient(0, H, 0, S); sea.addColorStop(0, rgb(FOG, 0)); sea.addColorStop(0.5, rgb(FOG, 0.5)); sea.addColorStop(1, rgb([30, 12, 46], 0.92));
  ctx.fillStyle = sea; ctx.fillRect(0, H, S, S - H);
  // Flying traffic lanes alongside the path.
  const [a, b2, mix] = turn(blocks, camZ / SP + 2);
  for (let k = 0; k < 12 + Math.round(a.tx / 20); k++) {
    const h = blocks[k % n].hash, lane = (h[k % 32] / 255 - 0.5) * 5, alt = -0.4 - (h[(k + 1) % 32] / 255) * 2.2, dir = k % 2 ? 1 : -1;
    const z = camZ + wrap(h[(k + 2) % 32] / 255 * L + dir * t * L * 1.5, L * 0.9) + 0.5, p = cam.project(lane, alt, z), q = cam.project(lane, alt, z - 0.5 * dir);
    if (!p || !q) continue;
    ctx.strokeStyle = dir > 0 ? "rgba(255,80,110,0.9)" : "rgba(210,240,255,0.9)"; ctx.lineWidth = Math.max(0.7, p[2] * 0.012); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  hologram(ctx, a, b2, mix, S / 2, S * 0.15, S / 640 * 0.85, t);
  rain(ctx, epoch, t, 50, { slant: 0.2, colour: "rgba(210,215,255,0.2)" });
  vignette(ctx, 0.55);
}
