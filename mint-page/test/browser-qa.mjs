// Browser QA with the installed Chrome, an isolated profile and a mocked wallet.
// No blockchain transactions or remote RPC requests are made.
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), "ghoulballs-chrome-"));
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".gif": "image/gif", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const data = await readFile(file); res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" }); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let chrome, ws;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = ""; const timeout = setTimeout(() => reject(new Error("Chrome startup timed out")), 20000);
    chrome.once("error", reject);
    chrome.stderr.on("data", data => { buffer += data; const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    chrome.once("exit", code => { clearTimeout(timeout); reject(new Error(`Chrome exited: ${code}`)); });
  });
  const port = new URL(endpoint).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let next = 0; const waiting = new Map(); const exceptions = [];
  ws.addEventListener("message", event => {
    const m = JSON.parse(event.data);
    if (m.method === "Runtime.exceptionThrown") exceptions.push(m.params.exceptionDetails.text);
    if (m.id && waiting.has(m.id)) { const { resolve, reject } = waiting.get(m.id); waiting.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  async function until(expression) { for (let i = 0; i < 80; ++i) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error("Timed out: " + expression); }
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `window.__qaCalls=[];window.ethereum={isMetaMask:true,on(){},removeListener(){},async request(r){window.__qaCalls.push(r);if(r.method==='eth_requestAccounts'||r.method==='eth_accounts')return ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'];if(r.method==='eth_chainId')return '0xaa36a7';throw Error('Unexpected wallet action '+r.method)}};` });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: origin });
  await until("document.getElementById('availability-text')?.textContent.includes('opens after deployment')");
  assert(await evaluate("document.getElementById('mint-button').disabled"));
  assert.equal(await evaluate("document.getElementById('network').value"), "11155111");
  const firstSeed = await evaluate("document.getElementById('seed-label').textContent");
  await evaluate("document.getElementById('shuffle').click()");
  assert.notEqual(await evaluate("document.getElementById('seed-label').textContent"), firstSeed);
  await evaluate("document.getElementById('connect-wallet').click()");
  await until("document.getElementById('connect-wallet').textContent.includes('0xaaaa')");
  assert.equal(await evaluate("window.__qaCalls.filter(c=>c.method==='eth_sendTransaction').length"), 0);
  await evaluate("document.getElementById('network').value='8453';document.getElementById('network').dispatchEvent(new Event('change'))");
  assert.match(await evaluate("document.getElementById('availability-text').textContent"), /Base mint opens/);
  assert(await evaluate("document.getElementById('mint-button').disabled"));
  assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"));
  await cdp("Page.navigate", { url: origin });
  await until("document.getElementById('availability-text')?.textContent.includes('opens after deployment')");
  await evaluate("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}))");
  async function screenshot(file) {
    const { cssContentSize: size } = await cdp("Page.getLayoutMetrics");
    const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
    await writeFile(file, Buffer.from(result.data, "base64"));
  }
  assert(await evaluate("[...document.images].every(i=>i.complete && i.naturalWidth>0)"), "Artwork image failed to load");
  assert.match(await evaluate("document.getElementById('seed-label').textContent"), /2 balls.*Ricochet/);
  await screenshot("/tmp/ghoulballs-mint-desktop.png");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 100));
  assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"), "Mobile layout overflows");
  await screenshot("/tmp/ghoulballs-mint-mobile.png");
  assert.deepEqual(exceptions, []);
  console.log("PASS desktop/mobile layout, animated assets, preview shuffle, mock wallet connection, Base selection, undeployed mint guard, no unexpected transaction or script errors.");
  console.log("Screenshots: /tmp/ghoulballs-mint-desktop.png and /tmp/ghoulballs-mint-mobile.png");
} finally {
  ws?.close(); chrome?.kill("SIGTERM"); await new Promise(r => server.close(r));
  await new Promise(r => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
