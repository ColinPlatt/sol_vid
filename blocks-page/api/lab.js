// Art lab renders: the deployed BLOCKS_SINGLE_V1 renderer draws a simulated block whose prevrandao is the study seed.
// Only an integer seed is accepted; the 3,520-byte input is built here, so no caller calldata reaches the RPC.
import deployment from '../dist/config.json' with {type:'json'};
import {artwork,labInfo,hex} from '../dist/lab/blockseed.mjs';
const GIF='0xfe84d2b6'; // gif(bytes)
export function decodeBytes(result){
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(result??''))throw Error('Invalid renderer response');
 const raw=Buffer.from(result.slice(2),'hex'),offset=Number(BigInt('0x'+raw.subarray(0,32).toString('hex')));
 if(!Number.isSafeInteger(offset)||offset<32||offset+32>raw.length)throw Error('Invalid offset');
 const length=Number(BigInt('0x'+raw.subarray(offset,offset+32).toString('hex')));
 if(!Number.isSafeInteger(length)||length>3000000||offset+32+length>raw.length)throw Error('Invalid length');
 const gif=raw.subarray(offset+32,offset+32+length);if(gif.subarray(0,6).toString('latin1')!=='GIF89a')throw Error('Not a GIF');return gif;
}
export function calldata(n){
 const e=artwork(labInfo(n)).slice();return GIF+(32).toString(16).padStart(64,'0')+e.length.toString(16).padStart(64,'0')+hex(e).slice(2);
}
export function createHandler(settings,fetcher=fetch){
 return async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
  const n=req.query.n;
  if(typeof n!=='string'||!/^\d{1,7}$/.test(n))return res.status(400).json({error:'Seed must be an integer from 0 to 9,999,999'});
  const rpc=process.env.SEPOLIA_RPC_URL;
  if(!rpc||!settings.rendererAddress)return res.status(503).json({error:'Lab renders are unavailable.'});
  try{
   const response=await fetcher(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:settings.rendererAddress,data:calldata(Number(n)),gas:'0x1dcd6500'},'latest']}),signal:AbortSignal.timeout(50000)});
   if(!response.ok)throw Error('RPC unavailable');const body=await response.json();if(body.error)throw Error('Render failed');
   const gif=decodeBytes(body.result);
   res.setHeader('Content-Type','image/gif');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=31536000, immutable');return res.status(200).send(gif);
  }catch{return res.status(502).setHeader('Cache-Control','no-store').json({error:'Could not render this seed. Try again shortly.'});}
 };
}
export default createHandler(deployment);
