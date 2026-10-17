// MPEG-1 decoder for MpegVideo's output: system or elementary stream, I pictures only, DC-only blocks.
// Every 8x8 block is flat, so each block decodes to one sample: luma on a (w/8)x(h/8) grid and chroma
// per 16x16 macroblock. AC coefficients are not supported; a block must end right after its DC term.
function decode(d) {
  // Collect the video elementary stream from 0xE0 PES packets, or take the input as-is if it is one.
  let es = d;
  if (d[3] == 0xba) {
    const parts = [];
    for (let p = 0; p + 4 <= d.length;) {
      if (d[p] || d[p + 1] || d[p + 2] != 1) { p++; continue; }
      const code = d[p + 3];
      if (code == 0xba) { p += 12; continue; }
      if (code == 0xb9) break;
      const end = p + 6 + (d[p + 4] << 8 | d[p + 5]);
      let q = p + 6;
      if (code == 0xe0) {
        while (d[q] == 0xff) q++;
        if ((d[q] & 0xc0) == 0x40) q += 2;
        q += (d[q] & 0xf0) == 0x20 ? 5 : (d[q] & 0xf0) == 0x30 ? 10 : 1;
        parts.push(d.subarray(q, end));
      }
      p = end;
    }
    es = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of parts) { es.set(a, o); o += a.length; }
  }
  let pos = 0;
  const bit = () => es[pos >> 3] >> 7 - (pos++ & 7) & 1;
  const bits = n => { let v = 0; while (n--) v = v << 1 | bit(); return v; };
  const align = () => { pos = pos + 7 & ~7; };
  const next = () => { align(); while (pos + 32 <= es.length * 8 && (es[pos >> 3] || es[(pos >> 3) + 1] || es[(pos >> 3) + 2] != 1)) pos += 8; return pos + 32 <= es.length * 8 ? es[(pos >> 3) + 3] : -1; };
  const lumaSize = () => { if (!bit()) return bit() + 1; if (!bit()) return bit() ? 3 : 0; let s = 4; while (bit()) s++; return s; };
  const chromaSize = () => { if (!bit()) return bit(); if (!bit()) return 2; let s = 3; while (bit()) s++; return s; };
  const diff = s => { if (!s) return 0; const v = bits(s); return v < 1 << s - 1 ? v - (1 << s) + 1 : v; };
  const rates = [0, 24000 / 1001, 24, 25, 30000 / 1001, 30, 50, 60000 / 1001, 60];
  let w = 0, h = 0, fps = 25;
  const frames = [];
  for (let code; (code = next()) >= 0;) {
    pos += 32;
    if (code == 0xb3) {
      w = bits(12); h = bits(12); bits(4); fps = rates[bits(4)]; bits(30);
      if (bit()) pos += 512;
      if (bit()) pos += 512;
    } else if (code == 0x00) {
      bits(10);
      if (bits(3) != 1) throw Error("only I pictures");
      bits(16);
      while (bit()) bits(8);
      const mbw = w + 15 >> 4, mbh = h + 15 >> 4;
      const frame = { y: new Uint8Array(mbw * mbh * 4), u: new Uint8Array(mbw * mbh), v: new Uint8Array(mbw * mbh) };
      for (let c; (c = next()) >= 0x01 && c <= 0xaf;) {
        pos += 32;
        const row = c - 1;
        bits(5);
        while (bit()) bits(8);
        let py = 128, pu = 128, pv = 128, col = -1;
        while (col < mbw - 1) {
          if (!bit()) throw Error("unsupported macroblock address");
          col++;
          if (!bit()) { if (!bit()) throw Error("unsupported macroblock type"); bits(5); }
          const mb = row * mbw + col;
          for (let b = 0; b < 4; b++) {
            py += diff(lumaSize());
            frame.y[(row * 2 + (b >> 1)) * mbw * 2 + col * 2 + (b & 1)] = py;
            if (bits(2) != 2) throw Error("AC coefficients");
          }
          pu += diff(chromaSize()); frame.u[mb] = pu; if (bits(2) != 2) throw Error("AC coefficients");
          pv += diff(chromaSize()); frame.v[mb] = pv; if (bits(2) != 2) throw Error("AC coefficients");
        }
      }
      frames.push(frame);
    } else if (code == 0xb7) break;
  }
  // BT.601 limited-range YCbCr to RGB, one sample per 8x8 block.
  const gw = w >> 3, gh = h >> 3, mbw = w + 15 >> 4;
  const clamp = x => x < 0 ? 0 : x > 255 ? 255 : Math.round(x);
  return {
    width: gw, height: gh, fps, yuv: frames,
    frames: frames.map(f => {
      const rgba = new Uint8ClampedArray(gw * gh * 4);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const l = 1.164 * (f.y[y * gw + x] - 16), mb = (y >> 1) * mbw + (x >> 1), cb = f.u[mb] - 128, cr = f.v[mb] - 128, o = (y * gw + x) * 4;
        rgba[o] = clamp(l + 1.596 * cr); rgba[o + 1] = clamp(l - 0.392 * cb - 0.813 * cr); rgba[o + 2] = clamp(l + 2.017 * cb); rgba[o + 3] = 255;
      }
      return rgba;
    })
  };
}
