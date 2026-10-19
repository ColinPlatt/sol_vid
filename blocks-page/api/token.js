// BLOCKS_VIDEO_V4 token reads. The JSON keeps the onchain name, traits and native SVG poster; the lossless AVI
// is a separate immutable response so the street can animate it. Only a block number reaches the fixed contract.
import deployment from '../dist/config.json' with {type:'json'};
import {serverRpc} from './_rpc.js';
const SELECTORS={json:'0xc87b56dd',avi:'0x169aef4a',player:'0x5209ec17'}; // tokenURI, video, animationURI (uint256)
export const videoPath=id=>'/api/token?id='+id+'&as=avi';
function abiBytes(result,limit){
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(result??''))throw Error('Invalid contract response');
 const raw=Buffer.from(result.slice(2),'hex');
 const offset=Number(BigInt('0x'+raw.subarray(0,32).toString('hex')));
 if(!Number.isSafeInteger(offset)||offset<32||offset+32>raw.length)throw Error('Invalid metadata offset');
 const length=Number(BigInt('0x'+raw.subarray(offset,offset+32).toString('hex')));
 if(!Number.isSafeInteger(length)||length>limit||offset+32+length>raw.length)throw Error('Invalid metadata length');
 return raw.subarray(offset+32,offset+32+length);
}
export function decodeToken(result,id){
 const uri=abiBytes(result,4000000).toString('utf8');
 if(!uri.startsWith('data:application/json;base64,'))throw Error('Unexpected metadata');
 const metadata=JSON.parse(Buffer.from(uri.split(',',2)[1],'base64').toString('utf8'));
 if(!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(metadata.image??'')||!Array.isArray(metadata.attributes))throw Error('Unexpected onchain poster');
 if(!metadata.animation_url?.startsWith('data:text/html,'))throw Error('Unexpected onchain player');
 return {tokenId:id,name:metadata.name,attributes:metadata.attributes,image:metadata.image,video:videoPath(id)};
}
export function decodeVideo(result){
 const movie=abiBytes(result,2000000);
 if(movie.subarray(0,4).toString('latin1')!=='RIFF'||movie.subarray(8,12).toString('latin1')!=='AVI ')throw Error('Unexpected onchain video');
 return movie;
}
export function decodePlayer(result){
 const uri=abiBytes(result,4000000).toString('utf8');
 if(!uri.startsWith('data:text/html,'))throw Error('Unexpected onchain player');
 return Buffer.from(decodeURIComponent(uri.slice('data:text/html,'.length)));
}
export function createHandler(settings){
const COLLECTION=settings.collectionAddress;
return async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
 const {id,as='json'}=req.query;
 if(typeof id!=='string'||!/^\d{1,18}$/.test(id))return res.status(400).json({error:'Enter a valid block number'});
 if(!Object.hasOwn(SELECTORS,as))return res.status(400).json({error:'Unknown format'});
 if(!settings.deployed||!COLLECTION)return res.status(503).json({error:'The single-block edition is not open yet.'});
 const rpc=serverRpc(settings);
 if(!rpc)return res.status(503).json({error:'Artwork reads are temporarily unavailable. Try again shortly.'});
 try{
  const data=SELECTORS[as]+BigInt(id).toString(16).padStart(64,'0');
  const response=await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:COLLECTION,data,gas:'0x1dcd6500'},'latest']}),signal:AbortSignal.timeout(55000)});
  if(!response.ok)throw Error('RPC unavailable');const body=await response.json();
  if(body.error){const missing=/nonexistent|0x7e273289|ERC721NonexistentToken/i.test(JSON.stringify(body.error));return res.status(missing?404:502).setHeader('Cache-Control','no-store').json({error:missing?'That block has not been minted.':'Could not read the artwork. Try again shortly.'});}
  res.setHeader('Cache-Control','public, max-age=86400, s-maxage=31536000, immutable');
  if(as==='json')return res.status(200).json(decodeToken(body.result,id));
  res.setHeader('X-Content-Type-Options','nosniff');
  // The onchain player runs in an opaque origin, as on marketplaces.
  if(as==='player'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy','sandbox allow-scripts');return res.status(200).send(decodePlayer(body.result));}
  res.setHeader('Content-Type','video/x-msvideo');res.setHeader('Content-Disposition',`inline; filename="blocks-${id}.avi"`);
  return res.status(200).send(decodeVideo(body.result));
 }catch{return res.status(502).setHeader('Cache-Control','no-store').json({error:'Could not render the artwork. Try again shortly.'});}
};
}
export default createHandler(deployment);
