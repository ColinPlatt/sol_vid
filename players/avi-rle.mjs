// Decoder for the project's single-stream, 8-bit BI_RGB/BI_RLE8 AVI subset.
export function decodeAVI(d) {
  const fail = () => { throw Error('Invalid or unsupported AVI'); };
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const u32 = p => { if (p + 4 > d.length) fail(); return view.getUint32(p, true); };
  const tag = p => String.fromCharCode(...d.subarray(p, p + 4));
  if (d.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'AVI ' || u32(4) + 8 !== d.length) fail();
  let w = 0, h = 0, compression = -1, palette, fps = 25;
  const frames = [];
  function frame(body, size) {
    if (!palette || frames.length >= 50) fail();
    const indices = new Uint8Array(w * h);
    if (compression === 0) {
      const stride = (w + 3) & ~3;
      if (size !== stride * h) fail();
      for (let y = 0; y < h; ++y) indices.set(d.subarray(body + y * stride, body + y * stride + w), y * w);
    } else {
      let p = body, x = 0, y = 0, ended = false;
      const end = body + size;
      const take = () => { if (p >= end) fail(); return d[p++]; };
      const put = c => { if (x >= w || y >= h || c >= palette.length) fail(); indices[y * w + x++] = c; };
      while (p < end && !ended) {
        const count = take(), value = take();
        if (count) { for (let i = 0; i < count; ++i) put(value); }
        else if (value === 0) { if (x !== w) fail(); x = 0; ++y; }
        else if (value === 1) { ended = true; }
        else if (value === 2) { x += take(); y += take(); if (x > w || y >= h) fail(); }
        else { for (let i = 0; i < value; ++i) put(take()); if (value & 1) take(); }
      }
      if (!ended || p !== end || y !== h) fail();
    }
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; ++y) for (let x = 0; x < w; ++x) {
      const c = palette[indices[(h - 1 - y) * w + x]];
      if (!c) fail(); rgba.set(c, (y * w + x) * 4);
    }
    frames.push(rgba);
  }
  function walk(start, end, depth = 0) {
    if (depth > 3) fail();
    let p = start;
    while (p < end) {
      if (p + 8 > end) fail();
      const id = tag(p), size = u32(p + 4), body = p + 8, next = body + size + (size & 1);
      if (next > end) fail();
      if (id === 'LIST') { if (size < 4) fail(); walk(body + 4, body + size, depth + 1); }
      else if (id === 'avih') { if (size < 56 || !u32(body)) fail(); fps = 1e6 / u32(body); }
      else if (id === 'strf') {
        if (size < 40 || u32(body) !== 40) fail();
        w = u32(body + 4); h = u32(body + 8); compression = u32(body + 16);
        const colours = u32(body + 32) || 256;
        if (![64, 256, 512].includes(w) || h !== w || view.getUint16(body + 14, true) !== 8 || ![0, 1].includes(compression) || colours > 256 || size < 40 + colours * 4) fail();
        palette = Array.from({ length: colours }, (_, i) => [d[body + 42 + 4 * i], d[body + 41 + 4 * i], d[body + 40 + 4 * i], 255]);
      } else if (/^\d\dd[bc]$/.test(id)) frame(body, size);
      p = next;
    }
  }
  walk(12, d.length);
  if (!frames.length || !Number.isFinite(fps) || fps <= 0) fail();
  return { width: w, height: h, fps, frames };
}
