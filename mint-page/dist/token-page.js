import { animateFavicon } from "./favicon.js";

// Token pages animate their tab icon with the token's own GIF (the gif icon link, /t/:id.gif).
const gif = document.querySelector('link[rel~="icon"][type="image/gif"]')?.href;
if (gif) fetch(gif).then(r => r.arrayBuffer()).then(b => animateFavicon(new Uint8Array(b))).catch(() => {});
