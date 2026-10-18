// Local browser QA with an intercepted wallet/RPC. Never sends a real transaction.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),dist=path.join(root,'blocks-page/dist');
const source=await readFile(path.join(root,'test/blockart/BaseEpochs.sol'),'utf8');
const vectors=Array.from(source.matchAll(/h\[\d+\]\s*=\s*hex"([0-9a-f]+)"/g),m=>m[1]).slice(0,10);
const fields=['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash','nonce','baseFeePerGas','withdrawalsRoot','blobGasUsed','excessBlobGas','parentBeaconBlockRoot','requestsHash'];
const blocks={};
for(const vector of vectors){
 const b=Buffer.from(vector,'hex');let p=1+b[0]-247;const block={};
 for(const field of fields){if(p>=b.length)break;const lead=b[p++];let raw;if(lead<128)raw=b.subarray(p-1,p);else{let len;if(lead<184)len=lead-128;else{const n=lead-183;len=parseInt(b.subarray(p,p+n).toString('hex'),16);p+=n;}raw=b.subarray(p,p+len);p+=len;}block[field]='0x'+raw.toString('hex');}
 for(const field of ['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas','blobGasUsed','excessBlobGas'])if(block[field]==='0x')block[field]='0x0';
 block.hash=execFileSync(process.env.CAST??'cast',['keccak','0x'+vector],{encoding:'utf8'}).trim();blocks[BigInt(block.number).toString()]=block;
}
const server=createServer(async(req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.gif':'image/gif'})[path.extname(file)]??'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(path.join(tmpdir(),'blocks-browser-'));const delay=ms=>new Promise(r=>setTimeout(r,ms));let chrome,ws;
try{
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;++i){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression);};
 await cdp('Page.enable');await cdp('Runtime.enable');
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`
 const blocks=${JSON.stringify(blocks)},account='0x'+'a'.repeat(40),collection='0x'+'b'.repeat(40),renderer='0x'+'c'.repeat(40),hash='0x'+'e'.repeat(64),live=new URL(location.href).searchParams.get('qa')==='live';
 window.__sends=[];const abi=s=>'0x'+'20'.padStart(64,'0')+BigInt(s.length).toString(16).padStart(64,'0')+Array.from(new TextEncoder().encode(s),b=>b.toString(16).padStart(2,'0')).join('').padEnd(64,'0');
 const native=window.fetch.bind(window);window.fetch=async(url,options)=>{
  if(String(url).startsWith('/api/token'))return new Response(JSON.stringify({name:'ALLEY #5254696',attributes:[{trait_type:'Epoch',value:5254696}],image:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}));
  if(String(url).endsWith('config.json'))return new Response(JSON.stringify({name:'Ethereum Sepolia',chainId:11155111,chainHex:'0xaa36a7',rpcUrl:'https://mainnet.base.org',explorerUrl:'https://basescan.org',deployed:true,mintEnabled:live,collectionAddress:collection,rendererAddress:renderer}));
  if(options?.body){const req=JSON.parse(options.body);let result;if(req.method==='eth_blockNumber')result='0x'+(52546970n).toString(16);else if(req.method==='eth_getBlockByNumber')result=blocks[BigInt(req.params[0]).toString()];else if(req.method==='eth_getTransactionReceipt')result={status:'0x1',logs:[{address:collection,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+'0'.repeat(64),'0x'+account.slice(2).padStart(64,'0'),'0x'+(5254696n).toString(16).padStart(64,'0')]}]};else throw Error('Unexpected RPC '+req.method);return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}));}
  return native(url,options);
 };
 window.ethereum={on(){},async request({method,params}){if(method==='eth_requestAccounts'||method==='eth_accounts')return[account];if(method==='eth_chainId')return'0xaa36a7';if(method==='eth_blockNumber')return'0x'+(52546970n).toString(16);if(method==='eth_getCode')return'0x6000';if(method==='eth_call')return params[0].data==='0x8ada6b0f'?'0x'+renderer.slice(2).padStart(64,'0'):abi('blocks');if(method==='eth_gasPrice')return'0x13';if(method==='eth_estimateGas')return'0x650000';if(method==='eth_sendTransaction'){window.__sends.push(params[0]);return hash;}throw Error(method);}};
 `});
 await cdp('Page.navigate',{url:origin+'/'});await until("document.querySelector('#hero')?.complete&&document.querySelector('#hero').naturalWidth===128&&document.querySelectorAll('#scenes button').length===8");
 assert.equal(await evaluate("document.querySelector('#mint').disabled"),true);
 await cdp('Page.navigate',{url:origin+'/?qa=live'});await until("document.querySelector('#epoch')?.value==='5254696'");
 await evaluate("document.querySelector('#connect').click()");await until("document.querySelector('#connect').textContent.includes('…')");
 await evaluate("document.querySelector('#mint').click()");await until("document.querySelector('#status').textContent.includes('5254696 minted')");
 assert.equal(await evaluate('window.__sends.length'),1);assert.equal(await evaluate('window.__sends[0].value'),'0x0');
 await evaluate("document.querySelectorAll('#scenes button')[7].click()");await until("document.querySelector('#hero').complete&&document.querySelector('#hero').naturalWidth===128");
 const desktop=(await cdp('Page.captureScreenshot',{format:'png'})).data;await writeFile(path.join(root,'previews/blocks-sepolia/site-browser-desktop-mocked.png'),Buffer.from(desktop,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
 await writeFile(path.join(root,'previews/blocks-sepolia/site-browser-mobile-mocked.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await writeFile(path.join(root,'previews/blocks-sepolia/site-browser-validation.json'),JSON.stringify({chromium:'passed',wallet:'mocked only; no real transactions',closed_release:true,header_mint:true,scenes:8,mobile:true,firefox:'not_checked',safari:'not_checked'},null,2)+'\n');
 console.log('PASS separate Sepolia blocks page: disabled control, eight real GIF previews, mocked proof mint and receipt, scene selection, mobile layout');
}finally{ws?.close();chrome?.kill();server.close();await delay(100);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
