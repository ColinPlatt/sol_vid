import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{decodeToken,createHandler} from '../api/token.js';
const gif='R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const metadata={name:'ALLEY #1',attributes:[{trait_type:'Block',value:1}],image:"data:image/svg+xml,"+encodeURIComponent("<svg><image href='data:image/gif;base64,"+gif+"'/></svg>")};
function encoded(m){const uri='data:application/json;base64,'+Buffer.from(JSON.stringify(m)).toString('base64');const raw=Buffer.from(uri);return '0x'+'20'.padStart(64,'0')+raw.length.toString(16).padStart(64,'0')+raw.toString('hex');}
test('returns the original embedded GIF and traits without an SVG wrapper',()=>{const token=decodeToken(encoded(metadata),'1');assert.equal(token.image,'data:image/gif;base64,'+gif);assert.equal(token.name,metadata.name);assert.deepEqual(token.attributes,metadata.attributes);});
test('rejects malformed ABI and external media',()=>{assert.throws(()=>decodeToken('0x','1'));assert.throws(()=>decodeToken(encoded({...metadata,image:'https://example.com/a.gif'}),'1'));});
test('invalid IDs cannot reach RPC',async()=>{let status;const res={status(n){status=n;return this;},json(){return this;}};await handler({method:'GET',query:{id:'../2'}},res);assert.equal(status,400);});

test('unconfirmed deployment cannot perform an artwork RPC read',async()=>{let status;const res={status(n){status=n;return this;},json(){return this;}};await createHandler({deployed:false,collectionAddress:null})({method:'GET',query:{id:'13000000'}},res);assert.equal(status,503);});

test('confirmed deployment reads only its fixed contract with the full static-call cap',async()=>{
 const savedFetch=globalThis.fetch,savedRPC=process.env.SEPOLIA_RPC_URL;let status,body,request;
 try{
  process.env.SEPOLIA_RPC_URL='https://example.invalid/rpc';
  globalThis.fetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({result:encoded(metadata)})};};
  const res={status(n){status=n;return this;},setHeader(){return this;},json(value){body=value;return this;}};
  const collection='0x'+'b'.repeat(40);
  await createHandler({deployed:true,collectionAddress:collection})({method:'GET',query:{id:'1'}},res);
  assert.equal(status,200);assert.equal(body.image,'data:image/gif;base64,'+gif);
  assert.equal(request.params[0].to,collection);assert.equal(BigInt(request.params[0].gas),500000000n);
  assert.equal(request.params[0].data,'0xc87b56dd'+'1'.padStart(64,'0'));
 }finally{globalThis.fetch=savedFetch;if(savedRPC===undefined)delete process.env.SEPOLIA_RPC_URL;else process.env.SEPOLIA_RPC_URL=savedRPC;}
});
