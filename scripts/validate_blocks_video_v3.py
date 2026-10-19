#!/usr/bin/env python3
"""Validate every frame in V3 example videos against independent Python transforms, FFmpeg and the SVG poster."""
import argparse,base64,hashlib,json,re,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
import numpy as np
from PIL import Image
from blocks_diversity_reference import palette,compose,badge
ROOT=Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--directory',default='ARCHIVE/blocks-video-v3');parser.add_argument('--profile',default='default');args=parser.parse_args();OUT=ROOT/'previews'/args.directory;NAMES=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']
rows=[];panels=[]
cases=NAMES+sorted(f.stem for f in OUT.glob('stress-*.json'))
for name in cases:
 stem=OUT/name;r=json.loads(stem.with_suffix('.json').read_text());scene=r['scene']
 if name.startswith('stress-'):
  m=json.loads(base64.b64decode(stem.with_suffix('.uri').read_text().split(',',1)[1]));encoded=re.search(r'const encoded="([A-Za-z0-9+/=]+)";',unquote(m['animation_url'])).group(1);stem.with_suffix('.avi').write_bytes(base64.b64decode(encoded))
 movie=stem.with_suffix('.avi').read_bytes();reference=Path(str(stem)+'.reference.avi').read_bytes()
 assert r['metadata_gas']<=500000000 and len(movie)==len(reference)==1477976
 original=np.array([list(reference[212+i*4:215+i*4][::-1]) for i in range(256)],np.uint8);pal=palette(original,r)
 assert bytes(c for i in range(256) for c in movie[212+i*4:215+i*4][::-1])==pal.tobytes()
 expected=[]
 for frame in range(90):
  source=(r['phase']+(-frame if r['reverse'] else frame))%90
  raw=np.frombuffer(reference,dtype=np.uint8,offset=1256+source*16392,count=16384).reshape(128,128)[::-1]
  result=compose(badge(raw,scene),r)
  native=np.frombuffer(movie,dtype=np.uint8,offset=1256+frame*16392,count=16384).reshape(128,128)[::-1]
  assert np.array_equal(native,result),(name,frame)
  expected.append(pal[result].tobytes())
 decoded=subprocess.run(['ffmpeg','-v','error','-threads','1','-i',str(stem.with_suffix('.avi')),'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'],capture_output=True,check=True)
 assert not decoded.stderr and decoded.stdout==b''.join(expected)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(stem.with_suffix('.avi'))]))['streams'][0]
 assert probe['avg_frame_rate']=='15/1' and int(probe['nb_read_frames'])==90 and abs(float(probe['duration'])-6)<1e-8
 metadata=json.loads(base64.b64decode(stem.with_suffix('.uri').read_text().split(',',1)[1]));traits={t['trait_type']:t['value'] for t in metadata['attributes']};assert traits['Art Version']=='BLOCKS_VIDEO_V3'
 svg=base64.b64decode(metadata['image'].split(',',1)[1]);poster=bytearray(128*128*3);covered=set()
 for path in ET.fromstring(svg):
  assert path.tag=='{http://www.w3.org/2000/svg}path';assert re.fullmatch(r'(?:M\d+ \d+\.5h\d+)+',path.attrib['d']);colour=bytes.fromhex(path.attrib['stroke'][1:])
  for m in re.finditer(r'M(\d+) (\d+)\.5h(\d+)',path.attrib['d']):
   x,y,w=map(int,m.groups());assert y<128 and x+w<=128 and w>0
   for px in range(x,x+w):assert (px,y) not in covered;covered.add((px,y));poster[(y*128+px)*3:(y*128+px)*3+3]=colour
 assert len(covered)==16384 and poster==expected[0]
 stem.with_suffix('.svg').write_bytes(svg);
 if name in NAMES:panels.append(Image.frombytes('RGB',(128,128),poster))
 rows.append(dict(scene=name,metadata_gas=r['metadata_gas'],svg_bytes=len(svg),token_uri_bytes=stem.with_suffix('.uri').stat().st_size,first_frame_sha256=hashlib.sha256(poster).hexdigest()))
 print(f'PASS {name}: 90 frames, independent palette/composition, FFmpeg and SVG; {r["metadata_gas"]:,} gas',flush=True)
montage=Image.new('RGB',(4*256,2*256))
for i,image in enumerate(panels):montage.paste(image.resize((256,256),Image.Resampling.NEAREST),(i%4*256,i//4*256))
montage.save(OUT/'posters.png');(OUT/'validation.json').write_text(json.dumps(dict(version='BLOCKS_VIDEO_V3',profile=args.profile,evm='amsterdam' if args.profile=='default' else 'cancun',compiler='0.8.37',status='passed',scenes=rows,frames_validated=90*len(rows),limits='Selected examples and corpus-selected stress cases, not an exhaustive gas maximum or marketplace approval'),indent=2)+'\n')
