// AVI decoder for SolVideo's output: RIFF, one video stream, uncompressed 8-bit indexed DIB frames.
function decode(d) {
  const u32 = p => d[p] | d[p + 1] << 8 | d[p + 2] << 16 | d[p + 3] << 24;
  const tag = p => String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]);
  if (tag(0) != "RIFF" || tag(8) != "AVI ") throw Error("not AVI");
  let usec = 40000, w = 0, h = 0, bottomUp = true, palette = [];
  const frames = [];
  const walk = (start, end) => {
    for (let p = start; p + 8 <= end;) {
      const id = tag(p), size = u32(p + 4) >>> 0, body = p + 8;
      if (id == "LIST") walk(body + 4, body + size);
      else if (id == "avih") usec = u32(body);
      else if (id == "strf") {
        w = u32(body + 4); h = u32(body + 8);
        if (h < 0) { h = -h; bottomUp = false; }
        if ((d[body + 14] | d[body + 15] << 8) != 8) throw Error("not 8-bit");
        const colours = u32(body + 32) || 256;
        for (let i = 0; i < colours; i++) { const q = body + 40 + 4 * i; palette.push([d[q + 2], d[q + 1], d[q]]); }
      } else if (/^\d\dd[bc]$/.test(id)) {
        const stride = w + 3 & ~3, rgba = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
          const row = body + (bottomUp ? h - 1 - y : y) * stride;
          for (let x = 0; x < w; x++) {
            const c = palette[d[row + x]], o = (y * w + x) * 4;
            rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
          }
        }
        frames.push(rgba);
      }
      p = body + size + (size & 1);
    }
  };
  walk(12, d.length);
  return { width: w, height: h, fps: 1e6 / usec, frames };
}
