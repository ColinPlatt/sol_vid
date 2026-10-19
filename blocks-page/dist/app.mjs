import {rpc,friendlyError,mintedToken,isAddress} from './wallet.mjs';
import {mintBlock,connectWallet,ART_VERSION} from './mint.mjs';
import {decodeAvi,drawFrame} from './avi.mjs';
import {validToken} from './world.mjs';
import {networkOf,marketLinks} from './networks.mjs';
import {mountRamen} from './ramen.mjs';
const $=id=>document.getElementById(id);
let network,busy=false,reading=false,connecting=false;
// The 3D city mirrors the mint and wallet state on the terminal screen and ticket gates.
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
function status(text,stage='idle'){$('status').textContent=text;emit('blocks:mint-state',{stage,text});}
function render(){$('mint').disabled=busy||!network?.mintEnabled||!network?.deployed;if(!busy)$('mint').innerHTML=network?.mintEnabled?'Mint a night <span>↗</span>':'Minting opens soon <span>↗</span>';$('mint-panel').dataset.busy=String(busy);}
function toast(text,ms=5200){const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true;},ms);}
// Panels: collection, about and help open over the city.
export function openPanel(id){const dialog=$(id);if(!dialog||dialog.open)return;document.querySelectorAll('dialog[open]').forEach(d=>d.close());dialog.showModal();emit('blocks:panel',{id,open:true});}
for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>openPanel(button.dataset.panel);
for(const dialog of document.querySelectorAll('dialog')){
 dialog.querySelector('.close').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>emit('blocks:panel',{id:dialog.id,open:false}));
}
for(const button of document.querySelectorAll('[data-guide]'))button.onclick=()=>{$('help').close();emit('blocks:guide',{place:button.dataset.guide});};
mountRamen({openPanel,getNetwork:()=>network,onWallet:account=>{showAccount(account);emit('blocks:wallet',{state:'connected',account});}});
function traits(items){$('traits').replaceChildren();for(const item of items){const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=item.trait_type;dd.textContent=String(item.value);div.append(dt,dd);$('traits').append(div);}}
// The reveal plays the contract's own AVI over its SVG poster (frame one) until the panel closes.
const motionless=matchMedia('(prefers-reduced-motion: reduce)');let playing=0;
async function play(token){
 const run=++playing,canvas=$('reveal-video');canvas.hidden=true;
 try{
  const response=await fetch(token.video);if(!response.ok)return;const movie=decodeAvi(await response.arrayBuffer());
  if(run!==playing||!$('reveal').open)return;
  canvas.width=movie.width;canvas.height=movie.height;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(movie.width,movie.height);
  let frame=-1;const start=performance.now();
  const tick=now=>{if(run!==playing||!$('reveal').open)return;const next=motionless.matches?0:Math.floor((now-start)/1000*movie.fps)%movie.frames.length;
   if(next!==frame){frame=next;ctx.putImageData(drawFrame(movie,frame,pixels),0,0);canvas.hidden=false;}requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 }catch{/* The poster remains. */}
}
$('reveal').addEventListener('close',()=>{playing++;$('reveal-video').hidden=true;});
// The reveal puts one token centre stage: your fresh mint, or a minted block you looked up.
function reveal(token,{mine=false,hash=null}={}){
 const id=String(token.tokenId),scene=(token.name.split('#')[0].replace(/[^a-zA-Z ]/g,'').trim()||'Your night');
 $('reveal-image').src=token.image;$('reveal-image').alt=token.name;
 $('reveal-eyebrow').textContent=mine?'鋳造完了 / MINTED · YOURS':'作品 / MINTED BLOCK';
 $('reveal-title').innerHTML='';$('reveal-title').append(mine?'Your night: ':'',Object.assign(document.createElement('em'),{textContent:scene[0]+scene.slice(1).toLowerCase()+'.'}));
 $('reveal-block').textContent='Block #'+Number(id).toLocaleString('en-US')+' · '+network.name;
 $('download').href=token.video;$('download').download=`blocks-${id}.avi`;traits(token.attributes);
 $('reveal-tx').hidden=!hash;if(hash)$('reveal-tx').href=network.explorerUrl+'/tx/'+hash;
 const links=marketLinks(network);$('reveal-links').hidden=!links;if(links){$('reveal-opensea').href=links.openseaItem(id);$('reveal-checker').href=links.checkerItem(id);}
 $('reveal').classList.toggle('mine',mine);openPanel('reveal');play(token);
}
async function viewToken(id,{mine=false,hash=null}={}){
 if(reading)return;
 if(!/^\d{1,18}$/.test(String(id))){$('read-status').textContent='Enter a minted block number.';return;}
 reading=true;$('view').disabled=true;$('read-status').textContent='Drawing this block’s night from the contract…';
 try{
  // A fresh mint can reach the wallet's node before the server's, which then briefly reports it unminted: retry.
  let response,token;
  for(let attempt=0;;attempt++){
   response=await fetch('/api/token?id='+encodeURIComponent(id));token=await response.json();
   if(response.ok||!mine||response.status!==404||attempt>=10)break;
   $('read-status').textContent='Waiting for the network to catch up with your block…';await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(!response.ok)throw Error(token.error||'This block could not be read.');
  token.tokenId=String(id);if(!validToken(token)||!Array.isArray(token.attributes))throw Error('Unexpected artwork response.');emit('blocks:artwork',token);if(mine)emit('blocks:mine',token);
  $('read-status').textContent='';reveal(token,{mine,hash});
 }catch(error){$('read-status').textContent=friendlyError(error);if(mine)status(friendlyError(error),'error');}finally{reading=false;$('view').disabled=false;}
}
$('lookup').onsubmit=event=>{event.preventDefault();viewToken($('view-block').value);};
// Clicking an artwork in the gallery opens it in the collection panel.
window.addEventListener('blocks:inspect',event=>{const tokenId=event.detail?.tokenId;if(tokenId)viewToken(tokenId);});
// The top-bar wallet button and subway ticket gates connect a wallet; ramen is free to play.
let connected=null;
function showAccount(account){connected=account||null;$('wallet').dataset.connected=String(Boolean(account));$('wallet-label').textContent=account?account.slice(0,6)+'…'+account.slice(-4):'Connect wallet';}
$('wallet').onclick=()=>{if(connected)toast('財布 · Connected as '+connected.slice(0,6)+'…'+connected.slice(-4)+'. Mint at the terminal in the gallery.');else emit('blocks:connect-request');};
// Tapping a ticket gate connects a wallet. Visitors without one are waved through.
window.addEventListener('blocks:connect-request',async()=>{
 if(connecting)return;connecting=true;emit('blocks:wallet',{state:'connecting'});
 try{
  if(!network)throw Error('Settings are still loading.');
  if(!window.ethereum){emit('blocks:wallet',{state:'visitor'});toast('No wallet found in this browser. You can explore as a visitor; minting needs a wallet such as MetaMask or Coinbase Wallet.');return;}
  const account=await connectWallet(window.ethereum,network);showAccount(account);emit('blocks:wallet',{state:'connected',account});toast('ようこそ · Wallet connected: '+account.slice(0,6)+'…'+account.slice(-4));
 }catch(error){emit('blocks:wallet',{state:'visitor',error:friendlyError(error)});toast(friendlyError(error)+' You can keep exploring as a visitor.');}
 finally{connecting=false;}
});
async function mint(){
 if(busy||!network)return;busy=true;render();$('transaction').hidden=true;
 try{
  if(!window.ethereum)throw Error('Open this page in a wallet-enabled browser to mint.');
  const messages={connect:['Connect wallet…','Approve the connection in your wallet.'],checking:['Checking…','Getting your mint ready on '+network.name+'.'],wallet:['Approve mint…','Confirm the free mint in your wallet. Network gas applies.']};
  const {hash,account}=await mintBlock(window.ethereum,network,stage=>{$('mint').textContent=messages[stage][0];status(messages[stage][1],stage);});
  showAccount(account);emit('blocks:wallet',{state:'connected',account});$('transaction').href=network.explorerUrl+'/tx/'+hash;$('transaction').hidden=false;$('mint').textContent='Finding your night…';status('Mint sent. Waiting for the block to be confirmed…','pending');
  let receipt;for(let i=0;i<90;i++){receipt=await rpc(network,'eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  if(!receipt)throw Error('Still pending. Check the transaction link before minting again.');
  const token=mintedToken(receipt,network,account);if(BigInt(token)!==BigInt(receipt.blockNumber))throw Error('The mint event does not match its block.');
  emit('blocks:minted',{tokenId:token});status(`Block ${Number(token).toLocaleString()} is yours.`,'minted');$('view-block').value=token;await viewToken(token,{mine:true,hash});
 }catch(error){status(/AlreadyMinted|0xddefae28/i.test(error?.message??'')?'Someone claimed this block. Try again for the next one.':friendlyError(error),'error');}finally{busy=false;render();}
}
$('mint').onclick=mint;window.addEventListener('blocks:mint-request',mint);
try{
 const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw Error('Settings unavailable.');network=await response.json();
 if(!networkOf(network)||network.artVersion!==ART_VERSION||!isAddress(network.rendererAddress)||(network.deployed&&!isAddress(network.collectionAddress)))throw Error('Single-block mint settings are not ready.');
 $('mint-note').textContent=networkOf(network).gas;
 if(network.deployed)$('contract').href=network.explorerUrl+'/address/'+network.collectionAddress;else $('contract').hidden=true;
 const links=network.deployed?marketLinks(network):null;$('opensea').hidden=$('checker').hidden=!links;if(links){$('opensea').href=links.opensea;$('checker').href=links.checker;}
 status(network.mintEnabled?'No inputs. Just the block your mint lands in.':'A new single-block edition. Opening soon.',network.mintEnabled?'ready':'closed');render();
 if(network.firstTokenId)$('view-block').value=network.firstTokenId;
 window.ethereum?.request?.({method:'eth_accounts'}).then(accounts=>{if(isAddress(accounts?.[0])){showAccount(accounts[0]);emit('blocks:wallet',{state:'connected',account:accounts[0],silent:true});}}).catch(()=>{});
}catch(error){network=null;render();status(friendlyError(error),'error');}
