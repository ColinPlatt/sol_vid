import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{decodeToken,decodeVideo,decodePlayer,createHandler} from '../api/token.js';
const poster='data:image/svg+xml;base64,'+Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString('base64');
const metadata={name:'夜景 SKYLINE #1',attributes:[{trait_type:'Art Version',value:'BLOCKS_VIDEO_V3'}],image:poster,animation_url:'data:text/html,%3Cp%3E'};
const avi=Buffer.concat([Buffer.from('RIFF\0\0\0\0AVI '),Buffer.alloc(20)]);
const abi=raw=>'0x'+'20'.padStart(64,'0')+raw.length.toString(16).padStart(64,'0')+raw.toString('hex');
const encoded=m=>abi(Buffer.from('data:application/json;base64,'+Buffer.from(JSON.stringify(m)).toString('base64')));
test('returns the onchain name, traits, SVG poster and a video path, without the player',()=>{
 const token=decodeToken(encoded(metadata),'1');
 assert.deepEqual(token,{tokenId:'1',name:metadata.name,attributes:metadata.attributes,image:poster,video:'/api/token?id=1&as=avi'});
});
test('rejects malformed ABI, external media and non-AVI video',()=>{
 assert.throws(()=>decodeToken('0x','1'));
 assert.throws(()=>decodeToken(encoded({...metadata,image:'https://example.com/a.svg'}),'1'));
 assert.throws(()=>decodeToken(encoded({...metadata,animation_url:'https://example.com/'}),'1'));
 assert.throws(()=>decodeVideo(abi(Buffer.from('GIF89a'))));assert.throws(()=>decodePlayer(abi(Buffer.from('https://example.com'))));assert.deepEqual(decodeVideo(abi(avi)),avi);
});
test('invalid IDs and formats cannot reach RPC',async()=>{
 let status;const res={status(n){status=n;return this;},json(){return this;}};
 await handler({method:'GET',query:{id:'../2'}},res);assert.equal(status,400);
 await handler({method:'GET',query:{id:'2',as:'gif'}},res);assert.equal(status,400);
});

test('unconfirmed deployment cannot perform an artwork RPC read',async()=>{let status;const res={status(n){status=n;return this;},json(){return this;}};await createHandler({deployed:false,collectionAddress:null})({method:'GET',query:{id:'13000000'}},res);assert.equal(status,503);});

test('confirmed deployment reads only its fixed contract with the full static-call cap',async()=>{
 const savedFetch=globalThis.fetch,savedRPC=process.env.SEPOLIA_RPC_URL;let status,body,request;const headers={};
 try{
  process.env.SEPOLIA_RPC_URL='https://example.invalid/rpc';
  globalThis.fetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({result:request.params[0].data.startsWith('0x169aef4a')?abi(avi):request.params[0].data.startsWith('0x5209ec17')?abi(Buffer.from('data:text/html,%3Cp%3E')):encoded(metadata)})};};
  const res={status(n){status=n;return this;},setHeader(k,v){headers[k]=v;return this;},json(value){body=value;return this;},send(value){body=value;return this;}};
  const collection='0x'+'b'.repeat(40),read=createHandler({deployed:true,collectionAddress:collection});
  await read({method:'GET',query:{id:'1'}},res);
  assert.equal(status,200);assert.equal(body.image,poster);assert.equal(body.video,'/api/token?id=1&as=avi');
  assert.equal(request.params[0].to,collection);assert.equal(BigInt(request.params[0].gas),500000000n);
  assert.equal(request.params[0].data,'0xc87b56dd'+'1'.padStart(64,'0'));
  await read({method:'GET',query:{id:'1',as:'avi'}},res);
  assert.equal(status,200);assert.deepEqual(body,avi);assert.equal(headers['Content-Type'],'video/x-msvideo');assert.match(headers['Cache-Control'],/immutable/);
  assert.equal(request.params[0].data,'0x169aef4a'+'1'.padStart(64,'0'));
  await read({method:'GET',query:{id:'1',as:'player'}},res);
  assert.equal(String(body),'<p>');assert.equal(headers['Content-Security-Policy'],'sandbox allow-scripts');assert.equal(request.params[0].data,'0x5209ec17'+'1'.padStart(64,'0'));
 }finally{globalThis.fetch=savedFetch;if(savedRPC===undefined)delete process.env.SEPOLIA_RPC_URL;else process.env.SEPOLIA_RPC_URL=savedRPC;}
});
