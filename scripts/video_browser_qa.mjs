// Real Chrome/Firefox, local fixtures and a mocked wallet. Never sends real transactions.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'mint-page/dist');
const uri=await readFile(path.join(root,'previews/video/nft-metadata.bin'),'utf8');
const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64'));
const config=JSON.parse(await readFile(path.join(dist,'video-config.json'),'utf8'));
const profile=await mkdtemp(path.join(tmpdir(),'ghoulballs-video-qa-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let name=url.pathname;
  if(name==='/video/')name+='index.html';
  const file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let chrome,ws,driver,session;
const report={scope:'current development fixtures, not live deployment evidence',chrome:false,firefox:false,safari:'not_tested_requires_macOS',marketplace:'not_checked'};
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expr=>{for(let i=0;i<150;++i){if(await evaluate(expr))return;await delay(100);}throw Error('Timed out: '+expr);};
 const open=async url=>{await evaluate('window.__stale=true');await cdp('Page.navigate',{url});await until("!window.__stale&&document.readyState==='complete'");};
 await cdp('Page.enable');await cdp('Runtime.enable');
 await open(metadata.animation_url);await until('window.__videoLoops>=1');
 const f=await evaluate('window.__videoFrame');await delay(170);assert.notEqual(await evaluate('window.__videoFrame'),f);
 await evaluate("document.querySelector('button').click()");await delay(80);const paused=await evaluate('window.__videoFrame');await delay(200);assert.equal(await evaluate('window.__videoFrame'),paused);
 await evaluate("document.querySelector('button').click()");await delay(200);assert.notEqual(await evaluate('window.__videoFrame'),paused);
 const screenshot=(await cdp('Page.captureScreenshot',{format:'png'})).data;await writeFile(path.join(root,'previews/video/chrome-player-development.png'),Buffer.from(screenshot,'base64'));
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
 const settings=${JSON.stringify(config)},uri=${JSON.stringify(uri)};
 const account='0x'+'a'.repeat(40),collection='0x'+'b'.repeat(40),renderer='0x'+'c'.repeat(40),hash='0x'+'d'.repeat(64);
 const abi=s=>'0x'+'20'.padStart(64,'0')+BigInt(s.length).toString(16).padStart(64,'0')+Array.from(new TextEncoder().encode(s),b=>b.toString(16).padStart(2,'0')).join('');
 const nativeFetch=window.fetch.bind(window);const live=new URL(location.href).searchParams.get('qa')==='live';let minted=false;window.__qaRequests=[];
 window.fetch=async(url,options)=>{
  if(String(url).endsWith('/video-config.json')){const c=structuredClone(settings);c.mintEnabled=c.playbackVerified=live;Object.assign(c.networks[0],{deployed:live,collectionAddress:live?collection:null,rendererAddress:live?renderer:null});return new Response(JSON.stringify(c));}
  if(String(url).startsWith('https:')){
   const r=JSON.parse(options.body);window.__qaRequests.push(r);let result;
   if(r.method==='eth_call'){if(window.__qaReadFail)return new Response('{}',{status:503});result=r.params[0].data==='0x18160ddd'?'0x1':abi(uri);}
   else if(r.method==='eth_getTransactionReceipt')result={status:'0x1',logs:[{address:collection,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+'0'.repeat(64),'0x'+account.slice(2).padStart(64,'0'),'0x'+'1'.padStart(64,'0')]}]};
   else throw Error('Unexpected remote RPC '+r.method);return new Response(JSON.stringify({result}));
  }return nativeFetch(url,options);
 };
 window.ethereum={on(){},async request(r){window.__qaRequests.push(r);if(r.method==='eth_requestAccounts'||r.method==='eth_accounts')return[account];if(r.method==='eth_chainId')return'0x2105';if(r.method==='eth_getCode')return'0x6000';if(r.method==='eth_estimateGas')return'0x249f0';if(r.method==='eth_sendTransaction'){minted=true;return hash;}if(r.method==='eth_call'){const d=r.params[0].data;if(d==='0x06fdde03'||d==='0x95d89b41')return abi('ghoulballs');if(d==='0x8ada6b0f')return'0x'+renderer.slice(2).padStart(64,'0');if(d.startsWith('0x38e21cce'))return minted?'0x1':'0x0';if(d.startsWith('0x01ffc9a7'))return'0x1';}throw Error('Unexpected wallet request '+r.method);}};
 `});
 await open(origin+'/video/');await until("document.querySelector('#release').textContent.includes('not open')");assert(await evaluate("document.querySelector('#mint').disabled&&document.querySelector('#connect').disabled"));
 await open(origin+'/video/?qa=live&id=1');await until("document.querySelector('#screen iframe')&&document.querySelector('#view-status').textContent.includes('loaded')");
 assert.equal(await evaluate("document.querySelector('iframe').getAttribute('sandbox')"),'allow-scripts');
 await evaluate("document.querySelector('iframe').scrollIntoView({block:'center'})");
 await delay(1000);
 const rect=await evaluate("(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
 const embeddedBefore=(await cdp('Page.captureScreenshot',{format:'png',clip:rect})).data;await delay(230);
 const embeddedAfter=(await cdp('Page.captureScreenshot',{format:'png',clip:rect})).data;
 assert(embeddedBefore!==embeddedAfter,'Sandboxed onchain player did not animate');
 await writeFile(path.join(root,'previews/video/chrome-embedded-player-development.png'),Buffer.from(embeddedAfter,'base64'));

 assert(await evaluate("document.querySelector('#download').href.startsWith('blob:')"));
 await evaluate("document.querySelector('#connect').click()");await until("!document.querySelector('#mint').disabled");await evaluate("document.querySelector('#mint').click()");await until("document.querySelector('#mint-status').textContent.includes('Minted ghoulballs')");
 const sent=await evaluate("window.__qaRequests.filter(r=>r.method==='eth_sendTransaction')");assert.equal(sent.length,1);assert.equal(sent[0].params[0].value,'0x0');assert.equal(sent[0].params[0].data,'0x1249c58b');
 await evaluate("document.querySelector('#refresh').click()");await until("document.querySelectorAll('.tile').length===1");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 await writeFile(path.join(root,'previews/video/chrome-mint-mobile-development.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("window.__qaReadFail=true;document.querySelector('#token-form').requestSubmit()");await until("document.querySelector('#view-status').textContent.includes('Unable to read')");
 report.chrome=true;
 // Use actual Firefox/Geckodriver binaries, avoiding Snap's profile path indirection.
 const firefox=process.env.FIREFOX_BIN??'/snap/firefox/current/usr/lib/firefox/firefox';
 const gecko=process.env.GECKODRIVER_BIN??'/snap/firefox/current/usr/lib/firefox/geckodriver';
 driver=spawn(gecko,['--port','0'],{env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1'},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Geckodriver startup timeout')),20000);driver.once('error',reject);const onData=d=>{log+=d;const m=log.match(/Listening on 127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}};driver.stdout.on('data',onData);driver.stderr.on('data',onData);});
 const endpoint2=`http://127.0.0.1:${port}`;
 const webdriver=async(route,body,method='POST')=>{const response=await fetch(endpoint2+route,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const r=await response.json();if(r.value?.error)throw Error(JSON.stringify(r.value));return r.value;};
 const created=await webdriver('/session',{capabilities:{alwaysMatch:{'moz:firefoxOptions':{binary:firefox,args:['-headless']}}}});session=created.sessionId;
 const execute=async script=>webdriver(`/session/${session}/execute/sync`,{script,args:[]});
 await webdriver(`/session/${session}/url`,{url:metadata.animation_url});
 for(let i=0;i<100 && !(await execute('return window.__videoLoops>=1'));++i)await delay(100);
 assert(await execute('return window.__videoLoops>=1'),'Firefox failed to loop');
 await execute("document.querySelector('button').click();return true;");await delay(80);const pause2=await execute('return window.__videoFrame');await delay(200);assert.equal(await execute('return window.__videoFrame'),pause2);
 await execute("document.querySelector('button').click();return true;");await delay(200);assert.notEqual(await execute('return window.__videoFrame'),pause2);
 const shot=await webdriver(`/session/${session}/screenshot`,undefined,'GET');await writeFile(path.join(root,'previews/video/firefox-player-development.png'),Buffer.from(shot,'base64'));
 await webdriver(`/session/${session}`,undefined,'DELETE');session=null;report.firefox=true;
 await writeFile(path.join(root,'previews/video/browser-validation-development.json'),JSON.stringify(report,null,2)+'\n');
 console.log('PASS: Chrome self-contained loop/pause/resume, disabled release, mocked zero-value mint, gallery, download, RPC errors and mobile layout; Firefox loop/pause/resume. Safari requires a macOS check.');
}finally{
 ws?.close();chrome?.kill('SIGTERM');driver?.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await delay(250);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
