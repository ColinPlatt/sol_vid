// 路地 ALLEY: walking slowly down a narrow rain-soaked back alley. One-point perspective corridor: each block is a
// stretch of wall with its vertical neon sign (a word from its hash), lit windows from its logs bloom, AC units and
// pipes; red lanterns and cables hang across. The far end glows; a gate sign there shows the block ahead, and a
// vending machine by the camera glows with its hash. Continuous: the camera's depth is periodic in the epoch.
import { TAU, block, bit, clamp, mixRGB, rgb, wrap, verticalSign, vignette, turn, font, facts, LATIN, DOT, FONT } from "./kit.js";

const FOG = [70, 20, 70], GLOW = [255, 110, 190];
export function alley(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), camZ = t * n;
  const VX = S / 2, VY = S * 0.44, F = S * 0.32, W = 1.0, FLOOR = 1.25, ROOF = -6, NEAR = 0.45, FAR = Math.min(12, epoch.length - 0.3);
  const at = (side, y, z) => [VX + side * W * F / z, VY + y * F / z, F / z];
  const fogAt = z => clamp((z - NEAR) / (FAR - NEAR), 0, 1) ** 0.65;

  // Sky slit above, and the glowing far end of the alley.
  ctx.fillStyle = rgb([6, 3, 12]); ctx.fillRect(0, 0, S, S);
  const sky = ctx.createLinearGradient(0, 0, 0, VY); sky.addColorStop(0, rgb([10, 4, 30])); sky.addColorStop(1, rgb([110, 30, 100]));
  const [lx] = at(-1, 0, FAR), [rx] = at(1, 0, FAR);
  ctx.fillStyle = sky; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(rx, at(1, ROOF, FAR)[1]); ctx.lineTo(lx, at(-1, ROOF, FAR)[1]); ctx.fill();
  const end = ctx.createRadialGradient(VX, VY, 2, VX, VY, S * 0.35); end.addColorStop(0, rgb([255, 200, 230], 0.95)); end.addColorStop(0.15, rgb(GLOW, 0.6)); end.addColorStop(1, rgb(GLOW, 0));
  ctx.fillStyle = end; ctx.fillRect(0, 0, S, S);

  // Walls: one polygon each from the camera to the far end.
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(side < 0 ? 0 : S, 0, VX, 0); g.addColorStop(0, rgb([8, 5, 14])); g.addColorStop(1, rgb(mixRGB([18, 10, 28], FOG, 0.8)));
    ctx.fillStyle = g; ctx.beginPath();
    const a = at(side, ROOF, NEAR), b = at(side, ROOF, FAR), c = at(side, FLOOR, FAR), d = at(side, FLOOR, NEAR);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill();
  }
  // Wet floor between the walls.
  const fl = ctx.createLinearGradient(0, VY, 0, S); fl.addColorStop(0, rgb([60, 20, 60])); fl.addColorStop(0.2, rgb([14, 8, 18])); fl.addColorStop(1, rgb([4, 3, 8]));
  ctx.fillStyle = fl; ctx.beginPath(); const p1 = at(-1, FLOOR, FAR), p2 = at(1, FLOOR, FAR), p3 = at(1, FLOOR, NEAR), p4 = at(-1, FLOOR, NEAR);
  ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.fill();

  // Each block's stretch of wall, far to near.
  const items = blocks.map(b => ({ b, z: wrap(b.i - camZ, n) + NEAR })).filter(i => i.z < FAR).sort((a, c) => c.z - a.z);
  for (const { b, z } of items) {
    const fog = fogAt(z), emerge = clamp((z - NEAR) / 0.6, 0, 1);
    ctx.save(); ctx.globalAlpha = emerge;
    for (const side of [-1, 1]) {
      // A seam and a ledge where this block's stretch begins.
      const [sx, sy0] = at(side, ROOF, z), [, sy1] = at(side, FLOOR, z);
      ctx.fillStyle = rgb(mixRGB([4, 2, 8], FOG, fog * 0.7)); ctx.fillRect(sx - 1, sy0, 2, sy1 - sy0);
      // Windows: bloom and hash decide which are lit.
      for (let r = 0; r < 14; r++) for (let q = 0; q < 3; q++) {
        const k = r * 3 + q + (side > 0) * 64; if (!bit(b.bloom, k * 5 + b.i) || !bit(b.hash, k)) continue;
        const zz = z + (q + 0.3) / 3 * 0.85, y = ROOF + 0.4 + r * ((FLOOR - 1.4 - ROOF) / 14), [wx, wy, s] = at(side, y, zz);
        ctx.fillStyle = rgb(mixRGB(b.state[k % 32] & 1 ? [255, 190, 110] : [130, 220, 255], FOG, fog * 0.8), 0.85 - fog * 0.5);
        ctx.fillRect(wx - side * s * 0.03, wy, Math.max(0.6, s * 0.06), Math.max(0.6, s * 0.09));
      }
      // AC unit and a drainpipe on some stretches.
      if (b.hash[6 + (side > 0)] % 3 === 0) {
        const [ax, ay, as] = at(side * 0.92, -0.6 - (b.hash[8] / 255) * 2.5, z + 0.4);
        ctx.fillStyle = rgb(mixRGB([40, 38, 52], FOG, fog)); ctx.fillRect(ax - as * 0.12, ay, as * 0.24, as * 0.16);
      }
    }
    // The block's vertical neon sign, sticking out from its wall.
    const side = b.hash[2] & 1 ? 1 : -1, [px, py, ps] = at(side * 0.78, -2.6 + (b.hash[4] / 255) * 1.2, z + 0.15);
    const on = ((t * 9 + b.hash[4] / 256) % 1) > 0.05 * (b.hash[7] % 3);
    if (on) verticalSign(ctx, b.word, px, py, clamp(ps * 0.3, 3, S * 0.09), mixRGB(b.colour, FOG, fog * 0.55), 1 - fog * 0.5);
    // Red paper lanterns and cables across the alley on some blocks.
    if (b.hash[9] % 2 === 0) {
      const y = -1.2 - (b.hash[10] / 255) * 1.5, [ax, ay, as] = at(-1, y, z + 0.5), [bx, by] = at(1, y, z + 0.5);
      ctx.strokeStyle = rgb(mixRGB([20, 14, 30], FOG, fog)); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(VX, ay + as * 0.25, bx, by); ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        const u = k / 4, x = ax + (bx - ax) * u, yy = ay + as * 0.25 * 4 * u * (1 - u) + as * 0.02, r = Math.max(1, as * 0.07), sway = Math.sin(TAU * (t * 2 + k * 0.3)) * r * 0.3;
        ctx.save(); ctx.shadowColor = "#ff3030"; ctx.shadowBlur = r * 2; ctx.fillStyle = rgb(mixRGB([255, 60, 40], FOG, fog * 0.6), 0.95 - fog * 0.4);
        ctx.beginPath(); ctx.ellipse(x + sway, yy + r, r * 0.8, r, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
  }

  // Gate sign at the far end: the block ahead, crossfading.
  const [a, b, mix] = turn(blocks, camZ + 3);
  for (const [blk, alpha] of [[a, 1 - mix], [b, mix]]) {
    if (alpha < 0.02) continue;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = rgb(blk.colour); ctx.shadowBlur = 20;
    ctx.font = font(LATIN, S * 0.014); ctx.fillStyle = rgb(mixRGB(blk.colour, [255, 255, 255], 0.3), 0.5); ctx.fillText("BASE · BLOCK", VX, VY - S * 0.245);
    ctx.font = font(FONT, S * 0.05); ctx.fillStyle = rgb(blk.colour); ctx.fillText("ベース・ブロック", VX, VY - S * 0.205);
    ctx.font = font(LATIN, S * 0.028); ctx.fillStyle = "rgba(255,240,250,0.95)"; ctx.fillText(`#${blk.n.toLocaleString("en")}`, VX, VY - S * 0.145);
    ctx.font = font(DOT, S * 0.022); ctx.fillStyle = rgb(mixRGB(blk.colour, [255, 255, 255], 0.5)); ctx.fillText(`取引 ${blk.tx}件 · ガス ${(blk.gas * 100).toFixed(1)}%`, VX, VY - S * 0.11);
    ctx.shadowBlur = 0; ctx.font = font(LATIN, S * 0.013); ctx.fillStyle = rgb(mixRGB(blk.colour, [255, 255, 255], 0.3), 0.5); ctx.fillText(facts(blk), VX, VY - S * 0.083);
    ctx.restore();
  }

  // Reflections in the wet floor: mirror the band above the floor's far edge.
  const fy = at(1, FLOOR, FAR)[1], h = S - fy, src = ctx.getImageData(0, Math.max(0, fy - h), S, h), off = new OffscreenCanvas(S, h);
  off.getContext("2d").putImageData(src, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.clip();
  ctx.globalAlpha = 0.3; ctx.filter = "blur(2px)"; ctx.translate(0, fy + h); ctx.scale(1, -1); ctx.drawImage(off, 0, 0); ctx.restore();

  // Vending machine by the camera: the block ahead's hash, buttons from its state root.
  const vx = S * 0.04, vy = S * 0.5, vw = S * 0.15, vh = S * 0.34;
  ctx.fillStyle = "#0e1630"; ctx.fillRect(vx, vy, vw, vh);
  ctx.save(); ctx.shadowColor = "#4d7cff"; ctx.shadowBlur = 24; ctx.fillStyle = "rgba(120,170,255,0.22)"; ctx.fillRect(vx + vw * 0.08, vy + vh * 0.06, vw * 0.84, vh * 0.5); ctx.restore();
  ctx.font = font(DOT, S * 0.016); ctx.fillStyle = "#d6e6ff"; ctx.textAlign = "left";
  for (let r = 0; r < 8; r++) ctx.fillText(a.hex.slice(r * 8, r * 8 + 8), vx + vw * 0.14, vy + vh * 0.1 + r * S * 0.02);
  for (let k = 0; k < 8; k++) { ctx.fillStyle = rgb([[255, 46, 136], [0, 229, 255], [255, 176, 0], [57, 255, 136]][a.state[k] % 4]); ctx.fillRect(vx + vw * (0.12 + (k % 4) * 0.2), vy + vh * (0.64 + Math.floor(k / 4) * 0.08), vw * 0.12, vh * 0.03); }

  // Steam from a grate; puddle ripples, one per 25 transactions of the block ahead.
  for (let k = 0; k < 6; k++) {
    const life = wrap(t * 3 + k / 6, 1), x = S * 0.7 + Math.sin(TAU * (life + k)) * S * 0.015, y = S * 0.95 - life * S * 0.3;
    ctx.fillStyle = `rgba(210,190,255,${0.1 * (1 - life)})`; ctx.beginPath(); ctx.arc(x, y, S * (0.02 + life * 0.05), 0, TAU); ctx.fill();
  }
  for (let k = 0; k < Math.min(12, Math.round(a.tx / 25)); k++) {
    const h2 = a.hash, life = wrap(t * 4 + h2[k] / 255, 1), x = S * (0.3 + (h2[k + 8] / 255) * 0.4), y = S * (0.78 + (h2[k + 16] / 255) * 0.18);
    ctx.strokeStyle = `rgba(255,140,220,${0.5 * (1 - life)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, S * (0.006 + life * 0.03), S * (0.002 + life * 0.008), 0, 0, TAU); ctx.stroke();
  }
  // Rain.
  ctx.strokeStyle = "rgba(210,190,255,0.25)"; ctx.lineWidth = 1;
  for (let k = 0; k < 60; k++) {
    const h2 = blocks[k % n].hash, x = (h2[k % 32] * 7 + k * 11) % S, len = S * (0.012 + (h2[(k + 3) % 32] % 10) / 500), sp = 2 + k % 3;
    const y = ((h2[(k + 7) % 32] / 255 + t * sp) % 1) * (S + len) - len; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.05, y + len); ctx.stroke();
  }
  vignette(ctx, 0.6);
}
