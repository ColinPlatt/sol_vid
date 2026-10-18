// 里山 SATOYAMA (rare): a still night in the foothills, far from the city. Ridges and a snow-capped peak (shaped by the
// epoch's hashes) under a big moon, a neon city glowing faintly beyond the ridges and a beacon mast on the summit.
// A maglev glides across the valley viaduct, one car per block (neon stripe in its colour, windows from its logs
// bloom); stone lanterns along the near path, one per block, light in turn; a neon-edged torii carries the current
// block's word and number. Cherry trees frame the view and shed petals (more with transactions). Static camera.
import { TAU, block, bit, clamp, mixRGB, rgb, wrap, verticalSign, vignette, turn, font, LATIN } from "./kit.js";

const BLOSSOM = [[255, 196, 222], [255, 170, 205], [250, 214, 232], [240, 150, 190]];
export function satoyama(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, n = epoch.length, t = frame / frames, blocks = epoch.map(block), pos = t * n;
  const H = k => blocks[(k >> 5) % n].hash[k & 31] / 255;   // epoch-seeded values in [0, 1]
  const [a, b2, mix] = turn(blocks, pos), cur = Math.floor(pos) % n;
  // Sky: indigo to a rose horizon, stars that twinkle in whole cycles per loop.
  const sky = ctx.createLinearGradient(0, 0, 0, S * 0.6);
  sky.addColorStop(0, rgb([7, 6, 28])); sky.addColorStop(0.55, rgb([42, 22, 82])); sky.addColorStop(0.85, rgb([170, 80, 140])); sky.addColorStop(1, rgb([245, 160, 150]));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 60; k++) {
    const x = H(k) * S, y = H(k + 64) * S * 0.38, tw = 0.5 + 0.5 * Math.sin(TAU * (t * (1 + k % 3) + H(k + 128)));
    ctx.fillStyle = `rgba(255,240,255,${0.25 + tw * 0.6})`; ctx.fillRect(x, y, S * 0.003, S * 0.003);
  }
  // The moon and its halo.
  const mx = S * 0.8, my = S * 0.16, mr = S * 0.055;
  const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5); halo.addColorStop(0, "rgba(255,225,235,0.35)"); halo.addColorStop(1, "rgba(255,225,235,0)");
  ctx.fillStyle = halo; ctx.fillRect(0, 0, S, S * 0.6);
  ctx.fillStyle = rgb([255, 240, 228]); ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(200,180,200,0.25)"; for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.4, 0.12]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill(); }
  // The city, far away: a neon glow and a few tower tips peeking over the ridge on the left.
  const city = ctx.createRadialGradient(S * 0.16, S * 0.5, 2, S * 0.16, S * 0.5, S * 0.3); city.addColorStop(0, "rgba(255,60,170,0.55)"); city.addColorStop(0.4, "rgba(80,120,255,0.2)"); city.addColorStop(1, "rgba(80,120,255,0)");
  ctx.fillStyle = city; ctx.fillRect(0, 0, S, S * 0.6);
  for (let k = 0; k < 12; k++) {
    const x = S * (0.04 + k * 0.022), h = S * (0.03 + H(k + 200) * 0.07);
    ctx.fillStyle = rgb([34, 20, 60]); ctx.fillRect(x, S * 0.5 - h, S * 0.014, h);
    ctx.fillStyle = rgb(blocks[k % n].colour, 0.8); ctx.fillRect(x + S * 0.004, S * 0.5 - h + S * 0.006, S * 0.004, S * 0.004);
  }
  // The peak: concave flanks, a snow cap with a ragged edge, and a beacon mast on the summit.
  const px = S * 0.52, pt = S * 0.2, pb = S * 0.52, pw = S * 0.46;
  const flank = u => pt + (pb - pt) * (1 - (1 - u) ** 1.8);   // u = 0 at the summit, 1 at the foot
  ctx.fillStyle = rgb([78, 58, 128]); ctx.beginPath(); ctx.moveTo(px - pw, pb);
  for (let k = 0; k <= 40; k++) { const u = 1 - k / 40; ctx.lineTo(px - pw * u, flank(u)); }
  for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.lineTo(px + pw * u, flank(u)); }
  ctx.fill();
  // Snow cap: down the right flank, back across a ragged snowline, up the left flank.
  ctx.fillStyle = rgb([226, 222, 245]); ctx.beginPath(); ctx.moveTo(px, pt);
  const cap = 0.32, line = flank(cap);
  for (let k = 1; k <= 8; k++) ctx.lineTo(px + pw * cap * k / 8, flank(cap * k / 8));
  for (let k = 0; k <= 14; k++) { const u = cap * (1 - 2 * k / 14), x = px + pw * u, dip = (k % 2 ? 1 : -0.3) * S * (0.006 + H(k + 300) * 0.02); ctx.lineTo(x, Math.max(flank(Math.abs(u)), line - S * 0.01 + dip)); }
  for (let k = 8; k >= 1; k--) ctx.lineTo(px - pw * cap * k / 8, flank(cap * k / 8));
  ctx.fill();
  ctx.strokeStyle = "rgba(20,14,40,0.9)"; ctx.lineWidth = Math.max(1, S * 0.003); ctx.beginPath(); ctx.moveTo(px, pt); ctx.lineTo(px, pt - S * 0.04); ctx.stroke();
  const beam = ctx.createLinearGradient(0, 0, 0, pt); beam.addColorStop(0, "rgba(0,229,255,0)"); beam.addColorStop(1, "rgba(0,229,255,0.28)");
  ctx.fillStyle = beam; ctx.fillRect(px - S * 0.003, 0, S * 0.006, pt - S * 0.04);
  if (Math.sin(TAU * t * 6) > 0) { ctx.save(); ctx.shadowColor = "#ff3040"; ctx.shadowBlur = 10; ctx.fillStyle = "#ff5060"; ctx.fillRect(px - S * 0.004, pt - S * 0.046, S * 0.008, S * 0.008); ctx.restore(); }
  // Ridges, far to near, each a sum of whole-period waves seeded by the epoch, with mist between.
  const ridge = (y0, amp, seed, colour) => {
    ctx.fillStyle = rgb(colour); ctx.beginPath(); ctx.moveTo(0, S);
    for (let k = 0; k <= 64; k++) {
      const x = k / 64; let y = 0;
      for (let f = 1; f <= 4; f++) y += Math.sin(TAU * (f * x + H(seed + f))) * (0.4 + H(seed + f + 8)) / f;
      ctx.lineTo(x * S, y0 - amp * (0.6 + y * 0.5));
    }
    ctx.lineTo(S, S); ctx.fill();
  };
  const mist = (y, h, alpha) => { const g = ctx.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, "rgba(200,150,200,0)"); g.addColorStop(0.5, `rgba(200,150,200,${alpha})`); g.addColorStop(1, "rgba(200,150,200,0)"); ctx.fillStyle = g; ctx.fillRect(0, y - h, S, h * 2); };
  ridge(S * 0.54, S * 0.06, 400, [44, 32, 82]); mist(S * 0.52, S * 0.03, 0.3);
  ridge(S * 0.6, S * 0.07, 440, [28, 20, 56]); mist(S * 0.58, S * 0.025, 0.25);
  // Valley viaduct and the maglev: a ring of cars, one per block, the current block's car centred.
  const vy = S * 0.585, cw = S * 0.12, ring = n * cw;
  ctx.fillStyle = rgb([16, 12, 32]); ctx.fillRect(0, vy, S, S * 0.008);
  for (let k = 0; k < 9; k++) { const x = (k + 0.5) * S / 8 - S / 16; ctx.fillRect(x - S * 0.004, vy, S * 0.008, S * 0.07); }
  ctx.fillStyle = "rgba(0,229,255,0.5)"; ctx.fillRect(0, vy + S * 0.008, S, Math.max(1, S * 0.002));
  for (const b of blocks) {
    const x = S / 2 + wrap((pos - b.i - 0.5) * cw + ring / 2, ring) - ring / 2 - cw / 2;
    if (x > S || x + cw < 0) continue;
    const h = S * 0.022, y = vy - h - S * 0.002, on = b.i === cur;
    ctx.fillStyle = rgb([210, 214, 232]); ctx.beginPath(); ctx.roundRect(x + S * 0.002, y, cw - S * 0.004, h, h * 0.4); ctx.fill();
    ctx.fillStyle = rgb([20, 18, 34]); ctx.fillRect(x + S * 0.004, y + h * 0.18, cw - S * 0.008, h * 0.38);
    for (let w = 0; w < 10; w++) if (bit(b.bloom, w * 11 + b.i)) { ctx.fillStyle = rgb(b.state[w] & 1 ? [255, 210, 140] : [170, 230, 255], on ? 1 : 0.75); ctx.fillRect(x + S * 0.006 + w * (cw - S * 0.012) / 10, y + h * 0.24, (cw - S * 0.012) / 10 - S * 0.002, h * 0.26); }
    ctx.save(); ctx.shadowColor = rgb(b.colour); ctx.shadowBlur = on ? 10 : 4; ctx.fillStyle = rgb(b.colour); ctx.fillRect(x + S * 0.003, y + h * 0.66, cw - S * 0.006, Math.max(1, h * 0.12)); ctx.restore();
  }
  // Valley floor, a village with warm windows, and the river reflecting the moon and the train's lights.
  ctx.fillStyle = rgb([18, 14, 34]); ctx.fillRect(0, S * 0.64, S, S * 0.36);
  for (let k = 0; k < 14; k++) {
    const x = H(k + 500) * S, w = S * (0.025 + H(k + 520) * 0.02), h = S * 0.018, y = S * 0.645 - h;
    ctx.fillStyle = rgb([24, 18, 40]); ctx.fillRect(x, y, w, h);
    ctx.beginPath(); ctx.moveTo(x - w * 0.15, y); ctx.lineTo(x + w / 2, y - h * 0.7); ctx.lineTo(x + w * 1.15, y); ctx.fill();
    if (H(k + 540) > 0.35) { ctx.fillStyle = "rgba(255,190,110,0.85)"; ctx.fillRect(x + w * 0.3, y + h * 0.35, Math.max(1, w * 0.2), Math.max(1, h * 0.3)); }
  }
  const ry = S * 0.66, rh = S * 0.05;
  ctx.fillStyle = rgb([30, 22, 62]); ctx.fillRect(0, ry, S, rh);
  for (let k = 0; k < 16; k++) {
    const y = ry + (k + 0.5) * rh / 16, wob = Math.sin(TAU * (t * 2 + k * 0.37)) * S * 0.006, w = mr * (1.4 - k / 20);
    ctx.fillStyle = `rgba(255,235,230,${0.45 - k * 0.02})`; ctx.fillRect(mx - w / 2 + wob, y, w, Math.max(1, rh / 40));
    ctx.fillStyle = rgb(a.colour, 0.18); ctx.fillRect(S * 0.3 + wob * 2, y, S * 0.4, Math.max(1, rh / 50));
  }
  // Near bank: terraced paddies holding the sky in thin bright lines.
  ctx.fillStyle = rgb([14, 11, 26]); ctx.fillRect(0, ry + rh, S, S);
  for (let k = 0; k < 5; k++) { const y = ry + rh + S * (0.02 + k * 0.022); ctx.fillStyle = `rgba(190,120,190,${0.22 - k * 0.03})`; ctx.fillRect(0, y, S, Math.max(1, S * 0.002)); }
  // Stone lanterns along the path, one per block: the passed ones warm, the current one in its neon colour.
  for (const b of blocks) {
    const x = S * (0.12 + b.i * 0.76 / Math.max(1, n - 1)), y = S * 0.86, s = S * 0.022, on = b.i === cur, lit = wrap(cur - b.i, n) < n / 2;
    ctx.fillStyle = rgb([60, 56, 70]); ctx.fillRect(x - s * 0.25, y - s * 0.9, s * 0.5, s * 0.9); ctx.fillRect(x - s * 0.5, y - s * 1.6, s, s * 0.7);
    ctx.beginPath(); ctx.moveTo(x - s * 0.75, y - s * 1.6); ctx.lineTo(x, y - s * 2.1); ctx.lineTo(x + s * 0.75, y - s * 1.6); ctx.fill();
    const light = on ? b.colour : lit ? [255, 180, 100] : null;
    if (light) { ctx.save(); ctx.shadowColor = rgb(light); ctx.shadowBlur = on ? 14 : 6; ctx.fillStyle = rgb(light, on ? 1 : 0.7); ctx.fillRect(x - s * 0.3, y - s * 1.45, s * 0.6, s * 0.4); ctx.restore(); }
  }
  // The torii, edged in neon, with the current block's word and number.
  const tx = S * 0.54, tb = S * 0.84, th = S * 0.17, tw2 = S * 0.11;
  ctx.save(); ctx.shadowColor = rgb(mixRGB(a.colour, b2.colour, mix)); ctx.shadowBlur = 12; ctx.fillStyle = rgb([200, 40, 50]);
  ctx.fillRect(tx - tw2 * 0.38, tb - th, S * 0.012, th); ctx.fillRect(tx + tw2 * 0.38 - S * 0.012, tb - th, S * 0.012, th);
  ctx.fillRect(tx - tw2 * 0.5, tb - th * 0.68, tw2, S * 0.01);
  ctx.beginPath(); ctx.moveTo(tx - tw2 * 0.62, tb - th - S * 0.01); ctx.quadraticCurveTo(tx, tb - th + S * 0.004, tx + tw2 * 0.62, tb - th - S * 0.01); ctx.lineTo(tx + tw2 * 0.6, tb - th + S * 0.006); ctx.quadraticCurveTo(tx, tb - th + S * 0.02, tx - tw2 * 0.6, tb - th + S * 0.006); ctx.fill();
  ctx.restore();
  // The torii's plaque between the beams reads ベース (Base).
  const pw2 = S * 0.026, ph = th * 0.32 - S * 0.012, py = tb - th + S * 0.012;
  ctx.fillStyle = rgb([20, 14, 30]); ctx.fillRect(tx - pw2 / 2, py, pw2, ph);
  ctx.strokeStyle = "rgba(255,210,120,0.8)"; ctx.lineWidth = Math.max(1, S * 0.002); ctx.strokeRect(tx - pw2 / 2, py, pw2, ph);
  verticalSign(ctx, "ベース", tx, py + ph * 0.2, ph * 0.28, [255, 210, 120], 1, false, null);
  for (const [blk, alpha] of [[a, 1 - mix], [b2, mix]]) {
    if (alpha < 0.02) continue;
    verticalSign(ctx, blk.word, tx, tb - th * 0.5, S * 0.026, blk.colour, alpha, true);
    ctx.save(); ctx.globalAlpha = alpha * 0.9; ctx.font = font(LATIN, S * 0.016); ctx.textAlign = "center"; ctx.fillStyle = rgb(blk.colour); ctx.shadowColor = rgb(blk.colour); ctx.shadowBlur = 6;
    ctx.fillText(`#${blk.n}`, tx, tb + S * 0.03); ctx.restore();
  }
  // Cherry trees framing the view: dark trunks and branches, blossom clusters seeded by the epoch.
  const tree = (bx, dir, scale, seed) => {
    ctx.strokeStyle = rgb([24, 14, 22]); ctx.lineCap = "round";
    const tips = [];
    const branch = (x, y, ang, len, w, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (depth === 0) { tips.push([x2, y2]); return; }
      const k = seed + depth * 3 + tips.length;
      branch(x2, y2, ang - 0.35 - H(k) * 0.3, len * 0.72, w * 0.62, depth - 1);
      branch(x2, y2, ang + 0.3 + H(k + 1) * 0.3, len * 0.7, w * 0.62, depth - 1);
    };
    branch(bx, S, -Math.PI / 2 + dir * 0.22, S * 0.22 * scale, S * 0.03 * scale, 4);
    for (const [k, [x, y]] of tips.entries()) for (let c = 0; c < 9; c++) {
      const r = S * (0.012 + H(seed + k * 9 + c + 40) * 0.02) * scale, ox = (H(seed + k * 9 + c) - 0.5) * S * 0.09 * scale, oy = (H(seed + k * 9 + c + 20) - 0.5) * S * 0.06 * scale;
      ctx.fillStyle = rgb(BLOSSOM[(k + c) % BLOSSOM.length], 0.55 + H(seed + c) * 0.35); ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, TAU); ctx.fill();
    }
    return tips;
  };
  tree(S * 0.0, 1, 0.95, 600); tree(S * 1.02, -1, 0.8, 700);
  // Petals drifting down and across, whole cycles per loop; more with the current block's transactions.
  const petals = 30 + Math.min(40, Math.round(a.tx / 6));
  for (let k = 0; k < petals; k++) {
    const fall = 1 + (k % 2), y = wrap(H(k + 800) + t * fall, 1) * S * 1.05 - S * 0.03, x = wrap(H(k + 900) + Math.sin(TAU * (t * fall + H(k + 950))) * 0.04 + y / S * 0.25, 1) * S;
    const r = S * (0.004 + H(k + 980) * 0.004);
    ctx.save(); ctx.translate(x, y); ctx.rotate(TAU * (t * fall + H(k + 990))); ctx.fillStyle = rgb(BLOSSOM[k % BLOSSOM.length], 0.85); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Two small drones crossing high over the valley, blinking.
  for (let k = 0; k < 2; k++) {
    const x = wrap(H(k + 1000) + t * (k ? 1 : -1), 1) * S, y = S * (0.3 + k * 0.06);
    ctx.fillStyle = Math.sin(TAU * (t * 8 + k * 0.5)) > 0 ? "#ff5060" : "#60f0ff"; ctx.fillRect(x, y, S * 0.005, S * 0.005);
  }
  vignette(ctx, 0.5);
}
