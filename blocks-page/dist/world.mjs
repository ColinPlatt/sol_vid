// Read-only street feed. No wallet requests and no caller-selected RPC or collection.
import {NETWORKS} from './networks.mjs';
export const demos=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama'];
// Tokens carry the onchain SVG poster and the same-origin path of their AVI.
export function validToken(token){const id=String(token?.tokenId);return /^\d{1,18}$/.test(id)&&/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(token?.image??'')&&token?.video==='/api/token?id='+id+'&as=avi';}
export function chainLabels(state){
 if(!NETWORKS[state.chainId]||!/^\d+$/.test(state.blockNumber)||!/^\d+$/.test(state.baseFeeWei)||!/^\d+$/.test(state.totalSupply)||!Number.isFinite(state.timestamp))throw Error('Unexpected chain feed');
 const base=Number(state.baseFeeWei)/1e9;
 return {head:'#'+Number(state.blockNumber).toLocaleString('en-US'),fee:(base===0?'0':base<.000001?base.toExponential(2):base.toFixed(6).replace(/0+$/,'').replace(/\.$/,''))+' GWEI',minted:Number(state.totalSupply).toLocaleString('en-US')+' MINTED'};
}
export function watchWorld({onState,onToken,onStatus}){
 let stopped=false,busy=false,loading=false,timer;const seen=new Set();
 async function loadToken(id){
  if(stopped||seen.has(id)||!/^\d{1,18}$/.test(id))return;
  try{const response=await fetch('/api/token?id='+id,{signal:AbortSignal.timeout(55000)});if(!response.ok)return;const token=await response.json();token.tokenId=id;if(validToken(token)){seen.add(id);if(!stopped)onToken(token);}}catch{/* Keep labelled demos when rendering is unavailable. */}
 }
 async function fillGallery(ids){
  if(loading||stopped)return;loading=true;
  try{for(const id of ids.filter(id=>!seen.has(String(id))).slice(0,2))await loadToken(String(id));}finally{loading=false;}
 }
 async function refresh(){
  if(stopped||busy||document.hidden)return;busy=true;
  try{
   const response=await fetch('/api/world',{cache:'no-store',signal:AbortSignal.timeout(22000)});if(!response.ok)throw Error('Unavailable');
   const state=await response.json(),labels=chainLabels(state);
   if(!stopped){onState(state,labels);onStatus(Date.now()/1000-state.timestamp<120?'live':'stale');}
   // Metadata renders are expensive. Read at most two previously unseen tokens per refresh, sequentially.
   fillGallery(state.tokenIds??[]);
  }catch{if(!stopped)onStatus('offline');}finally{busy=false;}
 }
 const minted=event=>{const token=event.detail;if(validToken(token)){seen.add(String(token.tokenId));onToken(token);}};
 const visible=()=>{if(!document.hidden)refresh();};
 document.addEventListener('visibilitychange',visible);window.addEventListener('blocks:artwork',minted);
 refresh();timer=setInterval(refresh,30000);
 return ()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('blocks:artwork',minted);};
}
