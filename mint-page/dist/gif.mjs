// Minimal GIF89a decoder for SolVideo's output: global palette, full-frame images, no interlace or local palettes.
// Shared by the page (animated favicon) and the server (preview cards).
export function decodeGif(gif) {
  const text = String.fromCharCode(...gif.subarray(0, 6));
  if (text !== "GIF89a") throw new Error("Not a GIF");
  const u16 = p => gif[p] | gif[p + 1] << 8;
  const width = u16(6), height = u16(8), packed = gif[10];
  const palette = gif.subarray(13, 13 + (packed & 0x80 ? 3 * (2 << (packed & 7)) : 0));
  const frames = [];
  let p = 13 + palette.length;
  while (p < gif.length) {
    const block = gif[p++];
    if (block === 0x21) { p++; while (gif[p]) p += gif[p] + 1; p++; continue; }
    if (block !== 0x2c) break;
    if (u16(p + 4) !== width || u16(p + 6) !== height || gif[p + 8] & 0xc0) throw new Error("Unsupported frame");
    p += 9;
    const minCode = gif[p++], parts = [];
    let size = 0;
    while (gif[p]) { parts.push(gif.subarray(p + 1, p + 1 + gif[p])); size += gif[p]; p += gif[p] + 1; }
    p++;
    const data = new Uint8Array(size);
    let o = 0;
    for (const part of parts) { data.set(part, o); o += part.length; }
    frames.push(lzw(data, minCode, width * height));
  }
  if (!frames.length) throw new Error("No frames");
  return { width, height, palette, frames };
}

function lzw(data, minCode, count) {
  const clear = 1 << minCode, end = clear + 1, out = new Uint8Array(count);
  let size, dict, prev, bit = 0, o = 0;
  const reset = () => { dict = Array.from({ length: clear }, (_, i) => [i]); dict[clear] = dict[end] = []; size = minCode + 1; prev = null; };
  reset();
  while (o < count && bit + size <= data.length * 8) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= (data[bit >> 3] >> (bit & 7) & 1) << i;
    if (code === clear) { reset(); continue; }
    if (code === end) break;
    const entry = code < dict.length ? dict[code] : [...prev, prev[0]];
    for (const v of entry) if (o < count) out[o++] = v;
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length === 1 << size && size < 12) size++;
  }
  return out;
}

/** RGBA pixels for one decoded frame. */
export function rgba({ width, height, palette, frames }, index) {
  const indices = frames[index], out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < indices.length; i++) {
    out[i * 4] = palette[indices[i] * 3]; out[i * 4 + 1] = palette[indices[i] * 3 + 1]; out[i * 4 + 2] = palette[indices[i] * 3 + 2]; out[i * 4 + 3] = 255;
  }
  return out;
}
