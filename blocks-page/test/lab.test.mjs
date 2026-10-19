import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,seed,artwork,sceneOf,hex,labInfo} from '../dist/lab/blockseed.mjs';
import {createHandler,calldata,decodeBytes} from '../api/lab.js';
// DESCENT #11941801 on Ethereum Sepolia: blockData and seedOf read from the deployed collection.
const minted={number:11941801n,timestamp:1792335288n,gasLimit:200000000n,baseFee:15n,prevrandao:71995491819252453186341901556748965843844316788138842243839516057809521824868n,beneficiary:'0xA214FD87626b00349F457154382c6eC6A2659D1c',chainId:11155111n};
test('keccak256 matches the standard empty-input vector',()=>{
  assert.equal(hex(keccak256(new Uint8Array())),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
});
test('seed and scene match the deployed contract for the first mint',()=>{
  assert.equal(hex(seed(minted)),'0xcdef9883b49f79635d8ed75452e121c851050bfb8ba17041880340feb566e67b');
  const e=artwork(minted);assert.equal(e.length,3520);assert.equal(sceneOf(e),1);assert.equal(sceneOf(seed(minted)),1);
});
test('lab render calldata is gif(bytes) with the 3,520-byte input only',()=>{
  const data=calldata(42);assert.ok(data.startsWith('0xfe84d2b6'));assert.equal((data.length-10)/2,64+3520);
});
test('lab endpoint accepts only integer seeds and returns an immutable GIF',async()=>{
  const before=process.env.SEPOLIA_RPC_URL;process.env.SEPOLIA_RPC_URL='https://example.invalid';
  try{
    const gif=Buffer.concat([Buffer.from('GIF89a'),Buffer.alloc(10)]),encoded='0x'+(32).toString(16).padStart(64,'0')+gif.length.toString(16).padStart(64,'0')+gif.toString('hex').padEnd(64,'0');
    let sent;const handler=createHandler({rendererAddress:'0x'+'c'.repeat(40)},async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({result:encoded})};});
    const res=()=>({h:{},code:0,setHeader(k,v){this.h[k]=v;return this;},status(c){this.code=c;return this;},send(b){this.body=b;return this;},json(j){this.body=j;return this;}});
    const bad=res();await handler({method:'GET',query:{n:'0x10'}},bad);assert.equal(bad.code,400);
    const ok=res();await handler({method:'GET',query:{n:'7'}},ok);
    assert.equal(ok.code,200);assert.equal(ok.h['Content-Type'],'image/gif');assert.match(ok.h['Cache-Control'],/immutable/);
    assert.equal(sent.params[0].gas,'0x1dcd6500');assert.equal(sent.params[0].data,calldata(7));assert.deepEqual(decodeBytes(encoded),gif);
  }finally{process.env.SEPOLIA_RPC_URL=before;}
});
test('lab seeds are simulated blocks varying only prevrandao',()=>{
  const a=labInfo(1),b=labInfo(2);assert.equal(a.number,b.number);assert.notEqual(hex(seed(a)),hex(seed(b)));
});
