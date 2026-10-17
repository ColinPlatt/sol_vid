import { shortAddress, rpc } from "./wallet.mjs";
import { TOTAL_SUPPLY, RENDER_GAS, tokenURICall, ownerOfCall, gifCall, galleryCollections, decodeBytes, parseTokenURI, decodeAddress, bytesToBase64, renderRpcs } from "./gallery.mjs";

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

// The token's image and traits exactly as its tokenURI returns them. Public RPCs rate-limit bursts (the gallery reads
// several at once), so each render RPC is tried in turn, and the round repeats after a pause, before falling back to
// the cheaper raw gif() read, which has no traits.
export async function tokenImage(network, address, id) {
  for (let round = 0; round < 3; ++round) {
    if (round) await new Promise(resolve => setTimeout(resolve, 700 * round + Math.random() * 500));
    for (const rpcUrl of renderRpcs(network)) {
      try {
        const result = await rpc({ ...network, rpcUrl }, "eth_call", [{ to: address, data: tokenURICall(id), gas: RENDER_GAS }, "latest"], (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }));
        return parseTokenURI(new TextDecoder().decode(decodeBytes(result)));
      } catch (error) { if (/nonexistent|7e273289/i.test(String(error?.message))) throw error; }
    }
  }
  const gif = decodeBytes(await rpc(network, "eth_call", [{ to: address, data: gifCall(id), gas: "0x2faf080" }, "latest"]));
  return { name: `ghoulballs #${id}`, image: "data:image/gif;base64," + bytesToBase64(gif), animation: null, attributes: {} };
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
  const link = el("a");
  link.href = `/t/${id}`;
  link.append(img);
  media.replaceChildren(link);
  const traits = el("div", "trait-row");
  const count = attributes["Ball Count"];
  for (const value of [count && `${count} ${count === 1 ? "BALL" : "BALLS"}`, attributes.Theme, attributes.Motion]) if (value) traits.append(el("span", "", String(value).toUpperCase()));
  if (traits.childElementCount) caption.append(traits);
}

function tokenCard(network, collection, id, run, observer) {
  const card = el("figure", "token-card");
  const media = el("div", "token-media");
  media.append(el("span", "token-loading", "●"));
  const caption = el("figcaption");
  const label = el("a", "", `#${collection.tokensPerMint === 3 ? (id + 2) / 3 : id}`);
  label.href = `/t/${id}`;
  const strong = el("strong");
  strong.append(label);
  caption.append(strong);
  card.append(media, caption);
  // The whole card opens the token's page; the owner link keeps going to the explorer.
  card.addEventListener("click", event => { if (!event.target.closest("a")) location.href = `/t/${id}`; });
  card.load = () => schedule(() => loadToken(network, collection, id, card, run));
  observer.observe(card);
  return card;
}

// The list being shown, so new mints can be added to its top without rebuilding it.
let live = null;

// Every token from every collection deployed on the network, read from chain: one list, newest first.
export async function showGallery(network) {
  const run = ++generation;
  live = null;
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
  const current = collections.findIndex(c => c.current);
  const known = current >= 0 && supplies[current].status === "fulfilled" ? Number(BigInt(supplies[current].value)) : null;
  if (!tokens.length) { if (known !== null) live = { run, network, collection: collections[current], known, grid: null }; return; }
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
  if (known !== null) live = { run, network, collection: collections[current], known, grid, observer };
}

/** New mints of the current collection go on top of the list; the rest of the list is left as it is. */
export function showNewMints(network, supply) {
  if (!live || live.network !== network || live.run !== generation || supply <= live.known) return;
  // Rebuild instead when there is no list yet, or more new tokens than a page (e.g. a tab left open for a long time).
  if (!live.grid || supply - live.known > PAGE) { void showGallery(network); return; }
  const per = live.collection.tokensPerMint === 3 ? 3 : 1;
  for (let id = live.known + 1; id <= supply - per + 1; id += per) live.grid.prepend(tokenCard(network, live.collection, id, live.run, live.observer));
  live.known = supply;
}
