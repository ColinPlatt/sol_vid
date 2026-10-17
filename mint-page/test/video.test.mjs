import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseVideoURI, validateVideoConfig, tokenId, readVideoCall, submitVideoMint } from '../dist/video/video.mjs';
import { decodeAVI } from '../../players/avi-rle.mjs';
const config=JSON.parse(await readFile(new URL('../dist/video-config.json',import.meta.url)));
const uri=await readFile(new URL('../../previews/video/nft-metadata.bin',import.meta.url),'utf8');
test('undeployed video release remains disabled',async()=>{
  const disabled=structuredClone(config);disabled.mintEnabled=false;disabled.playbackVerified=false;Object.assign(disabled.networks[0],{deployed:false,collectionAddress:null,rendererAddress:null});
  assert.equal(validateVideoConfig(disabled).mintEnabled,false);
  let contacted=false;
  await assert.rejects(submitVideoMint({request(){contacted=true;}},disabled,'0x'+'a'.repeat(40)),/awaiting/);
  assert.equal(contacted,false);
  const invalid=structuredClone(disabled);invalid.mintEnabled=true;
  assert.throws(()=>validateVideoConfig(invalid),/checks/);
});
test('parse contract metadata and extract original AVI without executing HTML',()=>{
  const video=parseVideoURI(uri);assert.equal(video.attributes.FPS,25);assert.equal(video.attributes.Width,512);
  assert.equal(video.avi.length>1000,true);assert.match(video.animation,/^data:text\/html,/);
  const movie=decodeAVI(video.avi);assert.equal(movie.frames.length,50);assert.equal(movie.width,512);
  assert.throws(()=>parseVideoURI('https://example.com/metadata'),/Unsupported/);
});
test('reject invalid IDs and malformed AVI',()=>{
  for(const id of [0,6668,-1,'1.5','01','0x1','<script>'])assert.throws(()=>tokenId(id));
  assert.equal(tokenId('6667'),'6667');
  const bytes=parseVideoURI(uri).avi;
  assert.throws(()=>decodeAVI(bytes.slice(0,-1)),/Invalid/);
  const corrupt=bytes.slice();corrupt.fill(255,280,284);assert.throws(()=>decodeAVI(corrupt),/Invalid/);
});
test('full metadata reads request 500M and retry a failed provider',async()=>{
  const network={...config.networks[0],deployed:true,collectionAddress:'0x'+'a'.repeat(40),renderRpcUrls:['https://first.test','https://second.test'],rpcUrl:'https://second.test'};
  const calls=[];
  const result=await readVideoCall(network,'0xc87b56dd',async(url,options)=>{
    calls.push(url);assert.equal(JSON.parse(options.body).params[0].gas,'0x1dcd6500');
    if(calls.length===1)return{ok:false,status:429};return{ok:true,json:async()=>({result:'0x1234'})};
  });assert.equal(result,'0x1234');assert.equal(calls.length,2);
});
