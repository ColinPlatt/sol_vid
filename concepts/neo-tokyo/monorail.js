// 高架 MONORAIL: riding an elevated monorail through the megacity canyon. The track bends gently; every fifth block is a
// station whose platform sign shows it; other blocks are buildings with neon signs; oncoming trains rush past.
import { TAU, block, bit, clamp, mixRGB, rgb, wrap, verticalSign, hologram, rain, vignette, turn, font, LATIN, DOT } from "./kit.js";

const FOG = [36, 18, 70], HAZE = [255, 120, 70];
export function monorail(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), camZ = t * n;
  const F = 270 * S / 640, NEAR = 0.3, FAR = Math.min(14, n - 0.3);
  // The track bends gently, once per loop: lateral offset of the rail at depth z, relative to the camera. Periodic in the loop.
  const curve = z => Math.sin(TAU * (z + camZ) / n) * 0.3 - Math.sin(TAU * camZ / n) * 0.3;
  const roll = Math.cos(TAU * camZ / n) * 0.01, VX = S / 2, VY = S * 0.46;
  const proj = (x, y, dz) => [VX + (x - curve(dz) * 0) * F / dz, VY + y * F / dz, F / dz];
  ctx.save(); ctx.translate(VX, VY); ctx.rotate(roll); ctx.translate(-VX, -VY);
  // Guideways: our beam (offset 0) and the parallel line for oncoming trains (offset ONCOMING).
  const BEAM_TOP = 0.55, BEAM_BOTTOM = 1.0, HALF = 0.2, ONCOMING = 1.05;
  const fogOf = dz => clamp((dz - NEAR) / (FAR - NEAR), 0, 1) ** 0.7;
  const beam = (z0, z1, offset) => {
    const steps = Math.max(2, Math.ceil((z1 - z0) * 10));
    for (let k = steps - 1; k >= 0; k--) {
      const za = z0 + (z1 - z0) * k / steps, zb = z0 + (z1 - z0) * (k + 1) / steps, ca = curve(za) + offset, cb = curve(zb) + offset, f = fogOf(za);
      // Side face toward the view axis, then the top surface over it.
      const sd = ca > 0 ? -1 : 1, [s1x, s1y] = proj(ca + sd * HALF, BEAM_TOP, za), [s2x, s2y] = proj(cb + sd * HALF, BEAM_TOP, zb), [s3x, s3y] = proj(cb + sd * HALF, BEAM_BOTTOM, zb), [s4x, s4y] = proj(ca + sd * HALF, BEAM_BOTTOM, za);
      ctx.fillStyle = rgb(mixRGB([22, 18, 32], FOG, f)); ctx.beginPath(); ctx.moveTo(s1x, s1y); ctx.lineTo(s2x, s2y); ctx.lineTo(s3x, s3y); ctx.lineTo(s4x, s4y); ctx.fill();
      const [a1x, a1y] = proj(ca - HALF, BEAM_TOP, za), [a2x] = proj(ca + HALF, BEAM_TOP, za), [b1x, b1y] = proj(cb - HALF, BEAM_TOP, zb), [b2x] = proj(cb + HALF, BEAM_TOP, zb);
      ctx.fillStyle = rgb(mixRGB([78, 70, 88], mixRGB(FOG, HAZE, 0.25), f)); ctx.beginPath(); ctx.moveTo(a1x, a1y); ctx.lineTo(a2x, a1y); ctx.lineTo(b2x, b1y); ctx.lineTo(b1x, b1y); ctx.fill();
      // Edge strips catching the haze.
      ctx.strokeStyle = rgb(mixRGB([255, 200, 150], FOG, f), 0.6 - f * 0.4); ctx.lineWidth = Math.max(0.6, (a1y - b1y) * 0.15);
      ctx.beginPath(); ctx.moveTo(a1x, a1y); ctx.lineTo(b1x, b1y); ctx.moveTo(a2x, a1y); ctx.lineTo(b2x, b1y); ctx.stroke();
    }
    // Reflective markers fixed to the beam every quarter unit, so they stream toward the camera.
    for (let zz = Math.ceil((z0 + camZ) * 4) / 4 - camZ; zz < z1; zz += 0.25) {
      const [mx, my, ms] = proj(curve(zz) + offset, BEAM_TOP, zz), f = fogOf(zz);
      ctx.fillStyle = rgb(mixRGB(offset ? [255, 90, 90] : [255, 230, 170], FOG, f), 0.9 - f * 0.6); ctx.fillRect(mx - ms * 0.02, my - ms * 0.004, Math.max(1, ms * 0.04), Math.max(0.6, ms * 0.008));
    }
  };
  // Sky with a warm sodium haze at the horizon (an alternative palette to the pink canyon).
  const sky = ctx.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, rgb([4, 6, 18])); sky.addColorStop(0.46, rgb(FOG)); sky.addColorStop(0.62, rgb([14, 8, 22])); sky.addColorStop(1, rgb([6, 4, 10]));
  ctx.fillStyle = sky; ctx.fillRect(-S, -S, S * 3, S * 3);
  const haze = ctx.createRadialGradient(VX, VY, 2, VX, VY, S * 0.42); haze.addColorStop(0, rgb([255, 190, 120], 0.95)); haze.addColorStop(0.2, rgb(HAZE, 0.55)); haze.addColorStop(1, rgb(HAZE, 0));
  ctx.fillStyle = haze; ctx.fillRect(-S, -S, S * 3, S + VY + S * 0.02);
  // Below the horizon: the canyon floor, dark, fading up into the glow.
  const floor = ctx.createLinearGradient(0, VY, 0, S); floor.addColorStop(0, rgb([90, 40, 40], 0.9)); floor.addColorStop(0.12, rgb([16, 8, 18])); floor.addColorStop(1, rgb([4, 3, 8]));
  ctx.fillStyle = floor; ctx.fillRect(-S, VY, S * 3, S * 2);
  // The street far below: streams of traffic toward the haze.
  for (let k = 0; k < 50; k++) {
    const lane = (k % 6) - 2.5, dz = wrap(k * 0.53 + t * n * (k % 2 ? 1.5 : -1.2), FAR) + NEAR, [x, y, s] = proj(curve(dz) + lane * 0.35, 4.2, dz);
    ctx.fillStyle = rgb(k % 2 ? [255, 70, 60] : [255, 235, 210], 0.85 - dz / FAR * 0.6); ctx.fillRect(x, y, Math.max(0.6, s * 0.04), Math.max(0.6, s * 0.012));
  }
  const items = blocks.map(b => ({ b, dz: wrap(b.i - camZ, n) + NEAR })).filter(i => i.dz < FAR).sort((a, c) => c.dz - a.dz);
  for (const { b, dz } of items) {
    const fog = clamp((dz - NEAR) / (FAR - NEAR), 0, 1) ** 0.7, cx = curve(dz), side = b.hash[0] & 1 ? 1 : -1;
    // Buildings either side of the track.
    for (const s of [-1, 1]) {
      const x0 = cx + s * (1.6 + (b.hash[1 + (s > 0)] / 255) * 0.8), top = -2 - Math.min(1, b.gas / 0.3) * 6 - (b.hash[3] / 255) * 2;
      const [ax, ay, sc] = proj(x0, top, dz), [, by] = proj(x0, 4, dz), [fx] = proj(x0 + s * 8, top, dz);
      ctx.fillStyle = rgb(mixRGB([14, 10, 28], FOG, fog)); ctx.fillRect(Math.min(ax, fx), ay, Math.abs(fx - ax), by - ay);
      // Rooftop edge light, picking the building out against the haze.
      ctx.fillStyle = rgb(mixRGB(b.colour, FOG, fog), 0.5 - fog * 0.3); ctx.fillRect(Math.min(ax, fx), ay, Math.abs(fx - ax), Math.max(1, sc * 0.01));
      for (let r = 0; r < 13; r++) for (let q = 0; q < 4; q++) {
        const k = r * 4 + q + (s > 0) * 200; if (!bit(b.bloom, k * 3 + b.i) || !bit(b.hash, k)) continue;
        const [wx, wy] = proj(x0 + s * (0.2 + q * 0.6), top + (r + 0.5) / 13 * (4 - top), dz);
        ctx.fillStyle = rgb(mixRGB(b.state[k % 32] & 1 ? [255, 200, 120] : [140, 220, 255], FOG, fog * 0.8), 0.9 - fog * 0.5);
        ctx.fillRect(wx, wy, Math.max(0.8, sc * 0.08), Math.max(0.8, sc * 0.05));
      }
      if (s === side) { const [sx, sy, ss] = proj(x0 - s * 0.12, -1.4, dz); verticalSign(ctx, b.word, sx, sy, clamp(ss * 0.2, 3, S * 0.07), mixRGB(b.colour, FOG, fog * 0.6), 1 - fog * 0.6); }
    }
    // A T-shaped pylon under both guideways, then this block's stretch of each beam.
    const mid = cx + ONCOMING / 2, [tlx, tly, tls] = proj(cx - HALF, BEAM_BOTTOM, dz), [trx] = proj(cx + ONCOMING + HALF, BEAM_BOTTOM, dz), [pcx] = proj(mid, BEAM_BOTTOM, dz), [, pby] = proj(mid, 4.2, dz);
    ctx.fillStyle = rgb(mixRGB([30, 26, 40], FOG, fog)); ctx.fillRect(tlx, tly, trx - tlx, tls * 0.12);
    ctx.fillStyle = rgb(mixRGB([20, 17, 30], FOG, fog)); ctx.fillRect(pcx - tls * 0.11, tly + tls * 0.12, tls * 0.22, pby - tly);
    beam(dz, dz + 1, ONCOMING); beam(dz, dz + 1, 0);
    // Station every fifth block: a platform canopy and a sign with the block number.
    if (b.i % 5 === 0) {
      const [px0, pyy, ps] = proj(cx - 1.3, 0.35, dz), [px1] = proj(cx + 1.3, 0.35, dz), [, cy] = proj(cx, -0.9, dz);
      ctx.fillStyle = rgb(mixRGB([60, 64, 80], FOG, fog)); ctx.fillRect(px0, pyy, px1 - px0, ps * 0.05);
      ctx.fillStyle = rgb(mixRGB([18, 16, 30], FOG, fog)); ctx.fillRect(px0, cy, px1 - px0, ps * 0.06);
      ctx.fillStyle = rgb(mixRGB([230, 240, 255], FOG, fog), 0.9); ctx.fillRect(px0, cy + ps * 0.06, px1 - px0, Math.max(1, ps * 0.008));
      ctx.save(); ctx.globalAlpha = 1 - fog * 0.6; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#f2f4ff"; ctx.fillRect((px0 + px1) / 2 - ps * 0.42, cy - ps * 0.32, ps * 0.84, ps * 0.25);
      ctx.fillStyle = "#101828"; ctx.font = font(DOT, ps * 0.09); ctx.fillText(`${b.word}駅`, (px0 + px1) / 2, cy - ps * 0.25);
      ctx.font = font(LATIN, ps * 0.065); ctx.fillText(`#${b.n}`, (px0 + px1) / 2, cy - ps * 0.15);
      ctx.font = font(LATIN, ps * 0.028); ctx.fillStyle = "rgba(16,24,40,0.6)"; ctx.fillText(`${b.wordEn} STATION`, (px0 + px1) / 2, cy - ps * 0.11); ctx.restore();
    }
  }
  // The stretch between the camera and the nearest block, so our beam runs out of the bottom of the frame.
  const nearest = Math.min(...items.map(i => i.dz)); beam(0.16, nearest, ONCOMING); beam(0.16, nearest, 0);
  // Oncoming trains: four cars each, riding on the parallel beam; two pass per loop.
  for (const phase of [0, 0.5]) {
    const life = wrap(t * 2 + phase, 1), front = FAR * (1 - life) + NEAR;
    for (let k = 23; k >= 0; k--) {
      const za = front + k * 0.5, zb = za + 0.5; if (za > FAR) continue;
      const ca = curve(za) + ONCOMING, cb = curve(zb) + ONCOMING, f = fogOf(za), sd = ca > 0 ? -1 : 1;
      const [p1x, p1y] = proj(ca + sd * 0.22, BEAM_TOP - 0.42, za), [p2x, p2y] = proj(cb + sd * 0.22, BEAM_TOP - 0.42, zb), [p3x, p3y] = proj(cb + sd * 0.22, BEAM_TOP, zb), [p4x, p4y] = proj(ca + sd * 0.22, BEAM_TOP, za);
      ctx.fillStyle = rgb(mixRGB([200, 206, 220], FOG, f)); ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y); ctx.lineTo(p4x, p4y); ctx.fill();
      const lerp = (ax, ay, bx, by, u) => [ax + (bx - ax) * u, ay + (by - ay) * u];
      const w1 = lerp(p1x, p1y, p4x, p4y, 0.2), w2 = lerp(p2x, p2y, p3x, p3y, 0.2), w3 = lerp(p2x, p2y, p3x, p3y, 0.45), w4 = lerp(p1x, p1y, p4x, p4y, 0.45);
      ctx.fillStyle = rgb(mixRGB(k % 6 === 5 ? [40, 40, 50] : [255, 236, 190], FOG, f), 0.9 - f * 0.5);
      ctx.beginPath(); ctx.moveTo(...w1); ctx.lineTo(...w2); ctx.lineTo(...w3); ctx.lineTo(...w4); ctx.fill();
    }
    const fog = fogOf(front), c = curve(front) + ONCOMING, [x, y, s] = proj(c - 0.22, BEAM_TOP - 0.42, front), [x2] = proj(c + 0.22, BEAM_TOP - 0.42, front);
    ctx.fillStyle = rgb(mixRGB([225, 230, 240], FOG, fog)); ctx.fillRect(x, y, x2 - x, s * 0.42);
    ctx.fillStyle = rgb(mixRGB([0, 180, 255], FOG, fog)); ctx.fillRect(x, y + s * 0.2, x2 - x, Math.max(1, s * 0.03));
    ctx.save(); ctx.shadowColor = "#fff4d0"; ctx.shadowBlur = 14 * (1 - fog); ctx.fillStyle = rgb(mixRGB([255, 250, 220], FOG, fog * 0.5));
    ctx.beginPath(); ctx.arc(x + (x2 - x) * 0.22, y + s * 0.32, Math.max(1, s * 0.035), 0, TAU); ctx.arc(x + (x2 - x) * 0.78, y + s * 0.32, Math.max(1, s * 0.035), 0, TAU); ctx.fill(); ctx.restore();
  }
  const [a, b, mix] = turn(blocks, camZ + 3);
  hologram(ctx, a, b, mix, S / 2, S * 0.16, S / 640 * 0.85, t);
  ctx.restore();
  // Cab interior: windscreen frame and the driver's console readout.
  ctx.fillStyle = "#06060c"; ctx.fillRect(0, S * 0.86, S, S * 0.14); ctx.fillRect(0, 0, S * 0.04, S); ctx.fillRect(S * 0.96, 0, S * 0.04, S);
  ctx.font = font(DOT, S * 0.024); ctx.fillStyle = "#ffb000"; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 8;
  ctx.fillText(`次の駅 #${blocks[(Math.floor(camZ / 5) * 5 + 5) % n].n}`, S * 0.07, S * 0.92); ctx.fillText(`${Math.round(80 + a.gas * 400)} km/h`, S * 0.72, S * 0.92); ctx.shadowBlur = 0;
  ctx.font = font(LATIN, S * 0.012); ctx.fillStyle = "rgba(255,176,0,0.5)"; ctx.fillText("NEXT STATION", S * 0.07, S * 0.945); ctx.fillText("SPEED", S * 0.72, S * 0.945);
  rain(ctx, epoch, t, 50, { slant: -0.5, colour: "rgba(200,215,255,0.2)" });
  vignette(ctx, 0.5);
}
