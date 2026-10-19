// Exercise the exact HTML exported by a capped Solidity call, including its loop.
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { decodeAVI } from '../players/blocks-avi.mjs';
const fixtures=process.env.BLOCKS_VIDEO_FIXTURES??'blocks-video';
const names=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama',...readdirSync(`previews/${fixtures}`).filter(name=>/^stress-\d+\.json$/.test(name)).map(name=>name.slice(0,-5))];
for (const name of names) {
  const size=128,stem=`previews/${fixtures}/${name}`;
  const uri=readFileSync(`${stem}.uri`,'utf8');
  const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64'));
  const animation=metadata.animation_url;
  assert.ok(animation.startsWith('data:text/html,'));
  const html = decodeURIComponent(animation.slice('data:text/html,'.length));
  const payload = html.match(/const encoded="([A-Za-z0-9+/=]+)";/)[1];
  const avi = readFileSync(`${stem}.avi`);
  assert.deepEqual(Buffer.from(payload, 'base64'), avi);
  let callback, draws = 0;
  const button = {}, canvas = { getContext: () => ({ putImageData: () => ++draws }) };
  const context = vm.createContext({ Uint8Array, Uint8ClampedArray, DataView, atob,
    ImageData: class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } },
    document: { querySelector: s => s === 'canvas' ? canvas : button, body: {} },
    performance: { now: () => 67 }, requestAnimationFrame: cb => { callback = cb; } });
  context.window = context;
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  assert.equal(context.document.body.textContent, undefined);
  const movie = context.decodeAVI(new Uint8Array(avi));
  const ff = spawnSync('ffmpeg', ['-v','error','-threads','1','-i',`${stem}.avi`,'-f','rawvideo','-pix_fmt','rgba','-threads','1','pipe:1'],
    { maxBuffer: 60 * 1024 * 1024, timeout: 30000 });
  assert.equal(ff.status, 0, ff.stderr.toString());
  assert.equal(movie.frames.length, 90);
  movie.frames.forEach((frame, i) => assert.deepEqual(Buffer.from(frame), ff.stdout.subarray(i*size*size*4,(i+1)*size*size*4)));
  callback(0); callback(8); callback(16); callback(65);
  assert.equal(draws, 1);
  callback(67); assert.equal(draws, 2);
  button.onclick(); callback(1000); assert.equal(draws, 2);
  button.onclick(); callback(6067); assert.equal(context.__videoLoops, 1);
  for (const mutate of [b => b.writeUInt32LE(2,56), b => b.write('01dc',1248), b => b.write('02db',1248), b => b.write('auds',108)]) {
    const bad = Buffer.from(avi); mutate(bad);
    assert.throws(() => decodeAVI(bad), /Invalid or unsupported AVI/);
    assert.throws(() => context.decodeAVI(new Uint8Array(bad)), /Invalid or unsupported AVI/);
  }
  for (const [start, length] of [[100, 64], [164, 112]]) {
    const extra = avi.subarray(start, start + length);
    const bad = Buffer.concat([avi.subarray(0,276), extra, avi.subarray(276)]);
    for (const field of [4,16,92]) bad.writeUInt32LE(bad.readUInt32LE(field)+length,field);
    assert.throws(() => decodeAVI(bad), /Invalid or unsupported AVI/);
    assert.throws(() => context.decodeAVI(new Uint8Array(bad)), /Invalid or unsupported AVI/);
  }
  console.log(`PASS ${size}px exact embedded decoder: 90 FFmpeg frames, loop, pause, redraw and stream guards`);
}
