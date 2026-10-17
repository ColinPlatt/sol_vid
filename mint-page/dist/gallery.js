import { validateConfig, shortAddress, rpc } from "./wallet.mjs";
import { TOTAL_SUPPLY, RENDER_GAS, tokenURICall, ownerOfCall, gifCall, galleryCollections, decodeBytes, parseTokenURI, decodeAddress, bytesToBase64 } from "./gallery.mjs";

const $ = id => document.getElementById(id);
const PAGE = 24;
const CONCURRENCY = 3;
const queue = [];
let active = 0;
let generation = 0;
let config;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStatus(text, open = false) {
  $("gallery-status-text").textContent = text;
  $("gallery-status").classList.toggle("open", open);
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

async function loadToken(network, collection, id, card, run) {
  const media = card.querySelector(".token-media");
  const caption = card.querySelector("figcaption");
  const renderNetwork = { ...network, rpcUrl: network.renderRpcUrl ?? network.rpcUrl };
  const [owner] = await Promise.allSettled([rpc(network, "eth_call", [{ to: collection.address, data: ownerOfCall(id), gas: "0x186a0" }, "latest"])]);
  if (run !== generation) return;
  if (owner.status === "fulfilled") {
    const a = el("a", "token-owner", "Owner " + shortAddress(decodeAddress(owner.value)));
    a.href = `${network.explorerUrl}/token/${collection.address}?a=${id}`;
    a.target = "_blank"; a.rel = "noopener noreferrer";
    caption.append(a);
  }
  try {
    const uri = new TextDecoder().decode(decodeBytes(await rpc(renderNetwork, "eth_call", [{ to: collection.address, data: tokenURICall(id), gas: RENDER_GAS }, "latest"], (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }))));
    if (run !== generation) return;
    const token = parseTokenURI(uri);
    const img = el("img");
    img.src = token.image; img.alt = `${token.name}: ${token.attributes["Ball Count"] ?? "?"} balls, ${token.attributes.Theme ?? ""} ${token.attributes.Motion ?? ""}`.trim();
    img.width = 256; img.height = 256;
    media.replaceChildren(img);
    caption.querySelector("strong").textContent = token.name;
    const traits = [token.attributes["Ball Count"] && `${token.attributes["Ball Count"]} ${token.attributes["Ball Count"] === 1 ? "ball" : "balls"}`, token.attributes.Theme, token.attributes.Motion].filter(Boolean);
    caption.insertBefore(el("span", "", traits.join(" · ")), caption.querySelector(".token-owner"));
    if (token.animation) {
      const link = el("a", "token-download", "MPEG-1 ↓");
      link.href = token.animation; link.download = `ghoulballs-v${collection.version}-${id}.mpg`;
      caption.append(link);
    }
  } catch {
    // The full metadata needs a high eth_call gas cap; fall back to the contract's cheaper raw GIF read.
    try {
      const gif = decodeBytes(await rpc(network, "eth_call", [{ to: collection.address, data: gifCall(id), gas: "0x2faf080" }, "latest"]));
      if (run !== generation) return;
      const img = el("img");
      img.src = "data:image/gif;base64," + bytesToBase64(gif); img.alt = `ghoulballs #${id}`; img.width = 256; img.height = 256;
      media.replaceChildren(img);
      caption.insertBefore(el("span", "", "GIF only: tokenURI read failed"), caption.querySelector(".token-owner"));
    } catch {
      if (run !== generation) return;
      media.replaceChildren(el("span", "token-error", "Couldn’t read this token. Try again later."));
    }
  }
}

function tokenCard(network, collection, id, run, observer) {
  const card = el("figure", "token-card");
  const media = el("div", "token-media");
  media.append(el("span", "token-loading", `#${id}`));
  const caption = el("figcaption");
  caption.append(el("strong", "", `ghoulballs #${id}`));
  card.append(media, caption);
  card.load = () => schedule(() => loadToken(network, collection, id, card, run));
  observer.observe(card);
  return card;
}

async function renderVersion(network, collection, run, observer) {
  const section = el("section", "gallery-version");
  const head = el("div", "version-head");
  const title = el("h2", "", `Version ${collection.version}${collection.current ? " · minting now" : ""}`);
  const link = el("a", "", shortAddress(collection.address) + " ↗");
  link.href = `${network.explorerUrl}/address/${collection.address}`; link.target = "_blank"; link.rel = "noopener noreferrer";
  const count = el("span", "version-count", "Reading supply…");
  head.append(title, count, link);
  const grid = el("div", "example-grid token-grid");
  section.append(head, grid);
  $("gallery-versions").append(section);
  const supply = Number(BigInt(await rpc(network, "eth_call", [{ to: collection.address, data: TOTAL_SUPPLY, gas: "0x186a0" }, "latest"])));
  if (run !== generation) return 0;
  count.textContent = `${new Intl.NumberFormat().format(supply)} minted`;
  if (!supply) { grid.replaceWith(el("p", "gallery-empty", "Nothing minted in this version yet.")); return 0; }
  let shown = 0;
  const more = el("button", "shuffle-button gallery-more", "");
  const showMore = () => {
    const end = Math.min(supply, shown + PAGE);
    for (let id = shown + 1; id <= end; ++id) grid.append(tokenCard(network, collection, id, run, observer));
    shown = end;
    more.textContent = `Show more (${new Intl.NumberFormat().format(supply - shown)} left)`;
    more.hidden = shown >= supply;
  };
  more.type = "button";
  more.addEventListener("click", showMore);
  section.append(more);
  showMore();
  return supply;
}

async function show(network) {
  const run = ++generation;
  queue.length = 0;
  $("gallery-versions").replaceChildren();
  const collections = galleryCollections(network);
  if (!collections.length) { setStatus(`Nothing has been deployed on ${network.name} yet.`); return; }
  setStatus(`Reading ${collections.length} ${collections.length === 1 ? "collection" : "collections"} on ${network.name}…`);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); entry.target.load(); }
  }, { rootMargin: "400px" });
  const results = await Promise.allSettled(collections.map(c => renderVersion(network, c, run, observer)));
  if (run !== generation) return;
  const total = results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value : 0), 0);
  const failed = results.filter(r => r.status === "rejected").length;
  setStatus(`${new Intl.NumberFormat().format(total)} minted across ${collections.length} ${collections.length === 1 ? "version" : "versions"} on ${network.name}.${failed ? " Some supply reads failed; try again shortly." : ""}`, !failed);
}

async function init() {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Settings are unavailable.");
    config = validateConfig(await response.json());
    const select = $("gallery-network");
    select.replaceChildren(...config.networks.map(n => { const o = el("option", "", n.name); o.value = String(n.chainId); return o; }));
    select.value = String(config.defaultChainId);
    select.addEventListener("change", () => show(config.networks.find(n => n.chainId === Number(select.value))));
    await show(config.networks.find(n => n.chainId === config.defaultChainId));
  } catch (error) {
    setStatus(String(error?.message ?? "The gallery is temporarily unavailable."));
  }
}
void init();
