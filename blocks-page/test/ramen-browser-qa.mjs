// Local Chromium integration checks. Wallet and RPC are always mocked; no ETH is sent.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),dist=path.join(root,'blocks-page/dist'),out=path.join(root,'previews/ramen');
const config=JSON.parse(await readFile(path.join(dist,'config.json'))),profile=await mkdtemp(path.join(tmpdir(),'ramen-browser-'));
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon'})[path.extname(file)]??'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));let chrome,ws;
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chrome timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.text+': '+(r.params.exceptionDetails.exception?.description??''));if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression).catch(()=>false))return;await delay(150);}throw Error('Timed out: '+expression+' errors='+JSON.stringify(errors));};
 const shot=async name=>writeFile(path.join(out,name+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__sends=[];window.__connects=0;window.__requested=false;window.__reject=false;window.__pending=false;window.__revert=false;
 const account='0x'+'a'.repeat(40),hash='0x'+'e'.repeat(64),config=${JSON.stringify(config)},native=window.fetch.bind(window);
 window.fetch=async(url,options)=>{
  if(String(url).endsWith('config.json'))return new Response(JSON.stringify(config));
  if(String(url)==='/api/world')return new Response(JSON.stringify({chainId:config.chainId,blockNumber:'52810370',timestamp:Math.floor(Date.now()/1000),baseFeeWei:'1000000',gasUsed:'1000000',gasLimit:'60000000',transactions:10,totalSupply:'0',tokenIds:[]}));
  if(String(url).startsWith('/api/token'))return new Response('{}',{status:404});
  if(options?.body){const req=JSON.parse(options.body);if(req.method!=='eth_getTransactionReceipt')throw Error('Unexpected RPC: '+req.method);const tx=window.__sends.at(-1)??{to:'0xBb789F9508DFBDd31De814E7A13ee1B549703D68'};return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result:window.__pending?null:{transactionHash:hash,to:tx.to,from:account,status:window.__revert?'0x0':'0x1'}}));}
  if(new URL(url,location.href).origin!==location.origin)throw Error('External fetch forbidden');
  return native(url,options);
 };
 window.ethereum={on(){},async request({method,params}){
  if(method==='eth_requestAccounts'){window.__connects++;window.__requested=true;return[account];}
  if(method==='eth_accounts')return window.__requested?[account]:[];
  if(method==='eth_chainId')return config.chainHex;
  if(method==='eth_estimateGas')return'0x5208';
  if(method==='eth_sendTransaction'){if(window.__reject)throw Object.assign(Error('User rejected'),{code:4001});window.__sends.push(params[0]);return window.__badHash?'0x1234':hash;}
  throw Error('Unexpected wallet call: '+method);
 }};
 `});
 await cdp('Page.navigate',{url:origin+'/#ramen'});await wait("window.__blocks&&document.documentElement.dataset.scene==='webgl'&&!document.querySelector('#mint').disabled");
 await evaluate("__blocks.interact('ticket')");await wait("document.querySelector('#ramen-menu').open");
 assert.equal(await evaluate('window.__connects'),0);assert.equal(await evaluate('window.__sends.length'),0);
 assert.equal(await evaluate("document.querySelectorAll('[data-dish]').length"),3);await shot('menu-desktop');
 async function bowl(id){await evaluate(`document.querySelector('[data-dish="${id}"]').click()`);await wait("document.querySelector('#ramen-menu').dataset.phase==='served'");assert.deepEqual(await evaluate('__blocks.ramen()'),{phase:'served',meal:id,visible:true,receiptVisible:false});}
 await bowl('shoyu');await shot('served-desktop');
 await evaluate("__blocks.walker.placeAt('ramen',10.3,0);document.querySelector('#ramen-counter').click()");assert.equal(await evaluate("document.querySelector('#ramen-menu').open"),false);await delay(300);await shot('counter-desktop');
 await evaluate("__blocks.interact('chef')");await wait("document.querySelector('#ramen-menu').open");
 await evaluate("for(let i=0;i<3;i++)document.querySelector('#ramen-bite').click()");
 await wait("document.querySelector('#ramen-menu').dataset.phase==='receipt'");assert.equal(await evaluate('__blocks.ramen().receiptVisible'),true);assert.equal(await evaluate('window.__connects'),0);
 assert.equal(await evaluate("document.querySelector('#ramen-tip').disabled"),true);await shot('bill-desktop');
 await evaluate("document.querySelector('[data-tip="+'"0.0001"'+"]').click();window.__reject=true;document.querySelector('#ramen-tip').click()");
 await wait("document.querySelector('#tip-status').textContent.includes('Cancelled')");assert.equal(await evaluate('window.__sends.length'),0);
 await evaluate("window.__reject=false;document.querySelector('#ramen-tip').click();document.querySelector('#ramen-tip').click()");
 await wait("document.querySelector('#tip-status').textContent.includes('Tip confirmed')");assert.equal(await evaluate('window.__sends.length'),1);
 const tx=await evaluate('window.__sends[0]');assert.equal(tx.to.toLowerCase(),'0xbb789f9508dfbdd31de814e7a13ee1b549703d68');assert.equal(tx.value,'0x5af3107a4000');assert.equal(tx.chainId,'0x2105');assert.equal(tx.data,undefined);
 await evaluate("document.querySelector('#ramen-tip').click()");assert.equal(await evaluate('window.__sends.length'),1);await shot('tip-confirmed-desktop');
 await evaluate("document.querySelector('#ramen-again').click()");await bowl('garden');
 await evaluate("document.querySelector('#ramen-finish').click()");await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);
 assert.equal(await evaluate("document.querySelector('#ramen-menu').getBoundingClientRect().width<=390"),true);
 assert.equal(await evaluate("document.querySelector('#ramen-menu').scrollWidth<=document.querySelector('#ramen-menu').clientWidth"),true);await shot('bill-mobile');
 await evaluate("document.querySelector('#ramen-again').click()");await bowl('miso');
 await evaluate("document.querySelector('#ramen-finish').click();document.querySelector('[data-tip="+'"0.0005"'+"]').click();window.__pending=true;document.querySelector('#ramen-tip').click()");
 await wait("document.querySelector('#tip-status').textContent.includes('Still pending')");assert.equal(await evaluate("document.querySelector('#ramen-tip').disabled&&document.querySelector('#ramen-again').disabled"),true);
 await evaluate("document.querySelector('#ramen-menu').close();__blocks.interact('ticket')");assert.equal(await evaluate('window.__sends.length'),2);
 await cdp('Page.reload');await wait("window.__blocks&&!document.querySelector('#mint').disabled");await evaluate("window.__pending=true;__blocks.interact('ticket')");
 await wait("document.querySelector('#ramen-menu').dataset.phase==='receipt'");assert.equal(await evaluate("document.querySelector('#ramen-tip').disabled&&document.querySelector('#ramen-again').disabled&&!document.querySelector('#tip-transaction').hidden"),true);
 await evaluate("window.__pending=false;window.__revert=true;document.querySelector('#tip-check').click()");await wait("document.querySelector('#tip-status').textContent.includes('reverted')");
 assert.equal(await evaluate("document.querySelector('#ramen-tip').disabled"),false);assert.equal(await evaluate('window.__sends.length'),0);
 await evaluate("window.__badHash=true;document.querySelector('#ramen-tip').click()");await wait("document.querySelector('#tip-status').textContent.includes('usable transaction result')");assert.equal(await evaluate('window.__sends.length'),1);
 await cdp('Page.reload');await wait("window.__blocks&&!document.querySelector('#mint').disabled");await evaluate("__blocks.interact('ticket')");
 assert.equal(await evaluate("document.querySelector('#ramen-tip').disabled&&!document.querySelector('#tip-reset').hidden"),true);assert.equal(await evaluate('window.__sends.length'),0);
 await evaluate("document.querySelector('#tip-reset').click()");
 // The free menu remains available without WebGL or a wallet through Help.
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:context.call(this,type,...args);};delete window.ethereum;"});
 await cdp('Page.navigate',{url:origin+'/'});await wait("document.documentElement.dataset.scene==='fallback'");
 await evaluate("document.querySelector('[data-panel=help]').click();document.querySelector('[data-panel=ramen-menu]').click()");await wait("document.querySelector('#ramen-menu').open");
 await evaluate("document.querySelector('[data-dish=shoyu]').click()");await wait("document.querySelector('#ramen-menu').dataset.phase==='served'");
 await evaluate("document.querySelector('#ramen-finish').click();document.querySelector('[data-tip="+'"0.001"'+"]').click();document.querySelector('#ramen-tip').click()");
 await wait("document.querySelector('#tip-status').textContent.includes('No wallet found')");assert.equal(await evaluate('window.__sends.length'),0);
 const unexpected=errors.filter(e=>!e.includes('Error creating WebGL context'));assert.deepEqual(unexpected,[]);
 await writeFile(path.join(out,'validation.json'),JSON.stringify({chromium:'passed',wallet:'mocked only; no real transactions',meals:3,free_meal_without_wallet:true,live_3d_serving:true,bill:true,exact_base_tip:true,rejection:true,double_click_guard:true,pending_guard:true,pending_reload:true,ambiguous_send_reload:true,reverted_tip:true,mobile:true,reduced_motion:true,no_webgl:true,no_wallet:true,firefox:'not_checked',safari:'not_checked'},null,2)+'\n');
 console.log('PASS ramen: menu, three servings, receipt, exact mocked ETH tip, rejection, pending/revert, mobile, reduced motion, no-WebGL/no-wallet');
}finally{ws?.close();chrome?.kill();server.close();await delay(100);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
