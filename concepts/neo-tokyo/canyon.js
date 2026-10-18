// 峡谷 CANYON: a camera glides down a megacity street canyon at night; each block of the epoch is a building the camera
// passes, with its neon sign, lit windows and (every few blocks) a skybridge. Pseudo-3D: one-point perspective with
// depth fog. Plain canvas JS concept, not onchain code. Continuous: the camera's depth is periodic in the epoch.
import { hologram, WORDS_EN } from "./kit.js";
const TAU = Math.PI * 2;
const hex = h => h.replace(/^0x/, "");
const int = h => Number(BigInt(h));
const bytes = h => Uint8Array.from(hex(h).match(/../g), b => parseInt(b, 16));
const bit = (d, i) => d[(i >> 3) % d.length] >> (7 - (i & 7)) & 1;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => x * x * (3 - 2 * x);
const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;

const NEON = [[255, 46, 136], [0, 229, 255], [177, 76, 255], [255, 176, 0], [57, 255, 136], [255, 77, 77]];
const WORDS = ["電脳", "暗号", "鍵", "署名", "検証", "連鎖", "量子", "未来", "都市", "零", "壱", "夜市", "光速", "記録"];
const FOG = [70, 22, 92], SKY_TOP = [6, 3, 18], STREET = [255, 90, 170];
const FONT = '900 10px "Noto Sans JP"', DOT = '400 10px "DotGothic16"', LATIN = '700 10px "Orbitron"';
const F = 260, NEAR = 0.32, FAR = 14, SP = 1.6;           // spacing per block: 10 blocks span 16 > FAR           // focal length, visible depth range, spacing per block
const STREET_Y = 3.2, CANYON = 1.25;                      // street far below the camera; canyon half-width

function block(b, i) {
  const hash = bytes(b.hash), gas = int(b.gasUsed) / int(b.gasLimit);
  return { i, n: int(b.number), hash, bloom: bytes(b.logsBloom), state: bytes(b.stateRoot), gas, tx: b.txCount ?? 0,
    side: hash[0] & 1 ? 1 : -1, colour: NEON[hash[3] % NEON.length], word: WORDS[hash[5] % WORDS.length], hex: hex(b.hash) };
}

