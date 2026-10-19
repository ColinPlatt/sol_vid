// Art lab renders for a simulated Base block whose prevrandao is the study seed: the deployed BLOCKS_VIDEO_V3
// renderer on Base returns its poster, player or AVI. Only an integer seed and fixed options are accepted; the input
// is built here, so no caller calldata reaches the RPC.
import lab from '../dist/lab/data.json' with {type:'json'};
import {labInfo,infoWords,selector,hex} from '../dist/lab/blockseed.mjs';
import {serverRpc} from './_rpc.js';
const INFO='((uint256,uint256,uint256,uint256,uint256,address,uint256))';
// Each V3 output: renderer function, response type and a check of the decoded body.
export const V3={
 poster:{fn:'imageURI'+INFO,type:'image/svg+xml',body:s=>{const p='data:image/svg+xml;base64,';if(!s.startsWith(p))throw Error('Not a poster');return Buffer.from(s.slice(p.length),'base64');}},
 player:{fn:'animationURI'+INFO,type:'text/html; charset=utf-8',body:s=>{const p='data:text/html,';if(!s.startsWith(p))throw Error('Not a player');return Buffer.from(decodeURIComponent(s.slice(p.length)));}},
 avi:{fn:'video'+INFO,type:'video/x-msvideo',body:b=>{if(b.subarray(0,4).toString('latin1')!=='RIFF'||b.subarray(8,12).toString('latin1')!=='AVI ')throw Error('Not an AVI');return b;}}
};
export function abiBytes(result){
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(result??''))throw Error('Invalid renderer response');
 const raw=Buffer.from(result.slice(2),'hex'),offset=Number(BigInt('0x'+raw.subarray(0,32).toString('hex')));
 if(!Number.isSafeInteger(offset)||offset<32||offset+32>raw.length)throw Error('Invalid offset');
 const length=Number(BigInt('0x'+raw.subarray(offset,offset+32).toString('hex')));
 if(!Number.isSafeInteger(length)||length>4000000||offset+32+length>raw.length)throw Error('Invalid length');
 return raw.subarray(offset+32,offset+32+length);
}
export const calldataV3=(n,as)=>selector(V3[as].fn)+hex(infoWords(labInfo(n))).slice(2);
export function createHandler(live=lab?.v3_live,fetcher=fetch,env=process.env){
 return async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
  const {n,as='poster'}=req.query;
  if(typeof n!=='string'||!/^\d{1,7}$/.test(n))return res.status(400).json({error:'Seed must be an integer from 0 to 9,999,999'});
  if(!Object.hasOwn(V3,as))return res.status(400).json({error:'Output must be poster, player or avi'});
  const rpc=serverRpc({chainId:8453},env),to=live?.renderer;
  if(!rpc||!to)return res.status(503).json({error:'Lab renders are unavailable.'});
  try{
   const response=await fetcher(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to,data:calldataV3(Number(n),as),gas:'0x1dcd6500'},'latest']}),signal:AbortSignal.timeout(55000)});
   if(!response.ok)throw Error('RPC unavailable');const body=await response.json();if(body.error)throw Error('Render failed');
   const out=V3[as],raw=abiBytes(body.result);
   res.setHeader('Cache-Control','public, max-age=86400, s-maxage=31536000, immutable');
   res.setHeader('Content-Type',out.type);res.setHeader('X-Content-Type-Options','nosniff');
   // Opaque origin for anything opened directly; the onchain player alone may run its scripts, as on marketplaces.
   res.setHeader('Content-Security-Policy',as==='player'?'sandbox allow-scripts':'sandbox');
   if(as==='avi')res.setHeader('Content-Disposition',`attachment; filename="blocks-lab-${n}.avi"`);
   return res.status(200).send(out.body(as==='avi'?raw:raw.toString('utf8')));
  }catch{return res.status(502).setHeader('Cache-Control','no-store').json({error:'Could not render this seed. Try again shortly.'});}
 };
}
export default createHandler();
