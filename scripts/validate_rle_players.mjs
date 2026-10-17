// Exercise the exact HTML exported by a capped Solidity call, including its loop.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { decodeAVI } from '../players/avi-rle.mjs';
for (const size of [256, 512]) {
  const stem = `previews/video/avi-rle-${size}-42`;
  const uri = readFileSync(`${stem}.player.uri`, 'utf8');
  assert.ok(uri.startsWith('data:text/html,'));
  const html = decodeURIComponent(uri.slice('data:text/html,'.length));
  const payload = html.match(/const encoded="([A-Za-z0-9+/=]+)";/)[1];
  const avi = readFileSync(`${stem}.avi`);
  assert.deepEqual(Buffer.from(payload, 'base64'), avi);
  let callback, draws = 0;
  const button = {}, canvas = { getContext: () => ({ putImageData: () => ++draws }) };
  const context = vm.createContext({ Uint8Array, Uint8ClampedArray, DataView, atob,
    ImageData: class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } },
    document: { querySelector: s => s === 'canvas' ? canvas : button, body: {} },
    performance: { now: () => 40 }, requestAnimationFrame: cb => { callback = cb; } });
  context.window = context;
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  assert.equal(context.document.body.textContent, undefined);
  const movie = context.decodeAVI(new Uint8Array(avi));
  const ff = spawnSync('ffmpeg', ['-v','error','-threads','1','-i',`${stem}.avi`,'-f','rawvideo','-pix_fmt','rgba','-threads','1','pipe:1'],
    { maxBuffer: 60 * 1024 * 1024, timeout: 30000 });
  assert.equal(ff.status, 0, ff.stderr.toString());
  assert.equal(movie.frames.length, 50);
  movie.frames.forEach((frame, i) => assert.deepEqual(Buffer.from(frame), ff.stdout.subarray(i*size*size*4,(i+1)*size*size*4)));
  callback(0); callback(8); callback(16); callback(39);
  assert.equal(draws, 1);
  callback(40); assert.equal(draws, 2);
  button.onclick(); callback(1000); assert.equal(draws, 2);
  button.onclick(); callback(2040); assert.equal(context.__videoLoops, 1);
  for (const mutate of [b => b.writeUInt32LE(2,56), b => b.write('01dc',288), b => b.write('02db',288), b => b.write('auds',108)]) {
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
  console.log(`PASS ${size}px exact embedded decoder: 50 FFmpeg frames, loop, pause, redraw and stream guards`);
}
// Legal short rows and early EOB preserve the previous frame's untouched pixels.
const chunk = (id, data) => {
  const out = Buffer.alloc(8 + data.length + (data.length & 1));
  out.write(id); out.writeUInt32LE(data.length,4); data.copy(out,8); return out;
};
const list = (id, data) => chunk('LIST', Buffer.concat([Buffer.from(id), data]));
const avih = Buffer.alloc(56); avih.writeUInt32LE(40000); avih.writeUInt32LE(2,16); avih.writeUInt32LE(1,24);
const strh = Buffer.alloc(56); strh.write('vidsmrle'); strh.writeUInt32LE(1,20); strh.writeUInt32LE(25,24); strh.writeUInt32LE(2,32);
const strf = Buffer.alloc(48); strf.writeUInt32LE(40); strf.writeUInt32LE(64,4); strf.writeUInt32LE(64,8); strf.writeUInt16LE(1,12); strf.writeUInt16LE(8,14); strf.writeUInt32LE(1,16); strf.writeUInt32LE(2,32); strf[46]=255;
const first = Buffer.from([...Array.from({length:64},()=>[64,1,0,0]).flat(),0,1]);
const second = Buffer.from([2,0,0,0,0,1]);
const body = Buffer.concat([Buffer.from('AVI '), list('hdrl',Buffer.concat([chunk('avih',avih),list('strl',Buffer.concat([chunk('strh',strh),chunk('strf',strf)]))])),list('movi',Buffer.concat([chunk('00dc',first),chunk('00dc',second)]))]);
const fixture=chunk('RIFF',body), decoded=decodeAVI(fixture);
const fixturePath='previews/video/short-row-test.avi';
writeFileSync(fixturePath,fixture);
const ff=spawnSync('ffmpeg',['-v','error','-threads','1','-i',fixturePath,'-f','rawvideo','-pix_fmt','rgba','-threads','1','pipe:1'],{timeout:30000});
unlinkSync(fixturePath);
assert.equal(ff.status,0,ff.stderr.toString());
assert.deepEqual(Buffer.concat(decoded.frames.map(f=>Buffer.from(f))),ff.stdout);
console.log('PASS short RLE rows and early EOB agree with FFmpeg, including retained pixels');
