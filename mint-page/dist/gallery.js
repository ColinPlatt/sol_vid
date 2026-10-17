import { shortAddress, rpc } from "./wallet.mjs";
import { TOTAL_SUPPLY, RENDER_GAS, tokenURICall, ownerOfCall, gifCall, galleryCollections, decodeBytes, parseTokenURI, decodeAddress, bytesToBase64 } from "./gallery.mjs";

const $ = id => document.getElementById(id);
const PAGE = 24;
const CONCURRENCY = 3;
const queue = [];
let active = 0;
let generation = 0;
const format = value => new Intl.NumberFormat().format(value);

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
  const { image, attributes, animation } = token.value;
  const img = el("img");
  img.src = image; img.alt = `ghoulballs #${id}`; img.width = 256; img.height = 256;
  media.replaceChildren(img);
  const traits = el("div", "trait-row");
  const count = attributes["Ball Count"];
  for (const value of [count && `${count} ${count === 1 ? "BALL" : "BALLS"}`, attributes.Theme, attributes.Motion]) if (value) traits.append(el("span", "", String(value).toUpperCase()));
  if (traits.childElementCount) caption.append(traits);
  if (animation) {
    const link = el("a", "", "MPG ↓");
    link.href = animation; link.download = `ghoulballs-v${collection.version}-${id}.mpg`;
    caption.append(link);
  }
}

function tokenCard(network, collection, id, run, observer) {
  const card = el("figure", "token-card");
  const media = el("div", "token-media");
  media.append(el("span", "token-loading", "●"));
  const caption = el("figcaption");
  caption.append(el("strong", "", `#${id}`));
  card.append(media, caption);
  card.load = () => schedule(() => loadToken(network, collection, id, card, run));
  observer.observe(card);
  return card;
}

async function renderVersion(network, collection, run, observer, container) {
  const section = el("section", "gallery-version");
  const head = el("div", "version-head");
  const link = el("a", "", shortAddress(collection.address) + " ↗");
  link.href = `${network.explorerUrl}/address/${collection.address}`; link.target = "_blank"; link.rel = "noopener noreferrer";
  const count = el("span", "version-count", "…");
  head.append(el("h2", "", `V${collection.version}`), count, link);
  const grid = el("div", "token-grid");
  section.append(head, grid);
  container.append(section);
  const supply = Number(BigInt(await rpc(network, "eth_call", [{ to: collection.address, data: TOTAL_SUPPLY, gas: "0x186a0" }, "latest"])));
  if (run !== generation) return 0;
  count.textContent = format(supply);
  if (!supply) { grid.replaceWith(el("p", "gallery-empty", "NONE YET")); return 0; }
  // Newest first.
  let next = supply;
  const more = el("button", "chip-button gallery-more", "MORE");
  more.type = "button";
  const showMore = () => {
    const end = Math.max(0, next - PAGE);
    for (let id = next; id > end; --id) grid.append(tokenCard(network, collection, id, run, observer));
    next = end;
    more.hidden = next === 0;
  };
  more.addEventListener("click", showMore);
  section.append(more);
  showMore();
  return supply;
}

// Every token from every collection version on the network, read from chain.
export async function showGallery(network) {
  const run = ++generation;
  queue.length = 0;
  const container = $("gallery-versions");
  container.replaceChildren();
  $("gallery-status-text").textContent = "";
  const collections = galleryCollections(network);
  if (!collections.length) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); entry.target.load(); }
  }, { rootMargin: "400px" });
  const results = await Promise.allSettled(collections.map(c => renderVersion(network, c, run, observer, container)));
  if (run !== generation) return;
  $("gallery-status-text").textContent = results.some(r => r.status === "rejected") ? "SOME READS FAILED" : "";
}
