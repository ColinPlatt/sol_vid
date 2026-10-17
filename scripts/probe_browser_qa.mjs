// Local compatibility checks for the prerecorded probe controls; no external requests or transactions.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const controls=JSON.parse(await readFile(path.join(root,'previews/probe/controls.json'),'utf8'));
const profile=await mkdtemp(path.join(tmpdir(),'marketplace-probe-chrome-'));
// Token 13 points at the deployed page, so serve that file, and require it to be the fixture the data-URI tokens embed.
const hosted=await readFile(path.join(root,'mint-page/dist/probe/player.html'));
assert.deepEqual(hosted,await readFile(path.join(root,'fixtures/marketplace-probe/html-js.html')),'mint-page/dist/probe/player.html differs from fixtures/marketplace-probe/html-js.html');
const server=createServer((req,res)=>{if(req.url==='/player.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(hosted);}else res.writeHead(404).end();});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let chrome,ws;
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',data=>{buffer+=data;const m=buffer.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const until=async expression=>{for(let n=0;n<100;++n){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out: '+expression);};
 // Mark the current document first: readyState alone is already 'complete' on the previous page.
 const open=async url=>{await evaluate('window.__probeStale=true');await cdp('Page.navigate',{url});await until("!window.__probeStale&&document.readyState==='complete'");};
 await cdp('Page.enable');await cdp('Runtime.enable');
 for(const token of [8,9]){
  await open(controls[token].animation_url);
  await until("document.querySelector('#status')?.textContent.startsWith('JavaScript running:')");
  const before=(await cdp('Page.captureScreenshot',{format:'png'})).data;await delay(300);
  const after=(await cdp('Page.captureScreenshot',{format:'png'})).data;assert.notEqual(before,after,'JS canvas did not animate');
 }
 await open(controls[10].animation_url);
 const first=await evaluate("getComputedStyle(document.querySelector('.ball')).transform");await delay(300);
 assert.notEqual(first,await evaluate("getComputedStyle(document.querySelector('.ball')).transform"),'CSS did not animate');
 assert.equal(await evaluate('document.scripts.length'),0);
 await open(controls[11].animation_url);assert.match(await evaluate('document.body.textContent'),/600,000 byte HTML/);
 await open('about:blank');
 await evaluate(`(async()=>{const v=document.createElement('video');v.src=${JSON.stringify(controls[12].animation_url)};v.muted=true;v.loop=true;document.body.append(v);await v.play();})()`);
 await until("document.querySelector('video')?.videoWidth===32");
 const t=await evaluate("document.querySelector('video').currentTime");await delay(400);
 assert(await evaluate("document.querySelector('video').currentTime")>t,'Native MP4 did not play');
 for(const token of [14,15]){
  await open('about:blank');
  await evaluate(`(async()=>{const i=document.createElement('img');i.src=${JSON.stringify(controls[token].image)};document.body.append(i);await i.decode();})()`);
  assert(await evaluate('document.images[0].naturalWidth>0'),'GIF/SVG did not load');
  const before=(await cdp('Page.captureScreenshot',{format:'png'})).data;await delay(600);
  const after=(await cdp('Page.captureScreenshot',{format:'png'})).data;assert.notEqual(before,after,'GIF/SVG animation was static');
 }
 await open(`http://127.0.0.1:${server.address().port}/player.html`);
 await until("document.querySelector('#status')?.textContent.startsWith('JavaScript running:')");
 console.log('PASS Chrome: base64/percent HTML JS, CSS-only animation, 600KB page, native H.264 MP4, SVG-wrapped/raw animated GIF and hosted HTML control.');
 console.log('This verifies browser controls locally; marketplace ingestion remains untested until deployment and indexing.');
}finally{
 ws?.close();chrome?.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));
 await new Promise(resolve=>setTimeout(resolve,250));await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
