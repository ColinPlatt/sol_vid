// Hash every embedded decoder frame for comparison with independently decoded FFmpeg RGBA.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const records=[];
for(const path of process.argv.slice(2)){
  const uri=await readFile(path.replace(/\.avi$/, '.uri'),'utf8');
  const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64'));
  const html=decodeURIComponent(metadata.animation_url.slice('data:text/html,'.length));
  const script=html.match(/<script>([\s\S]*)<\/script>/)[1].split('\ntry{')[0];
  const context=vm.createContext({Uint8Array,Uint8ClampedArray,DataView});
  vm.runInContext(script,context);
  const media=new Uint8Array(await readFile(path));
  assert.deepEqual(Buffer.from(html.match(/const encoded="([A-Za-z0-9+/=]+)";/)[1],'base64'),Buffer.from(media));
  const movie=context.decodeAVI(media);
  records.push({path,width:movie.width,height:movie.height,fps:movie.fps,hashes:movie.frames.map(frame=>createHash('sha256').update(frame).digest('hex'))});
}
console.log(JSON.stringify(records));