export function canyon(ctx, epoch, frame, frames) {
  const S = ctx.canvas.width, VX = S / 2, VY = S * 0.4, n = epoch.length, D = n * SP;
  const t = frame / frames, camZ = t * D, blocks = epoch.map(block);
  const proj = (x, y, dz) => [VX + x * F / dz * (S / 640), VY + y * F / dz * (S / 640), F / dz * (S / 640)];
  const fogAt = dz => clamp((dz - NEAR) / (FAR - NEAR), 0, 1) ** 0.75;

  // Sky and the glowing haze at the vanishing point.
  const sky = ctx.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, rgb(SKY_TOP)); sky.addColorStop(0.42, rgb(FOG)); sky.addColorStop(1, rgb([20, 6, 30]));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  const core = ctx.createRadialGradient(VX, VY, 2, VX, VY, S * 0.45); core.addColorStop(0, "rgba(255,150,220,0.9)"); core.addColorStop(0.25, "rgba(255,60,170,0.35)"); core.addColorStop(1, "rgba(255,60,170,0)");
  ctx.fillStyle = core; ctx.fillRect(0, 0, S, S);

  // Everything in the canyon, sorted far to near. Each block owns depth [i, i+1) in a ring the camera loops through.
  const items = [];
  for (const b of blocks) {
    let dz = ((b.i * SP - camZ) % D + D) % D; if (dz < NEAR) dz += D;
    if (dz > FAR) continue;
    items.push({ b, dz });
  }
  items.sort((a, c) => c.dz - a.dz);

  // Street far below: rivers of tail lights and headlights flowing toward the vanishing point.
  for (let k = 0; k < 60; k++) {
    const lane = (k % 4) - 1.5, speed = k % 2 ? 1 : -1, z0 = ((k * 0.37 + t * D * (1 + (k % 3)) * speed * 0.5) % FAR + FAR) % FAR + NEAR;
    const [x, y, s] = proj(lane * 0.28, STREET_Y, z0); if (y > S) continue;
    const f = fogAt(z0), c = speed > 0 ? [255, 60, 60] : [255, 240, 220];
    ctx.fillStyle = rgb(mixRGB(c, FOG, f * 0.8), 0.9 - f * 0.6); ctx.fillRect(x - s * 0.02, y, s * 0.04 + 0.6, s * 0.012 + 0.6);
  }

  for (const { b, dz } of items) {
    const f = fogAt(dz), depth = 0.82 * SP, x0 = b.side * (CANYON + (b.hash[1] / 255) * 0.35);
    const top = -2.4 - Math.min(1, b.gas / 0.3) * 7 - (b.hash[2] / 255) * 2, wall = mixRGB([16, 10, 32], FOG, f);
    // Canyon-facing wall: a quad from depth dz to dz+depth.
    const a = proj(x0, top, dz), c = proj(x0, top, dz + depth), d = proj(x0, STREET_Y, dz + depth), e = proj(x0, STREET_Y, dz);
    ctx.fillStyle = rgb(wall); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.fill();
    // Front face toward the camera, out to the edge of the frame.
    const fx = proj(x0 + b.side * 6, top, dz), fb = proj(x0 + b.side * 6, STREET_Y, dz);
    ctx.fillStyle = rgb(mixRGB([10, 6, 22], FOG, f)); ctx.fillRect(Math.min(a[0], fx[0]), a[1], Math.abs(fx[0] - a[0]), fb[1] - a[1]);
    // Windows on the wall: lit where the block's bloom and hash agree; warm or cool from its state root.
    const rows = 30, cols = 5;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const k = r * cols + q; if (!bit(b.bloom, k * 3 + b.i) || !bit(b.hash, k)) continue;
      const y = top + (r + 0.5) / rows * (STREET_Y - top), z = dz + (q + 0.3) / cols * depth, [wx, wy, s] = proj(x0, y, z);
      const warm = b.state[k % 32] & 1, lit = warm ? [255, 190, 110] : [120, 220, 255];
      ctx.fillStyle = rgb(mixRGB(lit, FOG, f * 0.85), 0.9 - f * 0.5); ctx.fillRect(wx - s * 0.006, wy, s * 0.012 + 0.4, s * 0.03 + 0.4);
    }
    // The block's vertical neon sign, hanging into the canyon, with its glow.
    const sx = x0 - b.side * 0.22, [px, py, s] = proj(sx, -1.6 + (b.hash[4] / 255) * 0.8, dz + 0.08);
    const colour = mixRGB(b.colour, FOG, f * 0.7), fs = Math.max(4, s * 0.2);
    ctx.save(); ctx.globalAlpha = 1 - f * 0.55; ctx.fillStyle = rgb([8, 4, 16], 0.92); ctx.fillRect(px - fs * 0.62, py - fs * 0.7, fs * 1.24, fs * (b.word.length * 1.08 + 0.5));
    ctx.font = FONT.replace("10px", `${fs}px`); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = rgb(colour); ctx.shadowBlur = fs * 0.9;
    const on = ((t * 7 + b.hash[6] / 256) % 1) > 0.04 * (b.hash[7] % 3);
    if (on) [...b.word].forEach((ch, k) => { ctx.fillStyle = rgb(colour); ctx.fillText(ch, px, py + k * fs * 1.08); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText(ch, px, py + k * fs * 1.08); });
    if (on && fs >= 6) { ctx.shadowBlur = 0; ctx.font = LATIN.replace("10px", `${fs * 0.24}px`); ctx.fillStyle = rgb(mixRGB(colour, [255, 255, 255], 0.3), 0.55); ctx.fillText(WORDS_EN[b.word], px, py + b.word.length * fs * 1.08 + fs * 0.05); }
    ctx.restore();
    // A horizontal sign with the block number on its front face.
    const [hx, hy, hs] = proj(x0 + b.side * 0.9, 0.9 + (b.hash[8] / 255) * 0.9, dz);
    ctx.save(); ctx.globalAlpha = 0.95 - f * 0.6; ctx.font = LATIN.replace("10px", `${Math.max(3, hs * 0.075)}px`); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = rgb(b.colour); ctx.shadowBlur = hs * 0.08; ctx.fillStyle = rgb(mixRGB(b.colour, FOG, f * 0.6)); ctx.fillText(`#${b.n}`, hx, hy); ctx.restore();
    // Every fourth block: a skybridge across the canyon, with lights; a monorail crosses some of them.
    if (b.i % 4 === 0) {
      const y = -0.6 - (b.hash[9] / 255) * 0.8, [lx, ly, ls] = proj(-CANYON - 0.3, y, dz + 0.4), [rx] = proj(CANYON + 0.3, y, dz + 0.4);
      ctx.fillStyle = rgb(mixRGB([20, 14, 40], FOG, f)); ctx.fillRect(lx, ly, rx - lx, ls * 0.07);
      ctx.fillStyle = rgb(mixRGB([255, 210, 140], FOG, f), 0.8); for (let k = 0; k < 18; k++) ctx.fillRect(lx + (rx - lx) * k / 18, ly + ls * 0.02, ls * 0.012 + 0.5, ls * 0.012 + 0.5);
      if (b.hash[10] & 1) {
        const run = ((t * 3 + b.hash[11] / 255) % 1) * 1.8 - 0.4, w = (rx - lx) * 0.45;
        ctx.fillStyle = rgb(mixRGB([225, 230, 240], FOG, f)); ctx.fillRect(lx + (rx - lx) * run, ly - ls * 0.05, w, ls * 0.045);
        ctx.fillStyle = rgb(mixRGB([0, 200, 255], FOG, f)); ctx.fillRect(lx + (rx - lx) * run, ly - ls * 0.015, w, ls * 0.008 + 0.5);
      }
    }
    // Cables strung across the canyon.
    if (b.hash[12] % 3 === 0) {
      const [ax, ay] = proj(-CANYON, -2 + b.hash[13] / 128, dz + 0.5), [bx, by] = proj(CANYON, -2 + b.hash[14] / 128, dz + 0.5);
      ctx.strokeStyle = rgb(mixRGB([30, 20, 50], FOG, f), 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + 30 / dz, bx, by); ctx.stroke();
    }
  }

  // Flying traffic: lights moving along the canyon at several heights, with trails; more with more transactions.
  const cur = blocks[Math.floor(camZ / SP + 4) % n], traffic = 10 + Math.round(cur.tx / 12);
  for (let k = 0; k < traffic; k++) {
    const h = bytes(epoch[k % n].hash), lane = (h[k % 32] / 255 - 0.5) * 1.6, alt = -2.2 + (h[(k + 5) % 32] / 255) * 2.6;
    const dir = k % 3 ? 1 : -1, z = ((h[(k + 9) % 32] / 255 * FAR + dir * -t * D * 0.9) % FAR + FAR) % FAR + NEAR;
    const [x, y, s] = proj(lane, alt, z), [x2, y2] = proj(lane, alt, z + 0.45 * dir), f = fogAt(z);
    const c = dir > 0 ? [255, 70, 90] : [210, 240, 255];
    ctx.strokeStyle = rgb(mixRGB(c, FOG, f * 0.7), 0.85 - f * 0.5); ctx.lineWidth = Math.max(0.6, s * 0.012); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // The hologram: the block just ahead, projected over the canyon, crossfading as blocks pass.
  const ahead = camZ / SP + 4, i0 = Math.floor(ahead) % n, i1 = (i0 + 1) % n, mixT = smooth(clamp((ahead % 1 - 0.7) / 0.3, 0, 1));
  hologram(ctx, blocks[i0], blocks[i1], mixT, VX, VY - S * 0.27, S / 640, t);

  // Light shafts from above, drifting slowly.
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 3; k++) {
    const x = S * (0.3 + 0.2 * k) + Math.sin(TAU * t + k) * S * 0.05, g = ctx.createLinearGradient(x, 0, x + S * 0.12, S * 0.7);
    g.addColorStop(0, "rgba(150,200,255,0.10)"); g.addColorStop(1, "rgba(150,200,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - S * 0.03, 0); ctx.lineTo(x + S * 0.04, 0); ctx.lineTo(x + S * 0.2, S * 0.75); ctx.lineTo(x + S * 0.05, S * 0.75); ctx.fill();
  }
  ctx.restore();

  // Rain: integer speeds per loop keep it seamless.
  ctx.strokeStyle = "rgba(190,210,255,0.22)"; ctx.lineWidth = 1;
  for (let k = 0; k < 60; k++) {
    const h = bytes(epoch[k % n].hash), x = (h[k % 32] * 7 + k * 13) % S, len = 6 + h[(k + 3) % 32] % 8, speed = 2 + (k % 3);
    const y = ((h[(k + 7) % 32] / 255 + t * speed) % 1) * (S + len) - len;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.15, y + len); ctx.stroke();
  }

  // Foreground: a rooftop ledge and a lone figure looking down the canyon, rim-lit by the haze.
  ctx.fillStyle = "#05030a"; ctx.beginPath(); ctx.moveTo(0, S * 0.78); ctx.lineTo(S * 0.42, S * 0.86); ctx.lineTo(S * 0.42, S); ctx.lineTo(0, S); ctx.fill();
  ctx.strokeStyle = "rgba(255,90,180,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, S * 0.78); ctx.lineTo(S * 0.42, S * 0.86); ctx.stroke();
  const fx = S * 0.27, fy = S * 0.835, sway = Math.sin(TAU * t * 2) * S * 0.004;
  ctx.fillStyle = "#020104"; ctx.beginPath();
  ctx.ellipse(fx, fy - S * 0.105, S * 0.011, S * 0.013, 0, 0, TAU); ctx.fill();          // head
  ctx.beginPath(); ctx.moveTo(fx - S * 0.016, fy - S * 0.092); ctx.lineTo(fx + S * 0.016, fy - S * 0.092);
  ctx.lineTo(fx + S * 0.03 + sway, fy); ctx.lineTo(fx - S * 0.024 + sway, fy); ctx.fill();   // coat, lifted by the wind
  ctx.strokeStyle = "rgba(255,120,200,0.55)"; ctx.beginPath(); ctx.moveTo(fx + S * 0.011, fy - S * 0.118); ctx.lineTo(fx + S * 0.016, fy - S * 0.09); ctx.lineTo(fx + S * 0.03 + sway, fy); ctx.stroke();

  // Vignette.
  const v = ctx.createRadialGradient(VX, S * 0.45, S * 0.3, VX, S * 0.5, S * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, S, S);
}
