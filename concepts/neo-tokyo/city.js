// Neo-Tokyo block art: cyberpunk Japanese city scenes built from an epoch of consecutive Base blocks. Plain canvas JS,
// not onchain code. The epoch is the city; the loop moves through it, one block per frame (50 blocks = 2s at 25fps).
// Everything is a deterministic function of (epoch, frame): no Math.random, and every motion is periodic in the loop.
// Each scene holds every block for `perBlock` frames at 15fps (9 frames: 0.6 s per block, a 6 s loop for 10 blocks).
export const SIZE = 512;
export const FONTS = ['900 40px "Noto Sans JP"', '400 40px "DotGothic16"', '700 40px "Orbitron"'];
export const FONT_TEXT = "電脳暗号鍵署名検証連鎖量子夜雨光未来都市零壱弐参肆伍次は取引件第号ブロックベースガス終点東京新宿";

const TAU = Math.PI * 2;
const hex = h => h.replace(/^0x/, "");
const int = h => Number(BigInt(h));
const bytes = h => Uint8Array.from(hex(h).match(/../g), b => parseInt(b, 16));
const bit = (data, i) => data[(i >> 3) % data.length] >> (7 - (i & 7)) & 1;

/** Block facts every scene uses. */
function facts(b) {
  return { n: int(b.number), gas: int(b.gasUsed) / int(b.gasLimit), tx: b.txCount ?? 0, hash: bytes(b.hash),
    bloom: bytes(b.logsBloom), state: bytes(b.stateRoot), txRoot: bytes(b.transactionsRoot), hex: hex(b.hash) };
}

/** Seeded generator (mulberry32) from a block hash, so each block always gets the same city. */
function rng(seedBytes, salt = 0) {
  let a = (seedBytes[0] << 24 | seedBytes[1] << 16 | seedBytes[2] << 8 | seedBytes[3]) ^ Math.imul(salt + 1, 0x9e3779b1);
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const NEON = ["#ff2e88", "#00e5ff", "#b14cff", "#ffb000", "#39ff88", "#ff4d4d", "#4d7cff"];
const neonOf = (data, i = 0) => NEON[data[i] % NEON.length];
const WORDS = ["電脳", "暗号", "鍵", "署名", "検証", "連鎖", "量子", "夜", "雨", "光", "未来", "都市", "零", "壱"];
const wordOf = data => WORDS[data[5] % WORDS.length];

function glow(ctx, colour, blur, draw) {
  ctx.save(); ctx.shadowColor = colour; ctx.shadowBlur = blur; draw(); ctx.restore();
}
function neonText(ctx, text, x, y, font, colour, blur = 18, align = "center") {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.shadowColor = colour; ctx.shadowBlur = blur; ctx.fillStyle = colour; ctx.fillText(text, x, y);
  ctx.shadowBlur = blur / 3; ctx.fillStyle = "#ffffffcc"; ctx.globalAlpha = 0.55; ctx.fillText(text, x, y); ctx.restore();
}
function verticalText(ctx, text, x, y, size, font, colour, blur = 14) {
  [...text].forEach((ch, i) => neonText(ctx, ch, x, y + i * size * 1.05, `${font.replace(/\d+px/, size + "px")}`, colour, blur));
}

/** Rain: streak positions advance an integer number of screen heights per loop, so the loop is seamless. */
function rain(ctx, t, count, seed, colour = "rgba(170,220,255,0.28)", angle = 0.12) {
  const r = rng(seed, 99);
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const x0 = r() * (SIZE + 80), len = 8 + r() * 18, speed = 1 + Math.floor(r() * 3);
    const y = ((r() + t * speed) % 1) * (SIZE + len) - len, x = x0 - y * angle;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * angle, y + len); ctx.stroke();
  }
  ctx.restore();
}

