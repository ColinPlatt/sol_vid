// Shared pieces for the camera-move scenes (descent, monorail, spire): block facts, the neon palette, depth fog,
// rain, the block hologram and the vignette. Plain canvas JS concepts, not onchain code.
export const TAU = Math.PI * 2;
export const hex = h => h.replace(/^0x/, "");
export const int = h => Number(BigInt(h));
export const bytes = h => Uint8Array.from(hex(h).match(/../g), b => parseInt(b, 16));
export const bit = (d, i) => d[(i >> 3) % d.length] >> (7 - (i & 7)) & 1;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = x => x * x * (3 - 2 * x);
export const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const rgb = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
export const wrap = (x, m) => ((x % m) + m) % m;

export const NEON = [[255, 46, 136], [0, 229, 255], [177, 76, 255], [255, 176, 0], [57, 255, 136], [255, 77, 77]];
export const WORDS = ["電脳", "暗号", "鍵", "署名", "検証", "連鎖", "量子", "未来", "都市", "零", "壱", "夜市", "光速", "記録", "ベース"];
/** Small English glosses shown under the Japanese, with less emphasis. */
export const WORDS_EN = { 電脳: "CYBER", 暗号: "CIPHER", 鍵: "KEY", 署名: "SIGNATURE", 検証: "VERIFY", 連鎖: "CHAIN", 量子: "QUANTUM",
  未来: "FUTURE", 都市: "CITY", 零: "ZERO", 壱: "ONE", 夜市: "NIGHT MARKET", 光速: "LIGHTSPEED", 記録: "RECORD", ベース: "BASE", 夜: "NIGHT", 雨: "RAIN", 光: "LIGHT" };
export const facts = blk => `${blk.tx} TX · ${(blk.gas * 100).toFixed(1)}% GAS`;
export const FONT = '900 10px "Noto Sans JP"', DOT = '400 10px "DotGothic16"', LATIN = '700 10px "Orbitron"';
export const font = (base, px) => base.replace("10px", `${Math.max(1, px)}px`);

/** What every scene reads from a block header. */
export function block(b, i) {
  const hash = bytes(b.hash);
  return { i, n: int(b.number), hash, bloom: bytes(b.logsBloom), state: bytes(b.stateRoot), gas: int(b.gasUsed) / int(b.gasLimit),
    tx: b.txCount ?? 0, colour: NEON[hash[3] % NEON.length], word: WORDS[hash[5] % WORDS.length], wordEn: WORDS_EN[WORDS[hash[5] % WORDS.length]], hex: hex(b.hash) };
}

/** Stacked vertical neon characters, the signature sign of the series. */
export function verticalSign(ctx, word, x, y, size, colour, alpha = 1, plate = true, english = WORDS_EN[word]) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (plate) { ctx.fillStyle = "rgba(8,4,16,0.9)"; ctx.fillRect(x - size * 0.62, y - size * 0.7, size * 1.24, size * (word.length * 1.08 + 0.5)); }
  ctx.font = font(FONT, size); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = rgb(colour); ctx.shadowBlur = size * 0.9;
  // Vertical writing turns the long-vowel mark ー upright.
  [...word].forEach((ch, k) => {
    ctx.save(); ctx.translate(x, y + k * size * 1.08); if (ch === "ー") ctx.rotate(Math.PI / 2);
    ctx.fillStyle = rgb(colour); ctx.fillText(ch, 0, 0); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText(ch, 0, 0); ctx.restore();
  });
  // The English gloss: small and dim, under the plate.
  if (english && size >= 6) {
    ctx.shadowBlur = 0; ctx.font = font(LATIN, size * 0.24); ctx.fillStyle = rgb(mixRGB(colour, [255, 255, 255], 0.3), 0.55);
    ctx.fillText(english, x, y + word.length * size * 1.08 + size * 0.05);
  }
  ctx.restore();
}

/** The block hologram: ベース・ブロック (Base block), number and facts, crossfading from block a to block b by `mix`. */
export function hologram(ctx, a, b, mix, x, y, scale, t) {
  for (const [blk, alpha] of [[a, 1 - mix], [b, mix]]) {
    if (alpha < 0.02) continue;
    const c = blk.colour;
    ctx.save(); ctx.globalAlpha = alpha * 0.88; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = rgb(c); ctx.shadowBlur = 22 * scale;
    ctx.font = font(FONT, 32 * scale); ctx.fillStyle = rgb(c); ctx.fillText("ベース・ブロック", x, y - 29 * scale);
    ctx.save(); ctx.shadowBlur = 0; ctx.font = font(LATIN, 10 * scale); ctx.fillStyle = rgb(mixRGB(c, [255, 255, 255], 0.3), 0.5); ctx.fillText("BASE · BLOCK", x, y - 52 * scale); ctx.restore();
    ctx.font = font(LATIN, 37 * scale); ctx.fillStyle = "rgba(240,250,255,0.95)"; ctx.fillText(`#${blk.n.toLocaleString("en")}`, x, y + 13 * scale);
    ctx.font = font(DOT, 19 * scale); ctx.fillStyle = rgb(mixRGB(c, [255, 255, 255], 0.4)); ctx.fillText(`取引 ${blk.tx}件 · ガス ${(blk.gas * 100).toFixed(1)}%`, x, y + 48 * scale);
    ctx.save(); ctx.shadowBlur = 0; ctx.font = font(LATIN, 10 * scale); ctx.fillStyle = rgb(mixRGB(c, [255, 255, 255], 0.3), 0.5); ctx.fillText(facts(blk), x, y + 68 * scale); ctx.restore();
    ctx.globalAlpha = alpha * 0.22; ctx.shadowBlur = 0; ctx.fillStyle = rgb(c);
    for (let yy = y - 58 * scale; yy < y + 74 * scale; yy += 3) ctx.fillRect(x - 140 * scale, yy + ((t * 300) % 3), 280 * scale, 1);
    ctx.restore();
  }
}

/** Rain streaks; integer speeds per loop keep it seamless. `slant` tilts them, `fall` 1 = down the screen. */
export function rain(ctx, epoch, t, count, { slant = 0.15, colour = "rgba(190,210,255,0.22)" } = {}) {
  const S = ctx.canvas.width, n = epoch.length;
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 1;
  for (let k = 0; k < count; k++) {
    const h = bytes(epoch[k % n].hash), x = (h[k % 32] * 7 + k * 13) % S, len = 8 + h[(k + 3) % 32] % 14, speed = 2 + (k % 3);
    const y = ((h[(k + 7) % 32] / 255 + t * speed) % 1) * (S + len) - len;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len); ctx.stroke();
  }
  ctx.restore();
}

export function vignette(ctx, strength = 0.55) {
  const S = ctx.canvas.width, v = ctx.createRadialGradient(S / 2, S * 0.45, S * 0.3, S / 2, S * 0.5, S * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${strength})`); ctx.fillStyle = v; ctx.fillRect(0, 0, S, S);
}

/** The block whose turn it is at loop position `pos` (in blocks), and the crossfade to the next one. */
export function turn(blocks, pos, fadeFrom = 0.7) {
  const n = blocks.length, i0 = Math.floor(wrap(pos, n)), i1 = (i0 + 1) % n;
  return [blocks[i0], blocks[i1], smooth(clamp((wrap(pos, 1) - fadeFrom) / (1 - fadeFrom), 0, 1))];
}
