import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,seed,artwork,sceneOf,hex,labInfo,recipeV3} from '../dist/lab/blockseed.mjs';
import {createHandler,calldata,calldataV3,decodeBytes} from '../api/lab.js';
// DESCENT #11941801 on Ethereum Sepolia: blockData and seedOf read from the deployed collection.
const minted={number:11941801n,timestamp:1792335288n,gasLimit:200000000n,baseFee:15n,prevrandao:71995491819252453186341901556748965843844316788138842243839516057809521824868n,beneficiary:'0xA214FD87626b00349F457154382c6eC6A2659D1c',chainId:11155111n};
test('keccak256 matches the standard empty-input vector',()=>{
  assert.equal(hex(keccak256(new Uint8Array())),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
});
test('seed and scene match the deployed contract for the first mint',()=>{
  assert.equal(hex(seed(minted)),'0xcdef9883b49f79635d8ed75452e121c851050bfb8ba17041880340feb566e67b');
  const e=artwork(minted);assert.equal(e.length,3520);assert.equal(sceneOf(e),1);assert.equal(sceneOf(seed(minted)),1);
});
// SKYLINE #11947754, the first BLOCKS_VIDEO_V3 token: blockData, seedOf and recipeOf read from the deployed collection.
const v3={number:11947754n,timestamp:1792407780n,gasLimit:199804498n,baseFee:15n,prevrandao:94670631418528385013265563793499145328362709652243097746357179823248838231256n,beneficiary:'0x1268AD189526AC0b386faF06eFfC46779c340eE6',chainId:11155111n};
test('V3 seed, scene and recipe match the deployed V3 collection',()=>{
  const s=seed(v3,'BLOCKS_VIDEO_V3');assert.equal(hex(s),'0x5026c1a1f8989b0170b82fa7f4b7562f194a9ac61700885b760ab56a9196d377');assert.equal(sceneOf(s),4);
  assert.deepEqual(recipeV3(v3),{hue:63,saturation:68,heightBand:7,density:0,layout:2,crop:2,pan:7,mirror:true,reverse:false,phase:7});
});
test('lab render calldata is gif(bytes) with the 3,520-byte input only',()=>{
  const data=calldata(42);assert.ok(data.startsWith('0xfe84d2b6'));assert.equal((data.length-10)/2,64+3520);
});
test('lab endpoint accepts only integer seeds and returns an immutable GIF',async()=>{
  const before=process.env.SEPOLIA_RPC_URL;process.env.SEPOLIA_RPC_URL='https://example.invalid';
  try{
    const gif=Buffer.concat([Buffer.from('GIF89a'),Buffer.alloc(10)]),encoded='0x'+(32).toString(16).padStart(64,'0')+gif.length.toString(16).padStart(64,'0')+gif.toString('hex').padEnd(64,'0');
    let sent;const handler=createHandler({rendererAddress:'0x'+'c'.repeat(40)},null,async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({result:encoded})};});
    const res=()=>({h:{},code:0,setHeader(k,v){this.h[k]=v;return this;},status(c){this.code=c;return this;},send(b){this.body=b;return this;},json(j){this.body=j;return this;}});
    const bad=res();await handler({method:'GET',query:{n:'0x10'}},bad);assert.equal(bad.code,400);
    const ok=res();await handler({method:'GET',query:{n:'7'}},ok);
    assert.equal(ok.code,200);assert.equal(ok.h['Content-Type'],'image/gif');assert.match(ok.h['Cache-Control'],/immutable/);
    assert.equal(sent.params[0].gas,'0x1dcd6500');assert.equal(sent.params[0].data,calldata(7));assert.deepEqual(decodeBytes(encoded),gif);
  }finally{process.env.SEPOLIA_RPC_URL=before;}
});
test('V3 lab outputs call the deployed renderer with only the Info tuple',async()=>{
  assert.equal(calldataV3(7,'poster').slice(0,10),'0x9ea3d4f8');assert.equal((calldataV3(7,'player').length-10)/2,7*32);
  const before=process.env.SEPOLIA_RPC_URL;process.env.SEPOLIA_RPC_URL='https://example.invalid';
  const abi=b=>'0x'+(32).toString(16).padStart(64,'0')+b.length.toString(16).padStart(64,'0')+b.toString('hex').padEnd(Math.ceil(b.length/32)*64,'0');
  const replies={'0x9ea3d4f8':abi(Buffer.from('data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64'))),
    [calldataV3(7,'player').slice(0,10)]:abi(Buffer.from('data:text/html,%3Cp%3Ehi')),[calldataV3(7,'avi').slice(0,10)]:abi(Buffer.concat([Buffer.from('RIFF\0\0\0\0AVI '),Buffer.alloc(8)]))};
  try{
    let sent;const handler=createHandler({rendererAddress:'0x'+'c'.repeat(40)},{renderer:'0x'+'d'.repeat(40)},async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({result:replies[sent.params[0].data.slice(0,10)]})};});
    const res=()=>({h:{},code:0,setHeader(k,v){this.h[k]=v;return this;},status(c){this.code=c;return this;},send(b){this.body=b;return this;},json(j){this.body=j;return this;}});
    const bad=res();await handler({method:'GET',query:{n:'7',v:'3',as:'gif'}},bad);assert.equal(bad.code,400);
    const poster=res();await handler({method:'GET',query:{n:'7',v:'3'}},poster);
    assert.equal(poster.code,200);assert.equal(poster.h['Content-Type'],'image/svg+xml');assert.equal(String(poster.body),'<svg/>');assert.equal(sent.params[0].to,'0x'+'d'.repeat(40));
    const player=res();await handler({method:'GET',query:{n:'7',v:'3',as:'player'}},player);
    assert.equal(String(player.body),'<p>hi');assert.equal(player.h['Content-Security-Policy'],'sandbox allow-scripts');
    const avi=res();await handler({method:'GET',query:{n:'7',v:'3',as:'avi'}},avi);assert.equal(avi.code,200);assert.match(avi.h['Content-Disposition'],/\.avi/);
  }finally{process.env.SEPOLIA_RPC_URL=before;}
});
test('lab seeds are simulated blocks varying only prevrandao',()=>{
  const a=labInfo(1),b=labInfo(2);assert.equal(a.number,b.number);assert.notEqual(hex(seed(a)),hex(seed(b)));
});