/** Mirror the area above `y` into the ground below it, faded: wet asphalt. */
function reflect(ctx, y, alpha = 0.32) {
  const h = SIZE - y, src = ctx.getImageData(0, y - h, SIZE, h);
  const off = new OffscreenCanvas(SIZE, h); off.getContext("2d").putImageData(src, 0, 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(0, y + h); ctx.scale(1, -1); ctx.filter = "blur(1.5px)";
  ctx.drawImage(off, 0, 0); ctx.restore();
  const g = ctx.createLinearGradient(0, y, 0, SIZE); g.addColorStop(0, "rgba(5,3,14,0.15)"); g.addColorStop(1, "rgba(5,3,14,0.85)");
  ctx.fillStyle = g; ctx.fillRect(0, y, SIZE, h);
}

function nightSky(ctx, top = "#04020c", mid = "#170735", low = "#4a0f45") {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(0.8, low);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
}

// 1. 夜景 SKYLINE ---------------------------------------------------------------------------------------------------
function skyline(ctx, epoch, f, t) {
  const n = epoch.length, cur = facts(epoch[f]), all = epoch.map(facts);
  nightSky(ctx);
  // Haze glow behind the city.
  const haze = ctx.createRadialGradient(SIZE * 0.55, 330, 10, SIZE * 0.55, 330, 320);
  haze.addColorStop(0, "rgba(255,46,136,0.35)"); haze.addColorStop(1, "rgba(255,46,136,0)"); ctx.fillStyle = haze; ctx.fillRect(0, 0, SIZE, SIZE);
  // Far skyline from every hash byte of the epoch: dim silhouettes.
  const far = rng(all[0].hash, 1);
  ctx.fillStyle = "#1a0b2e";
  for (let x = 0; x < SIZE; x += 6 + far() * 10) ctx.fillRect(x, 330 - (40 + far() * 120), 8 + far() * 14, 200);
  // Towers: one per block, left to right. Height = gas, width = transactions, windows = logs bloom.
  const groundY = 400, slot = SIZE / n;
  all.forEach((b, i) => {
    const r = rng(b.hash, 2), w = Math.max(7, Math.min(30, 6 + b.tx / 14)), h = 70 + Math.min(1, b.gas / 0.3) * 250 + r() * 30;
    const x = i * slot + slot / 2 - w / 2, top = groundY - h, now = i === f;
    ctx.fillStyle = now ? "#20103a" : "#0c0820"; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "rgba(120,80,200,0.25)"; ctx.fillRect(x, top, 1, h);
    // Windows: lit where the bloom and hash agree; colour temperature from the state root.
    for (let wy = top + 4, k = 0; wy < groundY - 4; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 3, k++) {
      if (!bit(b.bloom, k * 7 + i) || !bit(b.hash, k)) continue;
      const flick = (b.hash[k % 32] + Math.floor(t * 4)) % 23 === 0;
      ctx.fillStyle = flick ? "#ffffff" : (b.state[k % 32] & 1 ? "rgba(255,190,90,0.85)" : "rgba(120,220,255,0.75)");
      ctx.fillRect(wx, wy, 1.5, 2);
    }
    // Rooftop beacon, blinking once per loop at its own phase.
    const on = ((t + b.hash[1] / 256) % 1) < 0.18;
    if (on) glow(ctx, "#ff2020", 10, () => { ctx.fillStyle = "#ff4040"; ctx.fillRect(x + w / 2 - 1, top - 4, 2, 2); });
    if (now) {
      // Searchlights sweep up from the current block's tower; its neon sign runs down the side.
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * (0.25 + 0.18 * Math.sin(TAU * t)), len = 520;
        const beam = ctx.createLinearGradient(x + w / 2, top, x + w / 2 + Math.cos(a) * len, top + Math.sin(a) * len);
        beam.addColorStop(0, "rgba(160,230,255,0.35)"); beam.addColorStop(1, "rgba(160,230,255,0)");
        ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x + w / 2, top);
        ctx.lineTo(x + w / 2 + Math.cos(a - 0.05) * len, top + Math.sin(a - 0.05) * len);
        ctx.lineTo(x + w / 2 + Math.cos(a + 0.05) * len, top + Math.sin(a + 0.05) * len); ctx.fill();
      }
      verticalText(ctx, wordOf(b.hash), x + w + 8, top + 18, 13, FONTS[0], neonOf(b.hash), 16);
    }
  });
  // Elevated railway: a train crosses once per loop; one car per 40 transactions.
  ctx.fillStyle = "#07040f"; ctx.fillRect(0, 372, SIZE, 5);
  for (let x = 10; x < SIZE; x += 46) ctx.fillRect(x, 377, 4, 24);
  const cars = Math.max(2, Math.min(9, Math.round(cur.tx / 40))), carW = 44, trainX = -cars * (carW + 3) + t * (SIZE + cars * (carW + 3));
  for (let c = 0; c < cars; c++) {
    const cx = trainX + c * (carW + 3);
    ctx.fillStyle = "#d8dce8"; ctx.fillRect(cx, 358, carW, 13); ctx.fillStyle = "#1a7fff"; ctx.fillRect(cx, 366, carW, 2);
    ctx.fillStyle = "rgba(255,240,200,0.95)"; for (let wx = cx + 4; wx < cx + carW - 4; wx += 7) ctx.fillRect(wx, 360, 4, 4);
  }
  // Holographic billboard: the current block in Japanese, with a glitch slice every few frames.
  ctx.save(); ctx.globalAlpha = 0.92;
  const bx = 24, by = 44, bw = 246, bh = 118, colour = neonOf(cur.hash);
  ctx.fillStyle = "rgba(10,4,24,0.72)"; ctx.fillRect(bx, by, bw, bh);
  glow(ctx, colour, 14, () => { ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh); });
  neonText(ctx, "ブロック", bx + 14, by + 20, FONTS[0].replace("40px", "18px"), colour, 10, "left");
  neonText(ctx, `#${cur.n.toLocaleString("en")}`, bx + 14, by + 52, FONTS[2].replace("40px", "26px"), "#ffffff", 16, "left");
  neonText(ctx, `取引 ${cur.tx}件  ガス ${(cur.gas * 100).toFixed(1)}%`, bx + 14, by + 80, FONTS[1].replace("40px", "15px"), "#9fefff", 8, "left");
  ctx.save(); ctx.font = FONTS[2].replace("40px", "8px"); ctx.fillStyle = "rgba(160,240,255,0.5)"; ctx.fillText(`${cur.tx} TX · ${(cur.gas * 100).toFixed(1)}% GAS`, bx + 14, by + 95); ctx.fillText("BLOCK", bx + 90, by + 23); ctx.restore();
  neonText(ctx, `0x${cur.hex.slice(0, 22)}…`, bx + 14, by + 108, FONTS[1].replace("40px", "11px"), "#b07cff", 6, "left");
  if (f % 7 === 3) { const s = ctx.getImageData(bx, by + 40, bw, 10); ctx.putImageData(s, bx + 6, by + 40); }
  ctx.restore();
  reflect(ctx, groundY);
  // Street neon along the ground line.
  for (let i = 0; i < 6; i++) { const c = NEON[(cur.hash[i] + i) % NEON.length]; glow(ctx, c, 12, () => { ctx.fillStyle = c; ctx.fillRect(20 + i * 82, groundY + 2, 40, 2); }); }
  rain(ctx, t, 90 + Math.round(cur.gas * 600), cur.hash);
}

