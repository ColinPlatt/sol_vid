#!/usr/bin/env python3
"""Independently decode probe metadata and prerecorded media controls."""
import argparse,base64,json,subprocess
from pathlib import Path
from urllib.parse import unquote_to_bytes
from xml.etree import ElementTree
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'previews/probe';F=ROOT/'fixtures/marketplace-probe'
def data(uri):
 head,body=uri.split(',',1)
 return base64.b64decode(body,validate=True) if head.endswith(';base64') else unquote_to_bytes(body)
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['amsterdam','base'],default='amsterdam');args=parser.parse_args()
records=json.loads((ART/f'measurements.{args.profile}.json').read_text());controls={}
assert len(records)==15
for record in records:
 token=record['token_id'];uri=(ART/f'token-{token}.uri.txt').read_text()
 assert len(uri)==record['uri_bytes']
 metadata=json.loads(data(uri));assert metadata['name'].startswith(f'ghoulballs probe #{token} - ')
 assert record['gas']<500000000
 if token<=7:
  assert record['target_gas']<=record['gas']<record['target_gas']+2000000
  assert 'animation_url' not in metadata
 else:assert record['gas']<40000000
 image=metadata['image']
 if token==14:
  svg=ElementTree.fromstring(data(image));assert svg.tag.endswith('svg')
  image=list(svg)[0].attrib['href'];assert 'pixelated' in list(svg)[0].attrib['style']
 assert data(image)==(F/'image-control.gif').read_bytes()
 animation=metadata.get('animation_url')
 if token in [8,9]:assert data(animation)==(F/'html-js.html').read_bytes()
 if token==10:
  assert data(animation)==(F/'html-css.html').read_bytes() and b'<script' not in data(animation)
 if token==11:assert len(data(animation))==600000
 if token==12:assert data(animation)==(F/'native-control.mp4').read_bytes()
 if token==13:assert animation.startswith('https://')
 controls[str(token)]=dict(image=metadata['image'],animation_url=animation)
 print(f"PASS {token:2}: {record['name']}: {record['gas']:,} gas, {len(uri):,} URI bytes")
with Image.open(F/'image-control.gif') as im:
 assert im.n_frames==4
 duration=0
 for f in range(im.n_frames):im.seek(f);duration+=im.info['duration']
 assert duration==2000
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(F/'native-control.mp4')]))['streams'][0]
assert probe['codec_name']=='h264' and probe['profile']=='Constrained Baseline'
assert int(probe['nb_read_frames'])==16 and float(probe['duration'])==2
(ART/'controls.json').write_text(json.dumps(controls,separators=(',',':'))+'\n')
print('Independent JSON, both HTML encodings, CSS, 600KB payload, SVG/GIF and H.264/MP4 controls verified.')
