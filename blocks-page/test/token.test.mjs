import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{decodeToken} from '../api/token.js';
const gif='R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const metadata={name:'ALLEY #1',attributes:[{trait_type:'Epoch',value:1}],image:"data:image/svg+xml,"+encodeURIComponent("<svg><image href='data:image/gif;base64,"+gif+"'/></svg>")};
function encoded(m){const uri='data:application/json;base64,'+Buffer.from(JSON.stringify(m)).toString('base64');const raw=Buffer.from(uri);return '0x'+'20'.padStart(64,'0')+raw.length.toString(16).padStart(64,'0')+raw.toString('hex');}
test('returns the original embedded GIF and traits without an SVG wrapper',()=>{const token=decodeToken(encoded(metadata),'1');assert.equal(token.image,'data:image/gif;base64,'+gif);assert.equal(token.name,metadata.name);assert.deepEqual(token.attributes,metadata.attributes);});
test('rejects malformed ABI and external media',()=>{assert.throws(()=>decodeToken('0x','1'));assert.throws(()=>decodeToken(encoded({...metadata,image:'https://example.com/a.gif'}),'1'));});
test('invalid IDs cannot reach RPC',async()=>{let status;const res={status(n){status=n;return this;},json(){return this;}};await handler({method:'GET',query:{id:'../2'}},res);assert.equal(status,400);});

test('unconfirmed deployment cannot perform an artwork RPC read',async()=>{let status;const res={status(n){status=n;return this;},json(){return this;}};await handler({method:'GET',query:{id:'13000000'}},res);assert.equal(status,503);});
