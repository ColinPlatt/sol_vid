// Hash every embedded decoder frame for comparison with independently decoded FFmpeg RGBA.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeAVI } from '../players/avi-rle.mjs';
const records=[];
for(const path of process.argv.slice(2)){
  const movie=decodeAVI(new Uint8Array(await readFile(path)));
  records.push({path,width:movie.width,height:movie.height,fps:movie.fps,hashes:movie.frames.map(frame=>createHash('sha256').update(frame).digest('hex'))});
}
console.log(JSON.stringify(records));
