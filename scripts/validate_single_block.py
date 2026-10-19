#!/usr/bin/env python3
"""Independently decode all single-block GIF/AVI frames and their complete metadata."""
import base64,hashlib,io,json,subprocess
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'previews/ARCHIVE/blocks-single';rows=[]
for name in ['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']:
 stem=OUT/name;record=json.loads(stem.with_suffix('.json').read_text());assert record['metadata_gas']<=500000000
 palette=stem.with_suffix('.palette').read_bytes();raw=stem.with_suffix('.raw').read_bytes();assert len(palette)==768 and len(raw)==90*128*128
 frames=[]
 for f in range(90):
  frame=Image.frombytes('P',(128,128),raw[f*16384:(f+1)*16384]);frame.putpalette(palette);frames.append(frame.convert('RGB').tobytes())
 assert len(set(frames))>1;expected=b''.join(frames);gif=stem.with_suffix('.gif').read_bytes();image=Image.open(io.BytesIO(gif));assert image.n_frames==90 and image.info['loop']==0 and image.size==(128,128)
 duration=0
 for f in range(90):image.seek(f);assert image.convert('RGB').tobytes()==frames[f];duration+=image.info['duration']
 assert duration==6000
 for ext in ['gif','avi']:
  result=subprocess.run(['ffmpeg','-v','error','-threads','1','-i',str(stem.with_suffix('.'+ext)),'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'],capture_output=True,check=True);assert not result.stderr and result.stdout==expected
 uri=stem.with_suffix('.uri').read_text();metadata=json.loads(base64.b64decode(uri.split(',',1)[1],validate=True));attrs={t['trait_type']:t['value'] for t in metadata['attributes']}
 assert attrs['Art Version']=='BLOCKS_SINGLE_V1' and attrs['Block']==record['block'] and 'Epoch' not in attrs and 'Average Gas Used (bps)' not in attrs and 'animation_url' not in metadata
 svg=ET.fromstring(unquote(metadata['image']).split(',',1)[1]);assert base64.b64decode(svg[0].attrib['href'].split(',',1)[1],validate=True)==gif
 record.update(scene_name=name,frames=90,duration_ms=6000,width=128,height=128,gif_bytes=len(gif),avi_bytes=stem.with_suffix('.avi').stat().st_size,token_uri_bytes=len(uri),gif_sha256=hashlib.sha256(gif).hexdigest(),rgb_sha256=hashlib.sha256(expected).hexdigest())
 rows.append(record);print('PASS',name,f'{record["metadata_gas"]:,} metadata gas; all 90 frames agree',flush=True)
(OUT/'validation.json').write_text(json.dumps({'recipe':'BLOCKS_SINGLE_V1','compiler':'0.8.37+commit.f401782d','evm_version':'amsterdam','budget':500000000,'reference':'raw contract frames, Pillow GIF and FFmpeg GIF/AVI','scenes':rows},indent=2)+'\n')
