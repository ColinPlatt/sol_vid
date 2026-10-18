// Read-only public OpenSea observations. Login/challenges remain unverified, never media failures.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp,rm,readFile,writeFile,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'deployments/marketplace-probe-base.json'),'utf8'));
if(manifest.status!=='deployed'||!manifest.receipt_verified)throw Error('Confirmed probe required');
const dir=path.join(root,'previews/probe/opensea');await mkdir(dir,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'ghoulballs-opensea-'));let chrome,ws;
const observations=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',d=>{text+=d;const m=text.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 for(let token=1;token<=15;++token){
  const url=`https://opensea.io/item/base/${manifest.collection}/${token}`;
  await evaluate('window.__stale=true');const nav=await cdp('Page.navigate',{url});
  for(let n=0;n<100;++n){if(await evaluate("!window.__stale&&document.readyState==='complete'"))break;await sleep(100);}
  await sleep(1500);
  const snapshot=await evaluate("({url:location.href,title:document.title,text:document.body?.innerText.slice(0,12000)??'',iframes:Array.from(document.querySelectorAll('iframe'),f=>({src:f.src,sandbox:f.getAttribute('sandbox')})),images:Array.from(document.images,i=>({src:i.currentSrc,alt:i.alt})).slice(0,20)})");
  const blocked=Boolean(nav.errorText)||/just a moment|verify you are human|access denied|checking your browser|cloudflare|forbidden|something went wrong|err_http_response_code_failure/i.test(snapshot.text+' '+snapshot.title);
  const bounds=await evaluate("Array.from(document.querySelectorAll('iframe,video,img'),e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}}).find(r=>r.width>200&&r.height>200&&r.x<560)");
  const hashes=[];
  if(bounds&&!blocked){
   const clip={x:bounds.x+10,y:bounds.y+10,width:bounds.width-20,height:bounds.height-20,scale:1};
   for(let n=0;n<3;++n){if(n)await sleep(620);const image=(await cdp('Page.captureScreenshot',{format:'png',clip})).data;hashes.push(createHash('sha256').update(Buffer.from(image,'base64')).digest('hex'));}
  }
  const moving=hashes.length===3?new Set(hashes).size>1:null;
  const record={token_id:token,checked_at_utc:new Date().toISOString(),status:blocked?'access_blocked':'observed',metadata_ingested:!blocked&&snapshot.title.startsWith(`ghoulballs probe #${token} -`),media_element:bounds?.tag??null,media_moving:moving,media_frame_hashes:hashes,navigation_error:nav.errorText??null,...snapshot};
  observations.push(record);await writeFile(path.join(dir,`token-${token}.png`),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  console.log(token,record.status,'metadata',record.metadata_ingested,'moving',moving,snapshot.title);
  await writeFile(path.join(dir,'observations.json'),JSON.stringify(observations,null,2)+'\n');
  if(blocked){for(let next=token+1;next<=15;++next)observations.push({token_id:next,status:'not_checked',reason:'Public browser access blocked; not evidence of media incompatibility'});break;}
 }
}finally{
 await writeFile(path.join(dir,'observations.json'),JSON.stringify(observations,null,2)+'\n');ws?.close();chrome?.kill('SIGTERM');await sleep(250);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
