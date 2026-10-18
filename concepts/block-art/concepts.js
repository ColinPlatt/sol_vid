// Cypherpunk block-art concepts. Plain JS, not onchain code: each concept draws one frame of a looping video from an
// epoch of consecutive Base block headers, one block per frame. Everything is a pure function of (epoch, frame).
export const W = 128, H = 128;

// 3x5 pixel font. Each glyph is 15 bits, rows top to bottom.
const GLYPHS = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  Z: "111001010100111", " ": "000000000000000", "#": "101111101111101", ".": "000000000000010", ":": "000010000010000",
  "-": "000000111000000", "/": "001001010100100", "%": "101001010100101", ">": "100010001010100", "_": "000000000000111",
  "=": "000111000111000", "+": "000010111010000", "[": "110100100100110", "]": "011001001001011", "|": "010010010010010",
};
GLYPHS.a = GLYPHS.A; GLYPHS.b = GLYPHS.B; GLYPHS.c = GLYPHS.C; GLYPHS.d = GLYPHS.D; GLYPHS.e = GLYPHS.E; GLYPHS.f = GLYPHS.F; GLYPHS.x = GLYPHS.X;

const hex = h => h.replace(/^0x/, "");
const int = h => Number(BigInt(h));
const bytes = h => Uint8Array.from(hex(h).match(/../g), b => parseInt(b, 16));
const bit = (data, i) => data[i >> 3] >> (7 - (i & 7)) & 1;
const popcount = v => { let n = 0; for (; v; v &= v - 1) n++; return n; };
const fullness = b => int(b.gasUsed) / int(b.gasLimit);

/** Deterministic noise from any integers (no Math.random: the same epoch always renders the same video). */
function noise(...xs) {
  let h = 2166136261;
  for (const x of xs) { h ^= x & 0xffffffff; h = Math.imul(h, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); }
  return (h ^ h >>> 15) >>> 0;
}

class Canvas {
  constructor() { this.rgba = new Uint8ClampedArray(W * H * 4); }
  fill([r, g, b]) { for (let i = 0; i < W * H; i++) { this.rgba[i * 4] = r; this.rgba[i * 4 + 1] = g; this.rgba[i * 4 + 2] = b; this.rgba[i * 4 + 3] = 255; } }
  put(x, y, [r, g, b]) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = ((y | 0) * W + (x | 0)) * 4; this.rgba[o] = r; this.rgba[o + 1] = g; this.rgba[o + 2] = b;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c); }
  text(x, y, s, c, scale = 1) {
    for (const [n, ch] of [...s].entries()) {
      const g = GLYPHS[ch] ?? GLYPHS[" "];
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === "1") this.rect(x + (n * 4 + k) * scale, y + r * scale, scale, scale, c);
    }
  }
  /** CRT feel: darken every other row, so the art reads as a phosphor screen. */
  scanlines(amount = 0.82) { for (let y = 1; y < H; y += 2) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; for (let c = 0; c < 3; c++) this.rgba[o + c] *= amount; } }
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const PHOSPHOR = { bg: [3, 8, 5], dim: [10, 30, 16], grid: [16, 44, 24], mid: [30, 110, 55], green: [60, 210, 100], glow: [170, 255, 190], amber: [255, 176, 40], red: [255, 70, 70], white: [230, 255, 235], cyan: [80, 230, 255], magenta: [255, 60, 200] };

// 1. TERMINAL: a node's console. The current block's 2048-bit logs bloom fills the top as a bit matrix, and the epoch
//    scrolls past as a ledger, one line per block, the newest highlighted.
function terminal(c, epoch, f) {
  const P = PHOSPHOR, b = epoch[f], bloom = bytes(b.logsBloom);
  c.fill(P.bg);
  c.text(2, 2, `BASE #${int(b.number)}`, P.amber);
  if (f % 10 < 6) c.rect(2 + 4 * `BASE #${int(b.number)}`.length, 2, 3, 5, P.amber);
  c.text(98, 2, `${String(f + 1).padStart(2, "0")}/${epoch.length}`, P.mid);
  // Bloom: 64x32 bits drawn 2x1, so 128x32 pixels; a lit bit is a log address or topic this block touched.
  for (let i = 0; i < 2048; i++) {
    const x = (i % 64) * 2, y = 10 + (i >> 6);
    const on = bit(bloom, i), sparkle = noise(i, f) % 9 === 0;
    const col = on ? (sparkle ? P.glow : P.green) : ((i % 64) % 8 === 0 || (i >> 6) % 8 === 0 ? P.grid : P.dim);
    c.put(x, y, col); c.put(x + 1, y, on ? mix(col, P.bg, 0.35) : col);
  }
  // Gas meter and stats.
  const gas = fullness(b), w = Math.round(124 * gas / 0.3);
  c.rect(2, 45, 124, 3, P.dim); c.rect(2, 45, Math.min(124, w), 3, gas > 0.2 ? P.amber : P.green);
  c.text(2, 50, `GAS ${(gas * 100).toFixed(1)}% TX ${b.txCount} BASEFEE ${int(b.baseFeePerGas)}`, P.mid);
  // Ledger: the eight blocks up to this one, wrapping around the epoch so the loop is seamless.
  for (let k = 0; k < 8; k++) {
    const j = ((f - 7 + k) % epoch.length + epoch.length) % epoch.length;
    const e = epoch[j], y = 60 + k * 8, now = j === f;
    c.text(2, y, `> ${hex(e.hash).slice(0, 16)}`, now ? P.glow : P.mid);
    c.text(80, y, `${String(e.txCount).padStart(3)}TX`, now ? P.amber : P.dim);
    c.rect(104, y + 1, Math.max(1, Math.round(22 * fullness(e) / 0.3)), 3, now ? P.green : P.grid);
  }
  c.text(2, 122, `0x${hex(b.parentHash).slice(0, 8)} > 0x${hex(b.hash).slice(0, 8)}`, P.dim);
  c.scanlines();
}

