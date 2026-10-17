// Run the decoder scripts exactly as embedded in the onchain AVI and MPEG player pages, on the files embedded in
// them, and compare every frame with FFmpeg: AVI RGB exactly, MPEG Y/Cb/Cr exactly at every block.
// Usage: node scripts/validate_players.mjs <avi-player.html> <mpeg-player.html>
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function load(file) {
  const html = readFileSync(file, "utf8");
  const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const media = script.slice(script.indexOf('"') + 1, script.indexOf('";'));
  // Everything up to the shared player is the decoder; run it without the DOM.
  const decoder = script.slice(script.indexOf('";') + 2, script.indexOf("const video = decode("));
  const bytes = Uint8Array.from(Buffer.from(media, "base64"));
  return { bytes, video: new Function(decoder + "\nreturn decode;")()(bytes) };
}

function ffmpeg(bytes, extension, pixelFormat) {
  const dir = mkdtempSync(path.join(tmpdir(), "ghoulballs-player-"));
  try {
    const file = path.join(dir, "media." + extension);
    writeFileSync(file, bytes);
    return execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vsync", "0", "-f", "rawvideo", "-pix_fmt", pixelFormat, "-"], { maxBuffer: 1 << 28 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const [aviFile, mpegFile] = process.argv.slice(2);
const avi = load(aviFile);
const rgb = ffmpeg(avi.bytes, "avi", "rgb24");
const n = avi.video.width * avi.video.height;
if (avi.video.width !== 64 || avi.video.height !== 64 || avi.video.fps !== 25 || avi.video.frames.length !== 50) throw Error("AVI shape");
avi.video.frames.forEach((f, i) => {
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) if (f[p * 4 + c] !== rgb[(i * n + p) * 3 + c]) throw Error(`AVI frame ${i} pixel ${p}`);
});

const mpeg = load(mpegFile);
const yuv = ffmpeg(mpeg.bytes, "mpg", "yuv420p");
const { width: gw, yuv: frames } = mpeg.video;
if (gw !== 64 || mpeg.video.height !== 64 || mpeg.video.fps !== 25 || frames.length !== 50) throw Error("MPEG shape");
const W = gw * 8, stride = W * W * 3 / 2, cw = W / 2;
frames.forEach((f, i) => {
  const base = i * stride;
  // Every pixel of every 8x8 block must equal the block's decoded DC sample.
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (yuv[base + y * W + x] !== f.y[(y >> 3) * gw + (x >> 3)]) throw Error(`MPEG frame ${i} Y ${x},${y}`);
  for (let y = 0; y < cw; y++) for (let x = 0; x < cw; x++) {
    const mb = (y >> 3) * (gw >> 1) + (x >> 3);
    if (yuv[base + W * W + y * cw + x] !== f.u[mb] || yuv[base + W * W + cw * cw + y * cw + x] !== f.v[mb]) throw Error(`MPEG frame ${i} chroma ${x},${y}`);
  }
});
console.log(`players: AVI ${avi.bytes.length} bytes, 50 frames match FFmpeg RGB; MPEG ${mpeg.bytes.length} bytes, 50 frames match FFmpeg Y/Cb/Cr at every pixel`);
