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
const publishedConfig = JSON.parse(await readFile(path.join(root, "config.json"), "utf8"));
const base = publishedConfig.networks.find(n => n.chainId === 8453);
assert.deepEqual(publishedConfig.networks.map(n => n.chainId), [8453], "The page is Base only");
const mockCollection = base.collectionAddress ?? "0x" + "b".repeat(40);
const mockRenderer = base.rendererAddress ?? "0x" + "c".repeat(40);
const exportedURI = await readFile(new URL("../../previews/nft/token-1.uri.txt", import.meta.url), "utf8");
const exportedGif = (await readFile(new URL("../../previews/nft/token-1.gif", import.meta.url))).toString("hex");
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
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
    const sourceConfig = ${JSON.stringify(publishedConfig)};
    const collection = ${JSON.stringify(mockCollection)}, renderer = ${JSON.stringify(mockRenderer)}, exportedURI = ${JSON.stringify(exportedURI)}, exportedGif = ${JSON.stringify(exportedGif)};
    const account = '0x'+'a'.repeat(40), hash = '0x'+'d'.repeat(64);
    const abiString = value => '0x'+(32n).toString(16).padStart(64,'0')+BigInt(value.length).toString(16).padStart(64,'0')+[...new TextEncoder().encode(value)].map(b=>b.toString(16).padStart(2,'0')).join('').padEnd(64,'0');
    window.__qaCalls=[]; let minted=false, chain='0xaa36a7'; // the wallet starts on another network
    const live = new URL(location.href).searchParams.has('mint-qa');
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (String(url).endsWith('config.json')) {
        const config=structuredClone(sourceConfig);
        for (const n of config.networks) {
          n.deployed=live && n.chainId===8453;
          n.collectionAddress=n.deployed?collection:null;
          n.rendererAddress=n.deployed?renderer:null;
          n.tokensPerMint=1; n.mintLimit=n.deployed?1:null;
          n.collections=n.deployed?[{version:4,address:collection,current:true,tokensPerMint:1,mintLimit:1}]:[];
        }
        return new Response(JSON.stringify(config),{status:200});
      }
      if (String(url).startsWith('https:')) {
        const request=JSON.parse(options.body);
        const data=request.params?.[0]?.data??'';
        if(request.method==='eth_call'&&live){
          window.__qaCalls.push({rpc:String(url),data,gas:request.params[0].gas,to:request.params[0].to});
          let result='0x'+'0'.repeat(64);
          const id=data.length>=74?Number(BigInt('0x'+data.slice(10,74))):0, set=request.params[0].to===collection;
          if(data==='0x18160ddd') result='0x'+(window.__supply??1).toString(16).padStart(64,'0');
          else if(data.startsWith('0x38e21cce')) result='0x'+(minted?'1':'0').padStart(64,'0');
          else if(data.startsWith('0x6352211e')) result='0x'+account.slice(2).padStart(64,'0');
          else if(data.startsWith('0xc87b56dd')) result=abiString(exportedURI);
          else if(data.startsWith('0x7492d87c')) result='0x'+(32n).toString(16).padStart(64,'0')+BigInt(exportedGif.length/2).toString(16).padStart(64,'0')+exportedGif.padEnd(Math.ceil(exportedGif.length/64)*64,'0');
          return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}),{status:200});
        }
        if(request.method==='eth_call') return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:'0x0'}),{status:200});
        if(request.method==='eth_getTransactionReceipt') return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:{status:'0x1',logs:[{address:collection,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+'0'.repeat(64),'0x'+account.slice(2).padStart(64,'0'),'0x'+'1'.padStart(64,'0')]}]}}),{status:200});
        throw Error('Unexpected remote request '+request.method);
      }
      return nativeFetch(url,options);
    };
    window.ethereum={isMetaMask:true,on(){},removeListener(){},async request(r){
      window.__qaCalls.push(r);
      if(r.method==='eth_requestAccounts'||r.method==='eth_accounts')return [account];
      if(r.method==='eth_chainId')return chain;
      if(r.method==='wallet_switchEthereumChain'){chain=r.params[0].chainId;return null;}
      if(r.method==='eth_getCode')return '0x60006000';
      if(r.method==='eth_call'){
        if(['0x06fdde03','0x95d89b41'].includes(r.params[0].data))return abiString('ghoulballs');
        if(r.params[0].data==='0x8ada6b0f')return '0x'+renderer.slice(2).padStart(64,'0');
        if(r.params[0].data.startsWith('0x38e21cce'))return '0x'+'0'.padStart(64,'0');
        return '0x'+'1'.padStart(64,'0');
      }
      if(r.method==='eth_estimateGas')return '0x56073';
      if(r.method==='eth_sendTransaction'){minted=true;return hash;}
      throw Error('Unexpected wallet action '+r.method);
    }};
  ` });
  async function screenshot(file) {
    const { cssContentSize: size } = await cdp("Page.getLayoutMetrics");
    const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
    await writeFile(file, Buffer.from(result.data, "base64"));
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  // Undeployed: minting disabled, nothing to show.
  await cdp("Page.navigate", { url: origin });
  await until("document.getElementById('availability-text')?.textContent === 'NOT LIVE'");
  assert(await evaluate("document.getElementById('mint-button').disabled"));
  assert.equal(await evaluate("document.getElementById('network')"), null, "No network picker");
  // The tab icon animates the deployed token #1 GIF: a PNG <link> whose frame changes at 10fps.
  await until("document.querySelector('link[rel=icon][type=\"image/png\"]')?.href.startsWith('data:image/png')");
  const iconFrames = await evaluate("new Promise(r=>{const l=document.querySelector('link[rel=icon][type=\"image/png\"]'),s=new Set();const t=setInterval(()=>{s.add(l.href);if(s.size>3){clearInterval(t);r(s.size)}},40);setTimeout(()=>{clearInterval(t);r(s.size)},2000)})");
  assert(iconFrames > 3, "Favicon is not animating");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('link[rel=icon][href], link[rel=apple-touch-icon]')].map(l=>l.getAttribute('href')).filter(h=>!h.startsWith('data:'))"), ["/favicon.ico", "/assets/favicon.gif", "/assets/apple-touch-icon.png"]);
  assert.equal(await evaluate("document.querySelectorAll('.token-card').length"), 0);
  await evaluate("document.getElementById('connect-wallet').click()");
  await until("document.getElementById('connect-wallet').textContent.includes('0xaaaa')");
  assert.equal(await evaluate("window.__qaCalls.filter(c=>c.method==='eth_sendTransaction'||c.method==='wallet_switchEthereumChain').length"), 0, "No switch or send before deployment");
  assert(await evaluate("document.getElementById('mint-button').disabled"));

  // Live: supply, newest token on screen, every version listed newest first, then a mocked mint.
  await cdp("Page.navigate", { url: origin + "/?mint-qa=1" });
  await until("document.getElementById('availability-text')?.textContent === 'FREE · 1 PER ADDRESS'");
  await until("document.getElementById('hero-image').src.startsWith('data:image/svg+xml')");
  await until("document.querySelector('.token-card img')?.complete && document.querySelector('.token-card img').naturalWidth>0");
  assert.equal(await evaluate("document.getElementById('minted-count').textContent"), "1 / 6,667");
  assert.equal(await evaluate("document.getElementById('gallery-status-text').textContent"), "");
  assert.equal(await evaluate("document.querySelectorAll('.version-head, .gallery-version').length"), 0);
  // Only the current collection is shown.
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.token-card strong')].map(s=>s.textContent)"), ["#1"]);
  assert.deepEqual(await evaluate("[...new Set(window.__qaCalls.filter(c=>c.to).map(c=>c.to))]"), [mockCollection]);
  assert.equal(await evaluate("document.getElementById('network')"), null);
  assert.equal(await evaluate("document.querySelector('.tagline').textContent"), "Ethereum's first (probably) fully onchain animated GIF");
  assert.equal(await evaluate("document.querySelectorAll('.token-media iframe, .download-row').length"), 0);
  assert.match(await evaluate("document.querySelector('.token-card img').src"), /^data:image\/svg\+xml,.*pixelated/);
  assert.equal(await evaluate("document.querySelector('.token-card strong').textContent"), "#1");
  const renderCall = await evaluate("window.__qaCalls.find(c=>c.data?.startsWith('0xc87b56dd'))");
  assert.equal(renderCall.rpc, base.renderRpcUrl);
  assert.equal(renderCall.gas, "0x1dcd6500");
  assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"), "Desktop layout overflows");
  await screenshot("/tmp/ghoulballs-mint-desktop.png");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 150));
  assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth && [...document.querySelectorAll('.top > *')].every(e=>e.getBoundingClientRect().right<=window.innerWidth)"), "Mobile layout overflows");
  await screenshot("/tmp/ghoulballs-mint-mobile.png");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  // Someone else mints: on the next supply check (here, returning to the tab) the counter, screen and list update.
  await evaluate("window.__supply=2; document.dispatchEvent(new Event('visibilitychange'))");
  await until("document.getElementById('minted-count').textContent === '2 / 6,667'");
  await until("document.querySelectorAll('.token-card').length === 2");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.token-card strong')].map(s=>s.textContent)"), ["#2", "#1"]);
  await until("window.__qaCalls.some(c=>c.data==='0xc87b56dd'+'2'.padStart(64,'0'))");
  const tokenOneReads = await evaluate("window.__qaCalls.filter(c=>c.data==='0xc87b56dd'+'1'.padStart(64,'0')).length");
  await evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await new Promise(r => setTimeout(r, 500));
  assert.equal(await evaluate("document.querySelectorAll('.token-card').length"), 2, "Unchanged supply must not rebuild the list");
  assert.equal(await evaluate("window.__qaCalls.filter(c=>c.data==='0xc87b56dd'+'1'.padStart(64,'0')).length"), tokenOneReads, "Existing cards must not be re-read");
  await evaluate("window.__supply=1");
  assert.equal(await evaluate("document.getElementById('mint-button').disabled"), false);
  await evaluate("document.getElementById('connect-wallet').click()");
  await until("document.getElementById('connect-wallet').textContent.includes('0xaaaa')");
  // Connected on another chain: the page asks the wallet to switch to Base straight away.
  await until("window.__qaCalls.some(c=>c.method==='wallet_switchEthereumChain' && c.params[0].chainId==='0x2105')");
  await until("document.getElementById('mint-button').textContent === 'MINT'");
  await evaluate("document.getElementById('mint-button').click()");
  await until("document.getElementById('mint-status').textContent === 'MINTED #1'");
  // The confirmed mint opens the share pop-up with the minted GIF and a link to the token's page.
  await until("document.getElementById('share-dialog').open");
  await until("document.getElementById('mint-button').textContent === 'MINTED' && document.getElementById('mint-button').disabled");
  assert.equal(await evaluate("document.getElementById('share-title').textContent"), "MINTED #1");
  assert.equal(await evaluate("document.getElementById('share-view').getAttribute('href')"), "/t/1");
  await until("document.getElementById('share-image').src.startsWith('data:image/gif;base64,R0lGODlh') && document.getElementById('share-image').naturalWidth === 64");
  await screenshot("/tmp/ghoulballs-share-modal.png");
  const share = new URL(await evaluate("document.getElementById('share-link').href"));
  assert.equal(share.origin + share.pathname, "https://x.com/intent/post");
  assert.equal(share.searchParams.get("text"), "Just minted ghoulballs: Ethereum's first (probably) fully onchain animated GIF. Mint yours for free at:");
  assert.equal(share.searchParams.get("url"), origin + "/t/1");
  // The minted token's GIF is read from the chain for the share sheet.
  await until("window.__qaCalls.some(c=>c.data==='0x7492d87c'+'1'.padStart(64,'0'))");
  // With file sharing available, the click opens the share sheet with the GIF and text instead of the link.
  await evaluate(`window.__shared=null; navigator.canShare=d=>!!d.files; navigator.share=async d=>{window.__shared={name:d.files[0].name,type:d.files[0].type,size:d.files[0].size,head:[...new Uint8Array(await d.files[0].slice(0,6).arrayBuffer())].map(b=>String.fromCharCode(b)).join(''),text:d.text};}`);
  await new Promise(r => setTimeout(r, 300));
  await evaluate("document.getElementById('share-link').click()");
  await until("window.__shared");
  const shared = await evaluate("window.__shared");
  assert.deepEqual([shared.name, shared.type, shared.head, shared.size], ["ghoulballs.gif", "image/gif", "GIF89a", exportedGif.length / 2]);
  assert.equal(shared.text, "Just minted ghoulballs: Ethereum's first (probably) fully onchain animated GIF. Mint yours for free at: " + origin + "/t/1");
  // Without file sharing, the click just follows the X link to the token page (navigation blocked here).
  await evaluate(`navigator.canShare=()=>false; window.__followed=null; document.getElementById('share-link').addEventListener('click', e=>{window.__followed=!e.defaultPrevented; e.preventDefault();});`);
  await evaluate("document.getElementById('share-link').click()");
  assert.equal(await evaluate("window.__followed"), true);
  // Gallery cards link to each token's page.
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.token-card strong a')].map(a=>a.getAttribute('href'))"), ["/t/2", "/t/1"]);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.token-media > a')].map(a=>a.getAttribute('href'))"), ["/t/2", "/t/1"]);
  await evaluate("document.getElementById('close-share-dialog').click()");
  assert.equal(await evaluate("document.getElementById('share-dialog').open"), false);
  const sends = await evaluate("window.__qaCalls.filter(c=>c.method==='eth_sendTransaction')");
  assert.equal(sends.length, 1);
  assert.equal(sends[0].params[0].value, "0x0");
  assert.equal(sends[0].params[0].data, "0x1249c58b");
  assert.equal(sends[0].params[0].to.toLowerCase(), mockCollection.toLowerCase());
  assert.match(await evaluate("document.getElementById('transaction-link').href"), /basescan.org\/tx\/0x/);
  // Clicking anywhere on a card (but not its owner link) opens the token page.
  await evaluate("document.querySelector('.token-card').click()");
  // The test server has no /t/ route, so check where the browser navigated rather than the page it shows.
  let navigated = "";
  for (let i = 0; i < 40 && !navigated.endsWith("/t/2"); ++i) {
    const history = await cdp("Page.getNavigationHistory");
    navigated = history.entries[history.currentIndex].url;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal(new URL(navigated).pathname, "/t/2");
  await cdp("Page.navigate", { url: origin + "/?mint-qa=1" });
  await until("document.getElementById('availability-text')?.textContent === 'FREE · 1 PER ADDRESS'");
  // Minted out: the button turns orange, says MINTED OUT and cannot be pressed.
  await evaluate("window.__supply=6667; document.dispatchEvent(new Event('visibilitychange'))");
  await until("document.getElementById('mint-button').textContent === 'MINTED OUT'");
  assert(await evaluate("document.getElementById('mint-button').disabled && document.getElementById('mint-button').classList.contains('minted-out')"));
  assert.equal(await evaluate("getComputedStyle(document.getElementById('mint-button')).backgroundColor"), "rgb(255, 157, 24)");
  await until("document.querySelectorAll('.token-card').length === 24");
  await screenshot("/tmp/ghoulballs-minted-out.png");
  assert.deepEqual(exceptions, []);
  console.log("PASS undeployed guard, live supply, newest token on screen, current collection's GIFs only, Base only with automatic switch to Base, 1 per address note, share on X after mint, animated favicon, live pickup of new mints, share pop-up, clickable cards, minted out (render RPC at 500M gas, pixelated SVG), desktop/mobile layout, simulated mint/receipt, no real transaction or script errors.");
  console.log("Screenshots: /tmp/ghoulballs-mint-desktop.png and /tmp/ghoulballs-mint-mobile.png");
} finally {
  ws?.close(); chrome?.kill("SIGTERM"); await new Promise(r => server.close(r));
  await new Promise(r => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
