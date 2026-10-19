import deployment from '../dist/config.json' with {type:'json'};
import {serverRpc} from './_rpc.js';
const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const zero='0x'+'0'.repeat(64);
export function createHandler(settings,request=fetch){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
  const rpc=serverRpc(settings);
  if(!settings.deployed||!settings.collectionAddress||!rpc)return res.status(503).json({error:'Chain feed unavailable'});
  const call=async(method,params)=>{
   const response=await request(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('RPC unavailable');const body=await response.json();if(body.error||body.result===undefined)throw Error('RPC unavailable');return body.result;
  };
  try{
   const address=settings.collectionAddress;
   const [block,supply,latest]=await Promise.all([
    call('eth_getBlockByNumber',['latest',false]),
    call('eth_call',[{to:address,data:'0x18160ddd'},'latest']),
    call('eth_call',[{to:address,data:'0x8c0e8349'},'latest'])
   ]);
   const number=BigInt(block.number),total=BigInt(supply),last=BigInt(latest);
   const ids=new Set();if(last>0n)ids.add(String(last));
   // A short, bounded discovery window; the canonical latest/first tokens work even if logs are restricted.
   try{
    const logs=await call('eth_getLogs',[{address,fromBlock:'0x'+(number>2000n?number-2000n:0n).toString(16),toBlock:block.number,topics:[transfer,zero]}]);
    for(const log of logs.slice().reverse()){
     if(!log.removed&&log.address?.toLowerCase()===address.toLowerCase()&&log.topics?.[0]===transfer&&log.topics?.[1]===zero&&/^0x[0-9a-f]{64}$/i.test(log.topics?.[3]??''))ids.add(String(BigInt(log.topics[3])));
     if(ids.size>=8)break;
    }
   }catch{/* Some RPCs restrict logs. Never invent a mint. */}
   if(total>0n&&settings.firstTokenId)ids.add(String(settings.firstTokenId));
   // The last dozen blocks for the park's block stream, in one batched request; just the latest if batching is refused.
   const summary=b=>({number:String(BigInt(b.number)),timestamp:Number(BigInt(b.timestamp)),transactions:b.transactions.length,gasUsed:String(BigInt(b.gasUsed)),gasLimit:String(BigInt(b.gasLimit)),baseFeeWei:String(BigInt(b.baseFeePerGas??'0x0'))});
   const recent=[summary(block)];
   try{
    const batch=Array.from({length:11},(_,k)=>({jsonrpc:'2.0',id:k+2,method:'eth_getBlockByNumber',params:['0x'+(number-BigInt(k+1)).toString(16),false]}));
    const response=await request(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch),signal:AbortSignal.timeout(10000)});
    const rows=response.ok?await response.json():null;
    if(Array.isArray(rows))for(const row of rows.sort((p,q)=>p.id-q.id))if(row?.result?.number&&Array.isArray(row.result.transactions))recent.push(summary(row.result));
   }catch{/* The stream still gets the latest block. */}
   return res.status(200).setHeader('Cache-Control','public, max-age=12, s-maxage=12').json({chainId:settings.chainId,blockNumber:String(number),timestamp:Number(BigInt(block.timestamp)),baseFeeWei:String(BigInt(block.baseFeePerGas??'0x0')),gasUsed:String(BigInt(block.gasUsed)),gasLimit:String(BigInt(block.gasLimit)),transactions:block.transactions.length,totalSupply:String(total),recent,tokenIds:[...ids].slice(0,8),observedAt:Date.now()});
  }catch{return res.status(502).json({error:'Chain feed temporarily unavailable'});}
 };
}
export default createHandler(deployment);
