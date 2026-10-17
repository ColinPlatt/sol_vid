import { decodeGif, rgba } from "./gif.mjs";

// Animated tab icon, as in numerate_www's live favicon: the GIF's frames are drawn once to a 64x64 canvas and swapped
// into a PNG <link> at the GIF's 10fps. Chrome, Edge and Firefox follow the changes; Safari keeps the static icon.
let link, timer;
export function animateFavicon(gifBytes) {
  try {
    const gif = decodeGif(gifBytes);
    const canvas = document.createElement("canvas");
    canvas.width = gif.width; canvas.height = gif.height;
    const context = canvas.getContext("2d");
    const frames = gif.frames.map((_, i) => { context.putImageData(new ImageData(rgba(gif, i), gif.width, gif.height), 0, 0); return canvas.toDataURL("image/png"); });
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon"; link.type = "image/png"; link.setAttribute("sizes", "any");
      document.head.appendChild(link);
    }
    clearInterval(timer);
    let i = 0;
    link.href = frames[0];
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => { link.href = frames[i = (i + 1) % frames.length]; }, 100);
  } catch { /* The static icon stays. */ }
}

/** The GIF inside an image URL: a data:image/gif, or the pixelated SVG wrapper around one, or a same-site .gif. */
export async function gifFromImage(src) {
  const svg = /^data:image\/svg\+xml,/.test(src) ? decodeURIComponent(src.slice(19)) : null;
  const inner = svg ? svg.match(/href='(data:image\/gif;base64,[^']+)'/)?.[1] : src;
  if (inner?.startsWith("data:image/gif;base64,")) return Uint8Array.from(atob(inner.slice(22)), c => c.charCodeAt(0));
  return new Uint8Array(await (await fetch(inner)).arrayBuffer());
}