// 2. SEISMOGRAPH: the epoch as a moving chart tape. Each block is a column: its gas as a bar, its bloom compressed to a
//    heat strip, base fee as a trace. The cursor sits on the current block; the tape wraps, so the loop is seamless.
function seismograph(c, epoch, f) {
  const P = PHOSPHOR, n = epoch.length, colW = 6;
  c.fill([4, 4, 10]);
  const fees = epoch.map(e => int(e.baseFeePerGas)), lo = Math.min(...fees), hi = Math.max(...fees) || 1;
  for (let k = -11; k <= 11; k++) {
    const j = ((f + k) % n + n) % n, e = epoch[j], x = 64 + k * colW - colW / 2, now = k === 0;
    const bloom = bytes(e.logsBloom);
    for (let r = 0; r < 32; r++) {  // 2048 bits -> 32 rows of 64 bits; brightness = bits set
      let set = 0; for (let q = 0; q < 8; q++) set += popcount(bloom[r * 8 + q]);
      const heat = set / 64;
      c.rect(x, 18 + r, colW - 1, 1, mix([10, 10, 30], now ? P.cyan : [60, 90, 200], heat));
    }
    const g = fullness(e), h = Math.round(56 * Math.min(1, g / 0.3));
    c.rect(x, 108 - h, colW - 1, h, now ? P.amber : mix([40, 30, 90], P.magenta, g / 0.3));
    const fy = 102 - Math.round(40 * (int(e.baseFeePerGas) - lo) / (hi - lo || 1));
    c.rect(x, fy, colW, 1, P.white);
  }
  c.rect(61, 16, 1, 94, P.amber); c.rect(66, 16, 1, 94, P.amber);
  const b = epoch[f];
  c.text(2, 3, "EPOCH", [120, 120, 200]); c.text(26, 3, `#${int(epoch[0].number)}-${int(epoch[n - 1].number) % 1000}`, [120, 120, 200]);
  c.text(2, 113, `#${int(b.number)}`, P.amber); c.text(60, 113, `${b.txCount}TX`, P.cyan);
  c.text(2, 121, `0x${hex(b.hash).slice(0, 30)}`, [90, 90, 160]);
  c.scanlines(0.85);
}

// 3. HASHFALL: cipher rain. Each column streams one block's hash as glyphs; the rain's density follows the current
//    block's gas and its bloom decides which columns fire. Mid-loop the rain clears to reveal the block number.
function hashfall(c, epoch, f) {
  const P = PHOSPHOR, n = epoch.length, b = epoch[f], bloom = bytes(b.logsBloom), t = f / n;
  c.fill([0, 4, 2]);
  for (let col = 0; col < 32; col++) {
    const stream = hex(epoch[(col * 7) % n].hash), phase = noise(col) % 1000 / 1000, speed = 1 + noise(col, 1) % 3;
    const head = (((t * speed + phase) % 1) * 176) - 24, live = bit(bloom, col * 64 + (f % 64));
    for (let r = 0; r < 26; r++) {
      const y = head - r * 6; if (y < -6 || y > H) continue;
      const ch = stream[(r + col + (r === 0 ? f : 0)) % 64];
      const fade = 1 - r / 26, col3 = r === 0 ? P.white : mix([0, 4, 2], live ? P.green : P.mid, fade);
      c.text(col * 4, Math.round(y), ch, col3);
    }
  }
  // Reveal: a band clears in the middle of the loop and prints the block number large.
  const reveal = Math.max(0, 1 - Math.abs(t - 0.5) * 5);
  if (reveal > 0) {
    const label = `#${int(b.number)}`, w = label.length * 8;
    c.rect(0, 52, W, 24, mix([0, 4, 2], [0, 0, 0], reveal));
    c.text(Math.round((W - w) / 2), 56, label, mix(P.mid, P.glow, reveal), 2);
    c.text(Math.round((W - 68) / 2), 70, `${(fullness(b) * 100).toFixed(1)}% GAS ${b.txCount} TX`, mix(P.dim, P.amber, reveal));
  }
  c.scanlines(0.8);
}

