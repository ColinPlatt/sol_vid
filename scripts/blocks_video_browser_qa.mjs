// Real Chrome/Firefox, local fixtures and a mocked wallet. Never sends real transactions.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'mint-page/dist');
const fixtures=path.join(root,'previews',process.env.BLOCKS_VIDEO_FIXTURES??'blocks-video');
const uri=await readFile(path.join(fixtures,'skyline.uri'),'utf8');
const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64'));
const config=JSON.parse(await readFile(path.join(dist,'video-config.json'),'utf8'));
const profile=await mkdtemp(path.join(tmpdir(),'ghoulballs-video-qa-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let name=url.pathname;
  if(name==='/embedded'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><iframe sandbox="allow-scripts" style="width:512px;height:512px;border:0" src="'+metadata.animation_url+'"></iframe>');return;}
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
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP timed out: '+method)),20000);const done=resolve;resolve=value=>{clearTimeout(timer);done(value);};const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expr=>{for(let i=0;i<150;++i){if(await evaluate(expr))return;await delay(100);}throw Error('Timed out: '+expr);};
 const open=async url=>{await evaluate('window.__stale=true');await cdp('Page.navigate',{url});await until("!window.__stale&&document.readyState==='complete'");};
 await cdp('Page.enable');await cdp('Runtime.enable');
 await open(metadata.animation_url);await until('window.__videoLoops>=1');
 const f=await evaluate('window.__videoFrame');await delay(170);assert.notEqual(await evaluate('window.__videoFrame'),f);
 await evaluate("document.querySelector('button').click()");await delay(80);const paused=await evaluate('window.__videoFrame');await delay(200);assert.equal(await evaluate('window.__videoFrame'),paused);
 await evaluate("document.querySelector('button').click()");await delay(200);assert.notEqual(await evaluate('window.__videoFrame'),paused);
 const screenshot=(await cdp('Page.captureScreenshot',{format:'png'})).data;await writeFile(path.join(fixtures,'chrome-player.png'),Buffer.from(screenshot,'base64'));
 // Independently rasterize the real SVG in Chromium and compare it with FFmpeg's first AVI frame.
 const pixels=await evaluate(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,128,128);resolve(btoa(String.fromCharCode(...ctx.getImageData(0,0,128,128).data)));};image.onerror=()=>reject(Error('SVG load failed'));image.src=${JSON.stringify(metadata.image)};})`);
 const expected=execFileSync('ffmpeg',['-v','error','-i',path.join(fixtures,'skyline.avi'),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-threads','1','-']);
 assert.deepEqual(Buffer.from(pixels,'base64'),expected,'Browser SVG differs from the first AVI frame');
 console.log('PASS Chromium direct playback and native SVG rasterization');
 await open(origin+'/embedded');
 await delay(1000);
 const embeddedBefore=(await cdp('Page.captureScreenshot',{format:'png'})).data;await delay(300);
 const embeddedAfter=(await cdp('Page.captureScreenshot',{format:'png'})).data;
 assert.notEqual(embeddedBefore,embeddedAfter,'Sandboxed AVI player does not animate');
 await writeFile(path.join(fixtures,'chrome-embedded-player.png'),Buffer.from(embeddedAfter,'base64'));
 report.chrome=true;report.native_svg_matches_ffmpeg_first_frame=true;report.sandboxed_player=true;
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
 const shot=await webdriver(`/session/${session}/screenshot`,undefined,'GET');await writeFile(path.join(fixtures,'firefox-player.png'),Buffer.from(shot,'base64'));
 await webdriver(`/session/${session}`,undefined,'DELETE');session=null;report.firefox=true;
 await writeFile(path.join(fixtures,'browser-validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log('PASS: Chromium native SVG matches AVI frame 0 pixel-for-pixel; embedded AVI loops, pauses and resumes in Chromium and Firefox; sandbox playback works.');
}finally{
 ws?.close();chrome?.kill('SIGTERM');driver?.kill('SIGTERM');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await delay(250);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
