// Local browser QA with an intercepted wallet/RPC. Never sends a real transaction.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),dist=path.join(root,'blocks-page/dist');
const server=createServer(async(req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.gif':'image/gif'})[path.extname(file)]??'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const galleryGIF=(await readFile(path.join(dist,'assets/block-11941801.gif'))).toString('base64');
const profile=await mkdtemp(path.join(tmpdir(),'blocks-browser-'));const delay=ms=>new Promise(r=>setTimeout(r,ms));let chrome,ws;
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;++i){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression);};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:1100,deviceScaleFactor:1,mobile:false});
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
 const account='0x'+'a'.repeat(40),collection='0x'+'b'.repeat(40),renderer='0x'+'c'.repeat(40),hash='0x'+'e'.repeat(64),live=new URL(location.href).searchParams.get('qa')==='live';
 window.__sends=[];const abi=s=>'0x'+'20'.padStart(64,'0')+BigInt(s.length).toString(16).padStart(64,'0')+Array.from(new TextEncoder().encode(s),b=>b.toString(16).padStart(2,'0')).join('').padEnd(64,'0');
 const native=window.fetch.bind(window);window.fetch=async(url,options)=>{
  if(String(url)==='/api/world'&&window.__worldOffline)return new Response('{}',{status:503});
  if(String(url)==='/api/world')return new Response(JSON.stringify({chainId:11155111,blockNumber:'13000000',timestamp:Math.floor(Date.now()/1000),baseFeeWei:'123456789',gasUsed:'15000000',gasLimit:'60000000',transactions:72,totalSupply:'2',tokenIds:['13000000','11941801'],observedAt:Date.now()}));
  if(String(url).startsWith('/api/token'))return new Response(JSON.stringify({name:'ALLEY #13000000',attributes:[{trait_type:'Block',value:13000000}],tokenId:'13000000',image:'data:image/gif;base64,${galleryGIF}'}));
  if(String(url).endsWith('config.json'))return new Response(JSON.stringify({artVersion:'BLOCKS_SINGLE_V1',name:'Ethereum Sepolia',chainId:11155111,chainHex:'0xaa36a7',rpcUrl:'https://mainnet.base.org',explorerUrl:'https://basescan.org',deployed:true,mintEnabled:live,collectionAddress:collection,rendererAddress:renderer}));
  if(options?.body){const req=JSON.parse(options.body);let result;if(req.method==='eth_getTransactionReceipt')result={status:'0x1',blockNumber:'0xc65d40',logs:[{address:collection,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+'0'.repeat(64),'0x'+account.slice(2).padStart(64,'0'),'0x'+(13000000n).toString(16).padStart(64,'0')]}]};else throw Error('Unexpected RPC '+req.method);return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}));}
  return native(url,options);
 };
 window.ethereum={on(){},async request({method,params}){if(method==='eth_requestAccounts'){window.__requested=true;return[account];}if(method==='eth_accounts')return window.__requested?[account]:[];if(method==='eth_chainId')return'0xaa36a7';if(method==='eth_blockNumber')return'0x'+(52546970n).toString(16);if(method==='eth_getCode')return'0x6000';if(method==='eth_call')return params[0].data==='0x8ada6b0f'?'0x'+renderer.slice(2).padStart(64,'0'):abi(params[0].data==='0xacaaa87e'?'BLOCKS_SINGLE_V1':'blocks');if(method==='eth_gasPrice')return'0x13';if(method==='eth_estimateGas')return'0x100000';if(method==='eth_sendTransaction'){window.__sends.push(params[0]);return hash;}throw Error(method);}};
 `});
 const wait=async(expression,seconds=60)=>{for(let i=0;i<seconds*4;++i){if(await evaluate(expression).catch(()=>false))return;await delay(250);}throw Error('Timed out: '+expression);};
 const shot=async name=>writeFile(path.join(root,'previews/blocks-sepolia/'+name+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const key=async(code,hold=80)=>{const k={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Escape:27,Enter:13,KeyT:84}[code];await cdp('Input.dispatchKeyEvent',{type:'keyDown',code,key:code,windowsVirtualKeyCode:k});await delay(hold);await cdp('Input.dispatchKeyEvent',{type:'keyUp',code,key:code,windowsVirtualKeyCode:k});};
 // Unreleased config: the mint stays closed and the city still renders.
 await cdp('Page.navigate',{url:origin+'/'});await wait("['webgl','fallback'].includes(document.documentElement.dataset.scene)&&document.querySelector('.nights li')!==null");
 assert.equal(await evaluate("document.querySelectorAll('#collection img').length"),0,'The collection panel explains rather than shows examples');
 assert.equal(await evaluate("document.querySelector('#mint').disabled"),true);
 await cdp('Page.navigate',{url:origin+'/?qa=live'});await wait("document.querySelector('#mint')?.disabled===false");
 assert.equal(await evaluate("document.documentElement.dataset.scene"),'webgl');
 await wait("document.querySelector('#chain-status').textContent==='SEPOLIA / LIVE'");
 assert.equal(await evaluate("document.querySelector('#chain-head').textContent"),'#13,000,000');
 assert.equal(await evaluate("document.querySelector('#chain-supply').textContent"),'2 MINTED');
 await wait("document.querySelector('#animated-icon')?.href.startsWith('data:image/png;base64,')");
 const icon=await evaluate("document.querySelector('#animated-icon').href");await delay(180);
 assert.notEqual(await evaluate("document.querySelector('#animated-icon').href"),icon,'Tab icon must animate');
 const iconPNG=await evaluate("(async()=>{const {drawIcon}=await import('./favicon.mjs');const c=document.createElement('canvas');c.width=c.height=64;drawIcon(c.getContext('2d'),0);return c.toDataURL('image/png').split(',')[1];})()");
 await writeFile(path.join(root,'previews/blocks-sepolia/tab-icon.png'),Buffer.from(iconPNG,'base64'));
 // The mint terminal lives in the gallery; it is not shown on the street.
 assert.equal(await evaluate("document.querySelector('#mint-panel').dataset.visible"),'false');
 await shot('site-overview-desktop');
 // Walking: the street moves, pausing freezes it exactly, and arrows queue turns.
 await evaluate("document.querySelector('#explore').click()");
 await wait("document.body.classList.contains('exploring')&&!document.querySelector('#leave-street').hidden");
 const z0=await evaluate('__blocks.walker.z');await delay(1500);
 assert.ok(await evaluate('__blocks.walker.z')<z0,'Cruising walks north');
 assert.equal(await evaluate("document.body.dataset.firstVisit"),'true','First visits highlight the help button');
 await evaluate("delete document.body.dataset.firstVisit;document.querySelector('#motion').click()");await delay(1200);
 // Compare the scene below the top bar; the bar's buttons may still be animating focus or hover.
 const scene={x:0,y:70,width:1280,height:1030,scale:1},paused=(await cdp('Page.captureScreenshot',{format:'png',clip:scene})).data;await delay(400);
 const pausedAfter=(await cdp('Page.captureScreenshot',{format:'png',clip:scene})).data;
 if(pausedAfter!==paused&&process.env.QA_DEBUG){await writeFile(process.env.QA_DEBUG+'/p1.png',Buffer.from(paused,'base64'));await writeFile(process.env.QA_DEBUG+'/p2.png',Buffer.from(pausedAfter,'base64'));}
 assert.ok(pausedAfter===paused,'Pause must freeze the street and reflections');
 await shot('site-street-desktop');
 await evaluate("document.querySelector('#motion').click()");
 await key('ArrowRight');assert.equal(await evaluate("__blocks.walker.queued?.side"),'right');
 await key('ArrowRight');assert.equal(await evaluate("__blocks.walker.queued"),null,'Pressing again cancels the turn');
 assert.ok((await evaluate("document.querySelector('#prompt').textContent")).length>0,'Contextual prompt is shown');
 // Guided route to the gallery, then mint at the terminal (mocked wallet only).
 await evaluate("__blocks.timeScale=8;document.querySelector('[data-guide=gallery]').click()");
 await wait("__blocks.walker.place?.id==='gallery'&&__blocks.walker.mode==='inside'",150);
 await evaluate("__blocks.timeScale=1");
 assert.equal(await evaluate("document.querySelector('#mint-panel').dataset.visible"),'true');
 assert.equal(await evaluate("document.querySelector('#action').textContent.includes('Mint')"),true);
 await delay(800);await shot('site-gallery-desktop');
 await evaluate("document.querySelector('#action').click()");await wait("document.querySelector('#status').textContent.includes('is yours')",60);
 assert.equal(await evaluate("window.__sends.length"),1);assert.equal(await evaluate("window.__sends[0].data"),'0x1249c58b');assert.equal(await evaluate("window.__sends[0].value"),'0x0');
 // The new token pops up centre stage, and then floats in the gallery's terminal.
 await wait("document.querySelector('#reveal').open&&document.querySelector('#reveal').classList.contains('mine')&&document.querySelector('#reveal-image').naturalWidth===128");
 assert.equal(await evaluate("document.querySelector('#reveal-block').textContent.includes('13,000,000')&&!document.querySelector('#reveal-tx').hidden"),true);
 await delay(900);await shot('site-browser-desktop-mocked');
 await evaluate("document.querySelector('#reveal').close()");await delay(1200);await shot('site-gallery-minted-desktop');
 // Leaving with Escape returns to the street.
 await key('Escape');await wait("__blocks.walker.mode==='street'",60);
 // The subway: the ticket gate connects the wallet, then the train rides out to Sakuragawa and back.
 // Minting already connected the wallet, which opens the gates; close them to test the tap.
 await evaluate("window.__requested=false;__blocks.walker.gate=false;__blocks.walker.placeAt('station',18,0)");await delay(600);
 assert.equal(await evaluate("__blocks.walker.gate"),false);
 await evaluate("__blocks.interact('gate')");await wait("__blocks.walker.gate&&!document.querySelector('#wallet-chip').hidden");
 await evaluate("__blocks.walker.placeAt('station',25,-4,Math.PI/2)");await delay(900);await shot('site-station-desktop');
 await evaluate("__blocks.timeScale=8;__blocks.interact('train')");
 await wait("__blocks.ride?.phase==='journey'",120);await wait("__blocks.ride?.phase==='journey'&&__blocks.ride.t>20",150);
 await evaluate("__blocks.timeScale=1");await delay(600);await shot('site-ride-desktop');await evaluate("__blocks.timeScale=8");
 await wait("__blocks.walker.place?.id==='remote'&&__blocks.walker.mode==='inside'",150);
 await evaluate("__blocks.timeScale=1");await delay(900);await shot('site-sakuragawa-desktop');
 await evaluate("__blocks.timeScale=8;__blocks.interact('train-home')");
 await wait("__blocks.walker.place?.id==='station'&&__blocks.walker.mode==='inside'&&!__blocks.ride",200);
 await evaluate("__blocks.timeScale=1");assert.equal(await evaluate("document.body.dataset.place"),'station');
 // Mobile.
 await cdp('Page.navigate',{url:origin+'/?qa=live'});await wait("document.documentElement.dataset.scene==='webgl'");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(600);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
 await shot('site-browser-mobile-mocked');
 await evaluate("document.querySelector('#explore').click()");await wait("document.body.classList.contains('exploring')");
 await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:110,y:300}]});await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:215,y:330}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await delay(600);assert.equal(await evaluate("document.querySelector('#go-forward').getBoundingClientRect().bottom<=innerHeight"),true);
 await shot('site-street-mobile');
 await evaluate("__blocks.walker.placeAt('gallery',9,0)");await delay(900);
 assert.equal(await evaluate("document.querySelector('#mint').getBoundingClientRect().bottom<innerHeight&&document.querySelector('#mint').getBoundingClientRect().top>0"),true);
 await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});await delay(300);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
 // Reduced motion freezes the scene and the tab icon.
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait("document.querySelector('#motion').getAttribute('aria-pressed')==='true'");
 await wait("document.querySelector('#animated-icon').href==="+JSON.stringify('data:image/png;base64,'+iconPNG));
 const stillIcon=await evaluate("document.querySelector('#animated-icon').href");await delay(250);
 assert.equal(await evaluate("document.querySelector('#animated-icon').href"),stillIcon,'Reduced motion must stop the tab icon');
 // An offline feed keeps the last reading.
 await evaluate("window.__worldOffline=true;document.dispatchEvent(new Event('visibilitychange'))");
 await wait("document.querySelector('#chain-status').textContent==='SEPOLIA / FEED OFFLINE'");
 assert.equal(await evaluate("document.querySelector('#chain-head').textContent"),'#13,000,000');
 // Without WebGL the mint panel is always available.
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const originalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:originalContext.call(this,type,...args);};"});
 await cdp('Page.navigate',{url:origin+'/?qa=live'});await wait("document.documentElement.dataset.scene==='fallback' && !document.querySelector('#mint').disabled");
 assert.equal(await evaluate("getComputedStyle(document.querySelector('#mint-panel')).visibility"),'visible');
 await writeFile(path.join(root,'previews/blocks-sepolia/site-browser-validation.json'),JSON.stringify({network:'Ethereum Sepolia',site:'standalone blocks-page',chromium:'passed',wallet:'mocked only; no real transactions',zero_argument_mint:true,threejs:'Walkable street grid with junction turns, arrow keys and on-screen arrows, guided route, walk-in ramen shop, gallery mint terminal, subway ticket-gate wallet connection, round-trip ride to Sakuragawa, paused-frame stability, mobile touch look; reduced-motion and no-WebGL fallback preserve mint',chain_feed:'Mocked head, base fee, minted count and offline state passed',gallery:'Seven frames show minted originals (empty frames await a block, no demos); a fresh mint pops up in a reveal and floats inside the terminal; WebCodecs GIF playback with static poster fallback',scenes:8,mobile:true,narrow_mobile_320:true,animated_favicon:'PNG swaps, reduced motion and static first-frame export passed',audio:'procedural Web Audio; not asserted in headless Chrome',firefox:'not_checked',safari:'not_checked'},null,2)+'\n');
 console.log('PASS blocks city: walk, turns, guided route, gallery mint, ticket gate wallet, Sakuragawa round trip, mobile, reduced motion, fallback');
}finally{ws?.close();chrome?.kill();server.close();await delay(100);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