// 2. 路地 ALLEY ------------------------------------------------------------------------------------------------------
function alley(ctx, epoch, f, t) {
  const n = epoch.length, cur = facts(epoch[f]);
  ctx.fillStyle = "#05030b"; ctx.fillRect(0, 0, SIZE, SIZE);
  const vx = SIZE / 2, vy = 230;  // vanishing point
  // Sky slit between the buildings.
  const sky = ctx.createLinearGradient(0, 0, 0, vy); sky.addColorStop(0, "#0a0420"); sky.addColorStop(1, "#5a1450");
  ctx.fillStyle = sky; ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(362, 0); ctx.lineTo(vx + 18, vy); ctx.lineTo(vx - 18, vy); ctx.fill();
  // Walls converging to the vanishing point.
  for (const side of [-1, 1]) {
    ctx.fillStyle = side < 0 ? "#0d0818" : "#100a1c"; ctx.beginPath();
    ctx.moveTo(vx + side * 18, vy); ctx.lineTo(vx + side * 256, -40); ctx.lineTo(vx + side * 256, SIZE); ctx.lineTo(vx + side * 18, vy + 30); ctx.fill();
  }
  // Signs: the ten blocks around the current one, receding into the alley; nearer = later in the loop window.
  for (let k = 9; k >= 0; k--) {
    const j = (f + k) % n, b = facts(epoch[j]), depth = 1 - k / 10, side = b.hash[2] & 1 ? 1 : -1;
    const sx = vx + side * (26 + depth * 190), sy = vy - 20 - depth * 150, size = 6 + depth * 26;
    const colour = neonOf(b.hash, 3), on = k === 0 || ((t * 3 + b.hash[4] / 256) % 1) > 0.08 * (b.hash[6] % 4);
    ctx.save(); ctx.globalAlpha = 0.35 + depth * 0.65;
    ctx.fillStyle = "rgba(8,4,16,0.9)"; ctx.fillRect(sx - size * 0.62, sy - size * 0.7, size * 1.24, size * (wordOf(b.hash).length * 1.05 + 0.4));
    if (on) verticalText(ctx, wordOf(b.hash), sx, sy, size, FONTS[0], colour, 6 + depth * 18);
    ctx.restore();
  }
  // The current block's big sign by the door: vertical "第 … 号".
  const colour = neonOf(cur.hash);
  ctx.fillStyle = "rgba(8,4,16,0.92)"; ctx.fillRect(404, 70, 64, 300);
  glow(ctx, colour, 18, () => { ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.strokeRect(404, 70, 64, 300); });
  verticalText(ctx, `第${cur.n.toString().slice(-4)}号`, 436, 100, 34, FONTS[0], colour, 20);
  neonText(ctx, "ブロック", 436, 352, FONTS[1].replace("40px", "14px"), "#ffffff", 8);
  // Vending machine: the block hash glowing in a column of hex, buttons coloured by the tx root.
  ctx.fillStyle = "#0f1730"; ctx.fillRect(40, 300, 96, 170);
  glow(ctx, "#4d7cff", 20, () => { ctx.fillStyle = "rgba(120,170,255,0.18)"; ctx.fillRect(48, 310, 80, 96); });
  ctx.font = FONTS[1].replace("40px", "11px"); ctx.fillStyle = "#cfe3ff";
  for (let r = 0; r < 8; r++) ctx.fillText(cur.hex.slice(r * 8, r * 8 + 8), 56, 324 + r * 11);
  for (let i = 0; i < 8; i++) { const c = NEON[cur.txRoot[i] % NEON.length]; glow(ctx, c, 6, () => { ctx.fillStyle = c; ctx.fillRect(52 + (i % 4) * 19, 420 + Math.floor(i / 4) * 16, 12, 6); }); }
  // Steam from a vent: puffs rising once per loop.
  for (let p = 0; p < 6; p++) {
    const life = (t + p / 6) % 1, px = 330 + Math.sin(TAU * (life + p)) * 8, py = 470 - life * 140;
    ctx.fillStyle = `rgba(200,180,255,${0.12 * (1 - life)})`; ctx.beginPath(); ctx.arc(px, py, 10 + life * 30, 0, TAU); ctx.fill();
  }
  reflect(ctx, 400, 0.4);
  rain(ctx, t, 140 + Math.round(cur.gas * 700), cur.hash, "rgba(200,170,255,0.3)", 0.05);
  // Ripples in puddles, one per transaction bucket.
  for (let i = 0; i < Math.min(12, Math.round(cur.tx / 25)); i++) {
    const r = rng(cur.hash, 50 + i), life = (t * 2 + r()) % 1, x = 150 + r() * 220, y = 420 + r() * 80;
    ctx.strokeStyle = `rgba(255,120,220,${0.5 * (1 - life)})`; ctx.beginPath(); ctx.ellipse(x, y, 4 + life * 18, 1.5 + life * 5, 0, 0, TAU); ctx.stroke();
  }
}

