// Server-side token pages and preview cards. Link crawlers (X, Telegram, Discord) do not run JavaScript, so each
// token's page and its preview image are rendered here from the chain. Tokens never change, so both cache for good.
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodeGif } from "../dist/gif.mjs";

const config = JSON.parse(readFileSync(new URL("../dist/config.json", import.meta.url), "utf8"));
export const network = config.networks.find(n => n.chainId === config.defaultChainId);
const word = id => BigInt(id).toString(16).padStart(64, "0");

export function tokenId(value) {
  if (!/^[1-9]\d{0,4}$/.test(String(value ?? ""))) return null;
  const id = Number(value);
  return id <= 6667 ? id : null;
}

const RPCS = [...new Set([...(network.renderRpcUrls ?? []), network.renderRpcUrl, network.rpcUrl].filter(Boolean))];

// Each render RPC in turn (public RPCs rate-limit), twice; an unminted token fails at once.
async function call(data, gas = "0x1dcd6500", fetcher = fetch) {
  let last;
  for (let round = 0; round < 2; ++round) {
    if (round) await new Promise(resolve => setTimeout(resolve, 600));
    for (const url of RPCS) {
      try {
        const response = await fetcher(url, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: network.collectionAddress, data, gas }, "latest"] })
        });
        const body = await response.json();
        if (typeof body.result === "string" && !body.error) return body.result;
        last = Object.assign(new Error(body.error?.message ?? "RPC error"), { missing: /nonexistent|7e273289/i.test(JSON.stringify(body.error ?? "")) });
        if (last.missing) throw last;
      } catch (error) { if (error.missing) throw error; last = error; }
    }
  }
  throw last;
}

function bytes(hex) {
  const raw = Buffer.from(hex.slice(2), "hex");
  const offset = Number(BigInt("0x" + raw.subarray(0, 32).toString("hex")));
  const length = Number(BigInt("0x" + raw.subarray(offset, offset + 32).toString("hex")));
  return raw.subarray(offset + 32, offset + 32 + length);
}

// The first frame of a token's GIF, as palette indices (decoder shared with the page).
export function gifFrame(gif, wanted = 0) {
  const decoded = decodeGif(new Uint8Array(gif));
  if (wanted >= decoded.frames.length) throw new Error("Frame not found");
  return { width: decoded.width, height: decoded.height, palette: Buffer.from(decoded.palette), indices: decoded.frames[wanted] };
}

// 1200x630 card: the frame scaled 8x with hard pixels, centred on the page's dark background.
export function cardPng({ width, height, palette, indices }) {
  const W = 1200, H = 630, scale = 8, x0 = (W - width * scale) / 2, y0 = (H - height * scale) / 2;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    for (let x = 0; x < W; x++) {
      const sx = Math.floor((x - x0) / scale), sy = Math.floor((y - y0) / scale), o = row + 1 + x * 3;
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) palette.copy(raw, o, indices[sy * width + sx] * 3, indices[sy * width + sx] * 3 + 3);
      else { raw[o] = 7; raw[o + 1] = 7; raw[o + 2] = 8; }
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(W, 0); header.writeUInt32BE(H, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) c = CRC[(c ^ b) & 0xff] ^ c >>> 8;
  return (c ^ 0xffffffff) >>> 0;
}

export async function tokenGif(id, fetcher) {
  return bytes(await call("0x7492d87c" + word(id), "0x1dcd6500", fetcher));
}

/** True once all 6,667 tokens exist. */
export async function soldOut(fetcher) {
  return BigInt(await call("0x18160ddd", "0x186a0", fetcher)) >= 6667n;
}

export async function tokenMetadata(id, fetcher) {
  const uri = bytes(await call("0xc87b56dd" + word(id), "0x1dcd6500", fetcher)).toString("utf8");
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) throw new Error("Unexpected tokenURI");
  const metadata = JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
  if (!/^data:image\/svg\+xml,/.test(metadata.image)) throw new Error("Unexpected image");
  return metadata;
}

const escape = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const TAGLINE = "Fully onchain generative GIF";

export function tokenPage(id, metadata, origin, mintedOut = false) {
  const attributes = Object.fromEntries((metadata.attributes ?? []).map(a => [a.trait_type, a.value]));
  const count = attributes["Ball Count"];
  const traits = [count && `${count} ${count === 1 ? "BALL" : "BALLS"}`, attributes.Theme, attributes.Motion].filter(Boolean);
  const title = `ghoulballs #${id}`, description = `${TAGLINE}. Mint yours for free on Base.`;
  const card = `${origin}/t/${id}.png`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#070708">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${escape(`${origin}/t/${id}`)}">
  <meta property="og:image" content="${escape(card)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${escape(card)}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/t/${id}.gif" type="image/gif">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <script type="module" src="/token-page.js"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+10&family=Pixelify+Sans:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="top"><a class="wordmark" href="/">GHOULBALLS</a></header>
  <main>
    <section class="machine token-page" aria-label="${escape(title)}">
      <div class="screen"><img src="${escape(metadata.image)}" alt="${escape(title)}" width="512" height="512"><span class="scanlines" aria-hidden="true"></span></div>
      <div class="controls">
        <p class="tagline">${escape(TAGLINE)}</p>
        <p class="counter">#${id}</p>
        <div class="trait-row token-traits">${traits.map(t => `<span>${escape(String(t).toUpperCase())}</span>`).join("")}</div>
        ${mintedOut ? '<span class="mint-button mint-link minted-out" aria-disabled="true">MINTED OUT</span>' : '<a class="mint-button mint-link" href="/">MINT YOURS</a>'}
        <p class="availability"><span>FREE · 1 PER ADDRESS</span></p>
        <a class="chip-button download-gif" href="/t/${id}.gif" download="ghoulballs-${id}.gif">DOWNLOAD GIF ↓</a>
      </div>
    </section>
  </main>
  <footer class="bottom"><a href="${escape(`${network.explorerUrl}/token/${network.collectionAddress}?a=${id}`)}" target="_blank" rel="noopener noreferrer">TOKEN ↗</a><a href="https://github.com/ColinPlatt/sol_vid" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></footer>
</body>
</html>
`;
}

export const originOf = req => `https://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
export const FOREVER = "public, max-age=3600, s-maxage=31536000, immutable";
// Token pages show the mint button, which flips to MINTED OUT at 6,667: until then they refresh every 10 minutes.
export const UNTIL_MINTED_OUT = "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";
