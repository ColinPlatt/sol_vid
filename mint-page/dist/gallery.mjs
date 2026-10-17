// Onchain gallery reads. No indexer: supply, owners and full tokenURI metadata come straight from each collection.
import { isAddress } from "./wallet.mjs";

export const TOTAL_SUPPLY = "0x18160ddd";
export const RENDER_GAS = "0x1dcd6500"; // 500M, the documented render budget.
const uint = value => BigInt(value).toString(16).padStart(64, "0");
export const tokenURICall = id => "0xc87b56dd" + uint(id);
export const ownerOfCall = id => "0x6352211e" + uint(id);
export const gifCall = id => "0x7492d87c" + uint(id);

// Every collection version ever deployed on a network, newest first.
export function galleryCollections(network) {
  if (!network?.deployed || !Array.isArray(network.collections)) return [];
  return network.collections.filter(c => Number.isSafeInteger(c.version) && isAddress(c.address)).sort((a, b) => b.version - a.version);
}

// ABI-decodes a dynamic `bytes`/`string` return of any length.
export function decodeBytes(hex) {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(hex ?? "")) throw new Error("Invalid contract response.");
  const raw = hex.slice(2);
  const offset = Number(BigInt("0x" + raw.slice(0, 64))) * 2;
  if (!Number.isSafeInteger(offset) || offset < 64 || offset + 64 > raw.length) throw new Error("Invalid bytes offset.");
  const length = Number(BigInt("0x" + raw.slice(offset, offset + 64)));
  if (!Number.isSafeInteger(length) || offset + 64 + length * 2 > raw.length) throw new Error("Invalid bytes length.");
  const out = new Uint8Array(length);
  for (let i = 0, p = offset + 64; i < length; ++i, p += 2) out[i] = parseInt(raw.slice(p, p + 2), 16);
  return out;
}

const base64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

// Parses the token's own data:application/json URI and keeps its media URIs exactly as the contract returned them.
export function parseTokenURI(uri) {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) throw new Error("Unexpected tokenURI encoding.");
  const metadata = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64(uri.slice(prefix.length))));
  if (typeof metadata.name !== "string" || typeof metadata.image !== "string") throw new Error("Metadata has no image.");
  if (!/^data:image\/(?:gif;base64,|svg\+xml,)/.test(metadata.image)) throw new Error("Unexpected image encoding.");
  if (metadata.animation_url !== undefined && !/^data:video\/mpeg;base64,/.test(metadata.animation_url)) throw new Error("Unexpected animation encoding.");
  const attributes = Array.isArray(metadata.attributes) ? metadata.attributes : [];
  return { name: metadata.name, description: String(metadata.description ?? ""), image: metadata.image, animation: metadata.animation_url ?? null,
    attributes: Object.fromEntries(attributes.filter(a => typeof a?.trait_type === "string").map(a => [a.trait_type, a.value])) };
}

export function decodeAddress(hex) {
  if (!/^0x[0-9a-f]{64}$/i.test(hex ?? "")) throw new Error("Invalid owner.");
  return "0x" + hex.slice(-40);
}

// Base64-encodes contract bytes for a data URI (used for the cheaper raw-GIF fallback read).
export function bytesToBase64(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