// 3. 夜行 NIGHT TRAIN ------------------------------------------------------------------------------------------------
function nightTrain(ctx, epoch, f, t) {
  const n = epoch.length, cur = facts(epoch[f]), all = epoch.map(facts);
  nightSky(ctx, "#020108", "#0c0626", "#2a0a38");
  // The city outside, scrolling past: two parallax layers of the epoch's towers. The current block is at the centre.
  const spacing = 34;
  for (const [layer, speed, shade] of [[0, 0.5, "#140a28"], [1, 1, "#0a0618"]]) {
    for (let k = -9; k <= 9; k++) {
      const j = ((f + k) % n + n) % n, b = all[j], r = rng(b.hash, 10 + layer);
      const x = SIZE / 2 + (k - (layer ? 0 : t * 0)) * spacing / speed, h = 60 + Math.min(1, b.gas / 0.3) * 200 + r() * 40;
      const w = (layer ? 26 : 18) + r() * 8, top = 380 - h * (layer ? 1 : 0.7);
      ctx.fillStyle = shade; ctx.fillRect(x - w / 2, top, w, 400 - top);
      if (layer) for (let wy = top + 5, q = 0; wy < 370; wy += 6) for (let wx = x - w / 2 + 3; wx < x + w / 2 - 3; wx += 4, q++)
        if (bit(b.bloom, q * 5 + j) && bit(b.hash, q)) { ctx.fillStyle = b.state[q % 32] & 1 ? "rgba(255,200,110,0.8)" : "rgba(130,220,255,0.7)"; ctx.fillRect(wx, wy, 2, 3); }
      if (layer && k === 0) verticalText(ctx, wordOf(b.hash), x + w / 2 + 9, top + 14, 12, FONTS[0], neonOf(b.hash), 14);
    }
  }
  // Motion blur streaks: lights rushing past the window.
  for (let i = 0; i < 30; i++) {
    const r = rng(cur.hash, 200 + i), y = 120 + r() * 260, x = ((r() - t * 3) % 1 + 1) % 1 * (SIZE + 200) - 100;
    ctx.fillStyle = NEON[i % NEON.length] + "55"; ctx.fillRect(x, y, 60 + r() * 80, 1.5);
  }
  // Rain on the glass: fixed droplets (from the hash) with highlights.
  for (let i = 0; i < 80; i++) {
    const r = rng(cur.hash, 300 + i), x = 40 + r() * 432, y = 90 + r() * 300, s = 1 + r() * 2.5;
    ctx.fillStyle = "rgba(200,230,255,0.35)"; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  // Train interior frame: window mullions, ceiling, and the LED display.
  ctx.fillStyle = "#0b0b10"; ctx.fillRect(0, 0, SIZE, 82); ctx.fillRect(0, 400, SIZE, 112); ctx.fillRect(0, 0, 34, SIZE); ctx.fillRect(SIZE - 34, 0, 34, SIZE); ctx.fillRect(360, 82, 18, 318);
  ctx.fillStyle = "#1c1c26"; ctx.fillRect(34, 76, SIZE - 68, 6); ctx.fillRect(34, 400, SIZE - 68, 6);
  ctx.fillStyle = "#050505"; ctx.fillRect(96, 14, 320, 46);
  neonText(ctx, `次は #${cur.n}`, 110, 28, FONTS[1].replace("40px", "18px"), "#ffb000", 10, "left");
  ctx.save(); ctx.font = FONTS[2].replace("40px", "7px"); ctx.fillStyle = "rgba(255,176,0,0.5)"; ctx.fillText("NEXT", 330, 30); ctx.restore();
  const ticker = `取引 ${cur.tx}件 ・ ガス ${(cur.gas * 100).toFixed(1)}% ・ 0x${cur.hex.slice(0, 16)} ・ ベース ・ `;
  ctx.save(); ctx.beginPath(); ctx.rect(100, 40, 312, 18); ctx.clip();
  ctx.font = FONTS[1].replace("40px", "13px"); const tw = ctx.measureText(ticker).width;
  neonText(ctx, ticker + ticker, 100 - t * tw, 50, FONTS[1].replace("40px", "13px"), "#ff7a00", 6, "left"); ctx.restore();
  // Hand straps, swaying with the train.
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 90, sway = Math.sin(TAU * t + i * 0.7) * 6;
    ctx.strokeStyle = "#2a2a35"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x + sway, 128); ctx.stroke();
    ctx.strokeStyle = "#e8e8f0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x + sway, 138, 8, 10, 0, 0, TAU); ctx.stroke();
  }
  // Seat-level reflection of the display in the dark lower panel.
  ctx.save(); ctx.globalAlpha = 0.25; neonText(ctx, `#${cur.n}`, SIZE / 2, 450, FONTS[2].replace("40px", "22px"), neonOf(cur.hash), 20); ctx.restore();
}

