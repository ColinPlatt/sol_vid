import { shortAddress, rpc } from "./wallet.mjs";
import { TOTAL_SUPPLY, RENDER_GAS, tokenURICall, ownerOfCall, gifCall, aviCall, mpegCall, galleryCollections, decodeBytes, parseTokenURI, decodeAddress, bytesToBase64 } from "./gallery.mjs";

const $ = id => document.getElementById(id);
const PAGE = 24;
const CONCURRENCY = 3;
const queue = [];
let active = 0;
let generation = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Full tokenURI reads are expensive for the RPC, so a few run at a time.
function schedule(job) {
  queue.push(job);
  pump();
}
function pump() {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift();
    ++active;
    job().finally(() => { --active; pump(); });
  }
}

// The token's image exactly as its tokenURI returns it, falling back to the cheaper raw gif() read.
export async function tokenImage(network, address, id) {
  const renderNetwork = { ...network, rpcUrl: network.renderRpcUrl ?? network.rpcUrl };
  try {
    const result = await rpc(renderNetwork, "eth_call", [{ to: address, data: tokenURICall(id), gas: RENDER_GAS }, "latest"], (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }));
    return parseTokenURI(new TextDecoder().decode(decodeBytes(result)));
  } catch {
    const gif = decodeBytes(await rpc(network, "eth_call", [{ to: address, data: gifCall(id), gas: "0x2faf080" }, "latest"]));
    return { name: `ghoulballs #${id}`, image: "data:image/gif;base64," + bytesToBase64(gif), animation: null, attributes: {} };
  }
}

async function loadToken(network, collection, id, card, run) {
  const media = card.querySelector(".token-media");
  const caption = card.querySelector("figcaption");
  const [owner, token] = await Promise.allSettled([
    rpc(network, "eth_call", [{ to: collection.address, data: ownerOfCall(id), gas: "0x186a0" }, "latest"]),
    tokenImage(network, collection.address, id)
  ]);
  if (run !== generation) return;
  if (owner.status === "fulfilled") {
    const a = el("a", "", shortAddress(decodeAddress(owner.value)));
    a.href = `${network.explorerUrl}/token/${collection.address}?a=${id}`;
    a.target = "_blank"; a.rel = "noopener noreferrer";
    caption.append(a);
  }
  if (token.status === "rejected") { media.replaceChildren(el("span", "token-error", "UNREADABLE")); return; }
  const { image, attributes } = token.value;
  const img = el("img");
  img.src = image; img.alt = token.value.name; img.width = 256; img.height = 256;
  media.replaceChildren(img);
  const traits = el("div", "trait-row");
  const count = attributes["Ball Count"];
  for (const value of [count && `${count} ${count === 1 ? "BALL" : "BALLS"}`, attributes.Theme, attributes.Motion]) if (value) traits.append(el("span", "", String(value).toUpperCase()));
  if (traits.childElementCount) caption.append(traits);
  caption.append(collection.tokensPerMint === 3 ? players(network, collection.address, id, media, img) : downloads(network, collection.address, id));
}

// A set's three tokens: the GIF, and the AVI and MPEG tokens' own onchain players (their animation_url pages).
function players(network, address, first, media, gifImage) {
  const row = el("div", "download-row");
  const buttons = ["GIF", "AVI", "MPG"].map((label, offset) => {
    const button = el("button", "", label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(offset === 0));
    button.addEventListener("click", async () => {
      for (const b of buttons) b.setAttribute("aria-pressed", String(b === button));
      if (!offset) { media.replaceChildren(gifImage); return; }
      media.replaceChildren(el("span", "token-loading", "●"));
      try {
        const token = await tokenImage(network, address, first + offset);
        if (button.getAttribute("aria-pressed") !== "true") return;
        if (!token.animation) throw new Error("No player");
        const frame = el("iframe");
        frame.title = token.name;
        frame.setAttribute("sandbox", "allow-scripts");
        frame.addEventListener("load", () => frame.contentWindow.postMessage(token.animation, "*"), { once: true });
        frame.src = "player.html";
        frame.dataset.animation = token.animation.slice(0, 64);
        media.replaceChildren(frame);
      } catch { if (button.getAttribute("aria-pressed") === "true") media.replaceChildren(el("span", "token-error", "UNREADABLE")); }
    });
    row.append(button);
    return button;
  });
  return row;
}

// Raw media straight from the contract, read only when asked for.
const FORMATS = [["GIF", gifCall, "image/gif", "gif"], ["AVI", aviCall, "video/x-msvideo", "avi"], ["MPG", mpegCall, "video/mpeg", "mpg"]];
function downloads(network, address, id) {
  const row = el("div", "download-row");
  const renderNetwork = { ...network, rpcUrl: network.renderRpcUrl ?? network.rpcUrl };
  for (const [label, call, type, extension] of FORMATS) {
    const button = el("button", "", label + " ↓");
    button.type = "button";
    button.addEventListener("click", async () => {
      button.disabled = true; button.textContent = label + " …";
      try {
        const bytes = decodeBytes(await rpc(renderNetwork, "eth_call", [{ to: address, data: call(id), gas: RENDER_GAS }, "latest"], (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) })));
        const a = el("a");
        a.href = URL.createObjectURL(new Blob([bytes], { type }));
        a.download = `ghoulballs-${address.slice(2, 8)}-${id}.${extension}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        button.textContent = label + " ↓";
      } catch { button.textContent = label + " ×"; }
      finally { button.disabled = false; }
    });
    row.append(button);
  }
  return row;
}

function tokenCard(network, collection, id, run, observer) {
  const card = el("figure", "token-card");
  const media = el("div", "token-media");
  media.append(el("span", "token-loading", "●"));
  const caption = el("figcaption");
  caption.append(el("strong", "", `#${collection.tokensPerMint === 3 ? (id + 2) / 3 : id}`));
  card.append(media, caption);
  card.load = () => schedule(() => loadToken(network, collection, id, card, run));
  observer.observe(card);
  return card;
}

// Every token from every collection deployed on the network, read from chain: one list, newest first.
export async function showGallery(network) {
  const run = ++generation;
  queue.length = 0;
  const container = $("gallery-versions");
  container.replaceChildren();
  $("gallery-status-text").textContent = "";
  const collections = galleryCollections(network);
  if (!collections.length) return;
  const supplies = await Promise.allSettled(collections.map(c => rpc(network, "eth_call", [{ to: c.address, data: TOTAL_SUPPLY, gas: "0x186a0" }, "latest"])));
  if (run !== generation) return;
  const tokens = [];
  collections.forEach((collection, i) => {
    if (supplies[i].status !== "fulfilled") return;
    // A set collection lists one card per set, keyed by its first (GIF) token.
    const per = collection.tokensPerMint === 3 ? 3 : 1;
    for (let id = Number(BigInt(supplies[i].value)) - per + 1; id > 0; id -= per) tokens.push([collection, id]);
  });
  if (supplies.some(r => r.status === "rejected")) $("gallery-status-text").textContent = "SOME READS FAILED";
  if (!tokens.length) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); entry.target.load(); }
  }, { rootMargin: "400px" });
  const grid = el("div", "token-grid");
  const more = el("button", "chip-button gallery-more", "MORE");
  more.type = "button";
  let shown = 0;
  const showMore = () => {
    for (const [collection, id] of tokens.slice(shown, shown + PAGE)) grid.append(tokenCard(network, collection, id, run, observer));
    shown = Math.min(tokens.length, shown + PAGE);
    more.hidden = shown >= tokens.length;
  };
  more.addEventListener("click", showMore);
  container.append(grid, more);
  showMore();
}
