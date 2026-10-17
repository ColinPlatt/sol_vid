import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { tokenId, gifFrame, cardPng, tokenPage, tokenMetadata, tokenGif, network } from "../api/_share.js";

const exported = new URL("../../previews/nft/", import.meta.url);
const abi = bytes => "0x" + (32n).toString(16).padStart(64, "0") + BigInt(bytes.length).toString(16).padStart(64, "0") + Buffer.from(bytes).toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");
const rpc = result => async () => ({ json: async () => result });

test("token IDs are 1..6,667 decimal only", () => {
  assert.deepEqual(["1", "6667", "42"].map(tokenId), [1, 6667, 42]);
  for (const bad of ["0", "6668", "01", "1.png", "-1", "1e3", "", undefined, "99999"]) assert.equal(tokenId(bad), null, String(bad));
});

test("the GIF decoder reproduces the independent reference frame exactly", async () => {
  const gif = await readFile(new URL("token-1.gif", exported));
  const { seed } = JSON.parse(await readFile(new URL("token-1.json", exported), "utf8"));
  const expected = execFileSync("python3", ["-c", `import sys; sys.path.insert(0, "../scripts"); from vapor_reference import frame; sys.stdout.write(frame(0, 10, ${seed})[0].hex())`], { cwd: new URL("..", import.meta.url) }).toString();
  const { width, height, palette, indices } = gifFrame(gif, 0);
  assert.equal(width, 64); assert.equal(height, 64);
  assert.equal(Buffer.concat([...indices].map(i => palette.subarray(i * 3, i * 3 + 3))).toString("hex"), expected);
  assert.throws(() => gifFrame(gif, 20), /Frame not found/);
});

test("the preview card is a valid 1200x630 PNG with the art at 8x", async () => {
  const frame = gifFrame(await readFile(new URL("token-1.gif", exported)));
  const png = cardPng(frame);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  const idat = png.indexOf("IDAT"), length = png.readUInt32BE(idat - 4);
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + length));
  assert.equal(raw.length, (1200 * 3 + 1) * 630);
  const pixel = (x, y) => raw.subarray(y * 3601 + 1 + x * 3, y * 3601 + 4 + x * 3).toString("hex");
  assert.equal(pixel(0, 0), "070708");
  const i = frame.indices[0];
  assert.equal(pixel(344, 59), frame.palette.subarray(i * 3, i * 3 + 3).toString("hex"));
});

test("the token page carries its own preview card and escapes chain text", () => {
  const html = tokenPage(12, { image: "data:image/svg+xml,%3Csvg%3E", attributes: [{ trait_type: "Ball Count", value: 2 }, { trait_type: "Theme", value: "<b>Lagoon</b>" }] }, "https://ghoulballs.vercel.app");
  assert.match(html, /<meta property="og:image" content="https:\/\/ghoulballs\.vercel\.app\/t\/12\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<title>ghoulballs #12<\/title>/);
  assert.match(html, /&lt;B&gt;LAGOON&lt;\/B&gt;/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /href="\/">MINT YOURS<\/a>/);
  assert.match(html, /<a class="chip-button download-gif" href="\/t\/12\.gif" download="ghoulballs-12\.gif">DOWNLOAD GIF ↓<\/a>/);
});

test("chain reads parse the exported tokenURI and flag unminted tokens", async () => {
  const uri = await readFile(new URL("token-1.uri.txt", exported), "utf8");
  const metadata = await tokenMetadata(1, rpc({ result: abi(Buffer.from(uri)) }));
  assert.equal(metadata.name, "ghoulballs #1");
  const missing = { error: { code: 3, message: "execution reverted", data: "0x7e273289" + "9".padStart(64, "0") } };
  await assert.rejects(tokenGif(9, rpc(missing)), e => e.missing === true);
  assert.equal(network.chainId, 8453);
});