import { canyon } from "./canyon.js";
import { descent } from "./descent.js";
import { monorail } from "./monorail.js";
import { spire } from "./spire.js";
import { alley as alleyWalk } from "./alley.js";
import { skyline3d } from "./skyline3d.js";
import { train3d } from "./train3d.js";
import { satoyama } from "./satoyama.js";

export const SCENES = [
  { id: "canyon", name: "峡谷 CANYON", perBlock: 9, about: "The camera glides down a megacity street canyon; each block is a building it passes: a vertical neon sign with a word from its hash, windows lit from its logs bloom, a skybridge every fourth block. The block just ahead is projected as a hologram, crossfading as blocks pass. Flying traffic grows with transactions; a lone figure watches from a ledge.", draw: canyon, continuous: true },
  { id: "descent", name: "地下 DESCENT", perBlock: 9, about: "Riding the front of a train down a deep subway tunnel. Each block is a tunnel segment: wall lamps from its logs bloom, a lit sign with its word and number, a signal at its start. The track runs underneath toward the glow at the end of the line; level camera, no rotation.", draw: descent, continuous: true },
  { id: "monorail", name: "高架 MONORAIL", perBlock: 9, about: "Riding an elevated monorail through the canyon under a sodium-orange haze. Every fifth block is a station whose sign shows it; the other blocks are towers with neon signs; oncoming trains rush past; the cab console shows the next station and speed (from gas).", draw: monorail, continuous: true },
  { id: "spire", name: "摩天楼 SPIRE", perBlock: 9, about: "Orbiting one endless megatower built from the epoch: a segment per block (width from gas, windows from the logs bloom) with a neon ring and a vertical sign, streaming down as the camera spirals up. Teal and amber; traffic circles; a cloud deck below.", draw: spire, continuous: true },
  { id: "skyline", name: "夜景 SKYLINE", perBlock: 9, about: "A slow flyover above the megacity at night. Each block is a tower rising from a low fog sea along the flight path (height from gas, windows from its logs bloom, a neon rim and a rooftop sign with its word); flying traffic runs alongside; the horizon glows ahead.", draw: skyline3d, continuous: true },
  { id: "alley", name: "路地 ALLEY", perBlock: 9, about: "Walking slowly down a rain-soaked back alley. Each block is a stretch of wall with its vertical neon sign (a word from its hash), windows lit from its logs bloom, AC units and red lanterns on cables. The far end glows; a gate sign there shows the block ahead, and a vending machine by the camera glows with its hash. Puddles ripple with its transactions.", draw: alleyWalk, continuous: true },
  { id: "train", name: "夜行 NIGHT TRAIN", perBlock: 9, about: "Looking out of a moving train's side window: catenary poles whip past, the epoch's towers (one per block, with neon signs) pass in the middle, a far skyline drifts. Inside, straps sway, rain streaks sideways on the glass, and the LED display shows the block passing.", draw: train3d, continuous: true },
  { id: "satoyama", name: "里山 SATOYAMA", rare: true, perBlock: 9, about: "RARE (about 1 in 64 mints). A still night in the foothills, far from the city: ridges and a snow-capped peak shaped by the epoch, a beacon mast on the summit, the city glowing faintly beyond. A maglev crosses the valley viaduct, one car per block (neon stripe, windows from its logs bloom); stone lanterns, one per block, light in turn; a neon-edged torii shows the current block. Cherry trees shed petals, more with transactions.", draw: satoyama, continuous: true },
];

/** Frames in one loop of `scene` over `epoch`. */
export const frameCount = (scene, epoch) => epoch.length * scene.perBlock;

/** Draw frame `frame` of `scene` for `epoch` into a 2D context. */
export function drawScene(ctx, scene, epoch, frame) {
  const frames = frameCount(scene, epoch);
  ctx.save(); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (scene.continuous) scene.draw(ctx, epoch, frame, frames);
  else {
    // The earlier scenes are laid out at 512px and read pixels back (reflections), so draw them offscreen and scale.
    const off = new OffscreenCanvas(SIZE, SIZE), octx = off.getContext("2d", { willReadFrequently: true });
    scene.draw(octx, epoch, Math.floor(frame / scene.perBlock), frame / frames);
    ctx.drawImage(off, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  ctx.restore();
}
