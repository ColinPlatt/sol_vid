import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateConfig } from "../dist/wallet.mjs";
import { tokenURICall, ownerOfCall, gifCall, galleryCollections, decodeBytes, parseTokenURI, decodeAddress, bytesToBase64 } from "../dist/gallery.mjs";

const v1 = "0x" + "1".repeat(40), v2 = "0x" + "2".repeat(40), renderer = "0x" + "c".repeat(40);
const network = { chainId: 11155111, chainHex: "0xaa36a7", name: "Sepolia", rpcUrl: "https://rpc.example", renderRpcUrl: "https://render.example", explorerUrl: "https://explorer.example",
  deployed: true, collectionAddress: v2, rendererAddress: renderer, collections: [{ version: 1, address: v1, current: false }, { version: 2, address: v2, current: true }] };
const abiBytes = bytes => "0x" + (32n).toString(16).padStart(64, "0") + BigInt(bytes.length).toString(16).padStart(64, "0") + Buffer.from(bytes).toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");

test("call data uses the collection's tokenURI, ownerOf and gif selectors", () => {
  assert.equal(tokenURICall(1), "0xc87b56dd" + "1".padStart(64, "0"));
  assert.equal(ownerOfCall(6667), "0x6352211e" + (6667).toString(16).padStart(64, "0"));
  assert.equal(gifCall(2), "0x7492d87c" + "2".padStart(64, "0"));
});

test("every deployed collection version is listed, newest first", () => {
  assert.deepEqual(galleryCollections(network).map(c => c.version), [2, 1]);
  assert.deepEqual(galleryCollections({ ...network, deployed: false }), []);
  assert.deepEqual(validateConfig({ collectionName: "ghoulballs", defaultChainId: 11155111, networks: [network] }).networks[0].collections.length, 2);
});

test("collection history must contain exactly the current mint target", () => {
  const config = collections => ({ collectionName: "ghoulballs", defaultChainId: 11155111, networks: [{ ...network, collections }] });
  assert.throws(() => validateConfig(config([{ version: 1, address: v1, current: true }])), /collection history/);
  assert.throws(() => validateConfig(config([{ version: 2, address: "0x" + "0".repeat(40), current: true }])), /collection history/);
  assert.throws(() => validateConfig({ ...config([]), networks: [{ ...network, renderRpcUrl: "http://render.example" }] }), /HTTPS/);
});

test("large ABI returns decode exactly and reject truncation", () => {
  const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i * 7 & 255);
  assert.deepEqual(decodeBytes(abiBytes(bytes)), bytes);
  assert.throws(() => decodeBytes(abiBytes(bytes).slice(0, -64)), /length/);
  assert.equal(Buffer.from(bytesToBase64(bytes), "base64").compare(Buffer.from(bytes)), 0);
  assert.equal(decodeAddress("0x" + "a".repeat(64)), "0x" + "a".repeat(40));
});

test("the exported tokenURI parses with its pixelated SVG GIF and no animation", async () => {
  const token = parseTokenURI(await readFile(new URL("../../previews/nft/token-1.uri.txt", import.meta.url), "utf8"));
  assert.equal(token.name, "ghoulballs #1");
  assert.match(token.image, /^data:image\/svg\+xml,.*image-rendering:pixelated.*href='data:image\/gif;base64,R0lGOD/);
  assert.equal(token.animation, null);
  assert.equal(token.attributes["Art Version"], "GHOULBALLS_VAPOR_V3");
});

test("version 1's plain GIF metadata also parses; unexpected media is rejected", () => {
  const encode = json => "data:application/json;base64," + Buffer.from(JSON.stringify(json)).toString("base64");
  const token = parseTokenURI(encode({ name: "ghoulballs #1", image: "data:image/gif;base64,R0lGODlh", animation_url: "data:video/mpeg;base64,AAAB", attributes: [{ trait_type: "Ball Count", value: 2 }] }));
  assert.equal(token.image, "data:image/gif;base64,R0lGODlh");
  assert.equal(token.attributes["Ball Count"], 2);
  assert.throws(() => parseTokenURI(encode({ name: "x", image: "https://example.com/x.png" })), /image/);
  assert.throws(() => parseTokenURI(encode({ name: "x", image: "data:image/gif;base64,R0", animation_url: "javascript:alert(1)" })), /animation/);
  assert.throws(() => parseTokenURI("data:application/json;utf8,{}"), /encoding/);
});