// 4. ROOTS: the block as three keys. State, transaction and receipt roots, 256 bits each, drawn as 16x16 bit grids;
//    lines run from each key to the block hash; the parent hash links in from the left. Every frame is a new block,
//    so the keys flicker through the epoch like a cipher stream.
function roots(c, epoch, f) {
  const P = PHOSPHOR, b = epoch[f];
  c.fill([6, 2, 10]);
  const keys = [["STATE", b.stateRoot, P.cyan], ["TX", b.transactionsRoot, P.magenta], ["RCPT", b.receiptsRoot, P.amber]];
  keys.forEach(([label, root, colour], k) => {
    const data = bytes(root), x0 = 6 + k * 41, y0 = 26;
    c.rect(x0 - 2, y0 - 2, 36, 36, mix([6, 2, 10], colour, 0.15));
    for (let i = 0; i < 256; i++) {
      const on = bit(data, i), x = x0 + (i % 16) * 2, y = y0 + (i >> 4) * 2;
      c.rect(x, y, 2, 2, on ? colour : [18, 10, 26]);
    }
    c.text(x0 + 16 - label.length * 2, y0 + 36, label, colour);
    for (let y = y0 + 44; y < 90; y++) if ((y + f) % 4 < 2) c.put(x0 + 16, y, mix(colour, [6, 2, 10], 0.4));
  });
  c.rect(4, 90, 120, 1, [80, 60, 110]);
  c.text(2, 95, "HASH", P.white);
  c.text(22, 95, hex(b.hash).slice(0, 26), P.glow);
  c.text(22, 102, hex(b.hash).slice(26, 52), P.glow);
  c.text(2, 112, "PREV", [120, 100, 150]); c.text(22, 112, hex(b.parentHash).slice(0, 26), [120, 100, 150]);
  c.text(2, 3, `BLOCK #${int(b.number)}`, P.white);
  c.text(2, 11, `TS ${int(b.timestamp)}  BLOB ${int(b.blobGasUsed ?? "0x0")}`, [120, 100, 150]);
  c.scanlines(0.84);
}

// 5. ARMOR: the epoch as an ASCII-armored message, like a PGP block. Header fields stream past as base64-ish lines;
//    the current block's line decrypts in place. A nod to cypherpunk mailing lists.
function armor(c, epoch, f) {
  const P = PHOSPHOR, n = epoch.length, b = epoch[f];
  c.fill([8, 8, 6]);
  const ink = [210, 205, 180], faint = [90, 88, 70];
  c.text(2, 2, "-----BEGIN BASE BLOCKS-----", ink);
  c.text(2, 10, `EPOCH: ${int(epoch[0].number)}`, faint);
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/";
  for (let k = 0; k < 12; k++) {
    const j = ((f - 6 + k) % n + n) % n, e = epoch[j], y = 20 + k * 7, now = k === 6;
    const raw = hex(e.hash) + hex(e.transactionsRoot);
    let line = "";
    for (let i = 0; i < 31; i++) line += ALPHA[(parseInt(raw.slice(i * 2, i * 2 + 2), 16)) % ALPHA.length];
    if (now) {
      // Decrypt: the armored line resolves to the block's plain facts.
      c.rect(0, y - 1, W, 7, [40, 30, 8]);
      c.text(2, y, `#${int(e.number)} ${e.txCount}TX ${(fullness(e) * 100).toFixed(0)}%GAS`, P.amber);
    } else c.text(2, y, line, k < 6 ? faint : mix(ink, faint, (k - 6) / 6));
  }
  c.text(2, 108, `=${hex(b.hash).slice(0, 6).toUpperCase()}`, ink);
  c.text(2, 118, "-----END BASE BLOCKS-----", ink);
  c.scanlines(0.88);
}

export const CONCEPTS = [
  { id: "terminal", name: "TERMINAL", about: "A node console: the block's logs bloom as a 64x32 bit matrix, gas meter, and the epoch scrolling past as a ledger.", draw: terminal },
  { id: "seismograph", name: "SEISMOGRAPH", about: "The epoch as a moving chart tape: gas bars, bloom heat strips and a base-fee trace, cursor on the current block.", draw: seismograph },
  { id: "hashfall", name: "HASHFALL", about: "Cipher rain made of block hashes; the bloom decides which columns fire, and the rain clears mid-loop to reveal the block.", draw: hashfall },
  { id: "roots", name: "ROOTS", about: "Each block as three keys: state, transaction and receipt roots as 16x16 bit grids, linked to its hash and its parent.", draw: roots },
  { id: "armor", name: "ARMOR", about: "The epoch as an ASCII-armored PGP message; the current block's line decrypts in place.", draw: armor },
];

/** One frame of a concept as RGBA pixels (W x H). */
export function render(concept, epoch, frame) {
  const c = new Canvas();
  concept.draw(c, epoch, frame);
  return c.rgba;
}
