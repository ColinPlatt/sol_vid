import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeAvi,drawFrame} from '../dist/avi.mjs';
// ALLEY #52814599, the first Base BLOCKS_VIDEO_V4 token, as read from the deployed contract.
const live=name=>new URL('../../previews/blocks-video-v4-base-live/52814599.'+name,import.meta.url);
test('decodes the live V4 AVI and frame 0 matches its onchain SVG poster',async()=>{
  const movie=decodeAvi((await readFile(live('avi'))).buffer);
  assert.equal(movie.width,128);assert.equal(movie.height,128);assert.equal(movie.fps,15);assert.equal(movie.frames.length,90);
  const image=drawFrame(movie,0,{data:new Uint8ClampedArray(128*128*4)}),svg=await readFile(live('svg'),'utf8');let covered=0;
  for(const path of svg.matchAll(/<path[^>]*>/g)){
    const colour=path[0].match(/stroke=['"]#([0-9a-f]{6})['"]/i)[1],rgb=[0,2,4].map(i=>parseInt(colour.slice(i,i+2),16));
    for(const m of path[0].matchAll(/M(\d+) (\d+)\.5h(\d+)/g)){const [x,y,w]=m.slice(1).map(Number);
      for(let px=x;px<x+w;px++,covered++)assert.deepEqual([...image.data.subarray((y*128+px)*4,(y*128+px)*4+3)],rgb);}
  }
  assert.equal(covered,128*128);
});
test('rejects other media',()=>{
  assert.throws(()=>decodeAvi(new TextEncoder().encode('GIF89a......').buffer));
});
