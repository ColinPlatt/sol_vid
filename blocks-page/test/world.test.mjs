import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../api/world.js';
import {chainLabels,validToken} from '../dist/world.mjs';
const address='0x'+'a'.repeat(40),transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',zero='0x'+'0'.repeat(64);
const settings={deployed:true,collectionAddress:address,chainId:11155111,firstTokenId:10};
function response(){return {code:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};}
test('chain feed pins RPC and collection, bounds log discovery and includes first/latest mints',async()=>{
 const before=process.env.SEPOLIA_RPC_URL;process.env.SEPOLIA_RPC_URL='https://example.invalid';const requests=[];
 try{
  const handler=createHandler(settings,async(url,options)=>{
   assert.equal(url,'https://example.invalid');const req=JSON.parse(options.body);requests.push(req);
   let result;
   if(req.method==='eth_getBlockByNumber')result={number:'0x1000',timestamp:'0x10',baseFeePerGas:'0x1',gasUsed:'0x10',gasLimit:'0x20',transactions:['0x1','0x2']};
   else if(req.method==='eth_call'){assert.equal(req.params[0].to,address);result=req.params[0].data==='0x18160ddd'?'0x03':'0x0fff';}
   else result=[{address,topics:[transfer,zero,zero,'0x'+'ffe'.padStart(64,'0')]},{address,removed:true,topics:[transfer,zero,zero,'0x'+'ffd'.padStart(64,'0')]}];
   return {ok:true,json:async()=>({result})};
  });
  const res=response();await handler({method:'GET',query:{rpc:'https://attacker.invalid'}},res);
  assert.equal(res.code,200);assert.deepEqual(res.body.tokenIds,['4095','4094','10']);assert.equal(res.body.totalSupply,'3');assert.equal(res.body.transactions,2);
  const filter=requests.find(r=>r.method==='eth_getLogs').params[0];assert.equal(BigInt(filter.toBlock)-BigInt(filter.fromBlock),2000n);assert.equal(filter.address,address);assert.deepEqual(filter.topics,[transfer,zero]);
 }finally{if(before===undefined)delete process.env.SEPOLIA_RPC_URL;else process.env.SEPOLIA_RPC_URL=before;}
});
test('restricted logs keep canonical mints; failed RPC never returns invented chain data',async()=>{
 const before=process.env.SEPOLIA_RPC_URL;process.env.SEPOLIA_RPC_URL='https://example.invalid';
 try{
  const handler=createHandler(settings,async(url,options)=>{
   const req=JSON.parse(options.body);if(req.method==='eth_getLogs')throw Error('Log restriction');
   return {ok:true,json:async()=>({result:req.method==='eth_getBlockByNumber'?{number:'0x11',timestamp:'0x1',baseFeePerGas:'0x0',gasUsed:'0x0',gasLimit:'0x20',transactions:[]}:req.params[0].data==='0x18160ddd'?'0x1':'0xa'})};
  });
  const res=response();await handler({method:'GET'},res);assert.equal(res.code,200);assert.deepEqual(res.body.tokenIds,['10']);
  const failed=response();await createHandler(settings,async()=>{throw Error('offline');})({method:'GET'},failed);assert.equal(failed.code,502);assert.equal(failed.headers['Cache-Control'],'no-store');assert.equal(failed.body.blockNumber,undefined);
 }finally{if(before===undefined)delete process.env.SEPOLIA_RPC_URL;else process.env.SEPOLIA_RPC_URL=before;}
});
test('chain labels preserve tiny fees and reject other networks; gallery accepts only embedded GIFs',()=>{
 assert.equal(chainLabels({chainId:11155111,blockNumber:'123',baseFeeWei:'1',totalSupply:'2',timestamp:1}).fee,'1.00e-9 GWEI');
 assert.throws(()=>chainLabels({chainId:8453}));
 assert.equal(validToken({tokenId:'123',image:'https://example.com/a.gif'}),false);
 assert.equal(validToken({tokenId:'123',image:'data:image/gif;base64,R0lGODlh'}),true);
});
