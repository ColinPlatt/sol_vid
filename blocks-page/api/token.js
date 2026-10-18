const COLLECTION='0xedff9b1dfb79ba12fde25fc8c1aadb730a3b5825';
export function decodeToken(result,id){
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(result??''))throw Error('Invalid contract response');
 const raw=Buffer.from(result.slice(2),'hex');
 const offset=Number(BigInt('0x'+raw.subarray(0,32).toString('hex')));
 if(!Number.isSafeInteger(offset)||offset<32||offset+32>raw.length)throw Error('Invalid metadata offset');
 const length=Number(BigInt('0x'+raw.subarray(offset,offset+32).toString('hex')));
 if(!Number.isSafeInteger(length)||length>3500000||offset+32+length>raw.length)throw Error('Invalid metadata length');
 const uri=raw.subarray(offset+32,offset+32+length).toString('utf8');
 if(!uri.startsWith('data:application/json;base64,'))throw Error('Unexpected metadata');
 const metadata=JSON.parse(Buffer.from(uri.split(',',2)[1],'base64').toString('utf8'));
 if(!metadata.image?.startsWith('data:image/svg+xml,'))throw Error('Unexpected image');
 const svg=decodeURIComponent(metadata.image.slice('data:image/svg+xml,'.length));
 const match=svg.match(/href=['"](data:image\/gif;base64,[A-Za-z0-9+/=]+)['"]/);
 if(!match||!Array.isArray(metadata.attributes))throw Error('Unexpected onchain GIF');
 return {tokenId:id,name:metadata.name,attributes:metadata.attributes,image:match[1]};
}
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
 const id=req.query.id;
 if(typeof id!=='string'||!/^\d{1,18}$/.test(id))return res.status(400).json({error:'Enter a valid epoch number'});
 const rpc=process.env.SEPOLIA_RPC_URL;
 if(!rpc)return res.status(503).json({error:'Artwork reads are temporarily unavailable. Try again shortly.'});
 try{
  const response=await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:COLLECTION,data:'0xc87b56dd'+BigInt(id).toString(16).padStart(64,'0'),gas:'0x1dcd6500'},'latest']}),signal:AbortSignal.timeout(50000)});
  if(!response.ok)throw Error('RPC unavailable');const body=await response.json();
  if(body.error){const missing=/nonexistent|0x7e273289|ERC721NonexistentToken/i.test(JSON.stringify(body.error));return res.status(missing?404:502).setHeader('Cache-Control','no-store').json({error:missing?'That epoch has not been minted.':'Could not read the artwork. Try again shortly.'});}
  const token=decodeToken(body.result,id);return res.status(200).setHeader('Cache-Control','public, max-age=86400, s-maxage=31536000, immutable').json(token);
 }catch{return res.status(502).setHeader('Cache-Control','no-store').json({error:'Could not render the artwork. Try again shortly.'});}
}
