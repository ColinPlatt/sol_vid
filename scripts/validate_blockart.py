#!/usr/bin/env python3
"""Check Solidity GIF/AVI exports against raw contract frames using independent decoders.

This verifies the encoders, palette, complete metadata and timing. It does not
claim pixel identity with the higher-resolution canvas concepts.
"""
import argparse
import base64
import hashlib
import io
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'previews/blockart'
SCENES=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']

def validate(name):
    stem=OUT/name
    record=json.loads(stem.with_suffix('.json').read_text())
    assert all(record[key]<=500_000_000 for key in ('gif_gas','avi_gas','token_uri_gas'))
    assert record['runtime_bytes']<=24576
    stress=json.loads(stem.with_suffix('.stress.json').read_text())
    assert stress['gas']<=500_000_000 and stress['profile']==record['profile']
    record['dense_synthetic_metadata_gas']=stress['gas']
    palette=stem.with_suffix('.palette').read_bytes()
    raw=stem.with_suffix('.raw').read_bytes()
    assert len(palette)==768 and len(raw)==90*128*128
    frames=[]
    for f in range(90):
        indexed=Image.frombytes('P',(128,128),raw[f*16384:(f+1)*16384])
        indexed.putpalette(palette)
        frames.append(indexed.convert('RGB').tobytes())
    unique_frames=len(set(frames))
    assert unique_frames>1,f'{name}: animation is static'
    expected=b''.join(frames)
    gif=stem.with_suffix('.gif').read_bytes()
    pil=Image.open(io.BytesIO(gif))
    assert pil.size==(128,128) and pil.n_frames==90 and pil.info['loop']==0
    delays=[]
    for f in range(90):
        pil.seek(f);delays.append(pil.info['duration'])
        assert pil.convert('RGB').tobytes()==frames[f],f'{name}: Pillow frame {f}'
    assert sum(delays)==6000 and set(delays)=={60,70}
    for extension in ('.gif','.avi'):
        path=stem.with_suffix(extension)
        result=subprocess.run(['ffmpeg','-v','error','-threads','1','-i',str(path),'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'],capture_output=True,check=True)
        assert not result.stderr and result.stdout==expected,f'{name}: FFmpeg {extension} differs'
    stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(stem.with_suffix('.avi'))]))['streams'][0]
    assert stream['width']==stream['height']==128 and stream['avg_frame_rate']=='15/1'
    assert int(stream['nb_read_frames'])==90 and abs(float(stream['duration'])-6)<1e-6
    uri=stem.with_suffix('.uri').read_text()
    assert uri.startswith('data:application/json;base64,')
    metadata=json.loads(base64.b64decode(uri.split(',',1)[1],validate=True))
    image=unquote(metadata['image'])
    assert image.startswith('data:image/svg+xml,')
    svg=ET.fromstring(image.split(',',1)[1])
    embedded=svg[0].attrib['href']
    assert embedded.startswith('data:image/gif;base64,')
    assert base64.b64decode(embedded.split(',',1)[1],validate=True)==gif
    attrs={x['trait_type']:x['value'] for x in metadata['attributes']}
    assert attrs['Art Version']=='NEO_TOKYO_BLOCKS_V1'
    assert attrs['Epoch']==5254696 and attrs['First Block']==52546960 and attrs['Duration Seconds']==6 and attrs['FPS']==15
    # All-slot test routing intentionally uses the fixture's real selected scene trait.
    assert metadata['name'].endswith('#5254696')
    record.update(scene=name,frames=90,unique_frames=unique_frames,width=128,height=128,duration_ms=6000,gif_sha256=hashlib.sha256(gif).hexdigest(),
                  rgb_sha256=hashlib.sha256(expected).hexdigest(),validation='All 90 raw contract frames equal Pillow GIF and FFmpeg GIF/AVI; strict metadata decode; frame-90 seam checked in Foundry')
    print(f"PASS {name}: GIF {record['gif_gas']:,}, AVI {record['avi_gas']:,}, metadata {record['token_uri_gas']:,} gas",flush=True)
    return record,Image.frombytes('RGB',(128,128),frames[45])

parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['base','blocks_base','default'],default='blocks_base');args=parser.parse_args()
rows=[];panels=[]
for name in SCENES:
    row,panel=validate(name);assert row['profile']==args.profile;rows.append(row);panels.append(panel)
artifact=json.loads((ROOT/'out/Canyon.sol/Canyon.json').read_text())
metadata=artifact['metadata'];metadata=json.loads(metadata) if isinstance(metadata,str) else metadata
report={'compiler':metadata['compiler']['version'],'evm_version':metadata['settings']['evmVersion'],'optimizer':metadata['settings']['optimizer'],'via_ir':metadata['settings'].get('viaIR',False),'profile':args.profile,'budget':500_000_000,'reference':'Raw Solidity raster frames, not canvas concept pixels','scenes':rows}
(OUT/f'validation-{args.profile}.json').write_text(json.dumps(report,indent=2)+'\n')
sheet=Image.new('RGB',(4*256,2*282),'#080819');draw=ImageDraw.Draw(sheet)
for i,(name,panel) in enumerate(zip(SCENES,panels)):
    x=(i%4)*256;y=(i//4)*282
    sheet.paste(panel.resize((256,256),Image.Resampling.NEAREST),(x,y));draw.text((x+8,y+262),name.upper(),fill='white')
sheet.save(OUT/'contact-sheet.png')
print('PASS all eight scenes: 720 frames per decoder; GIF metadata and native AVI agree')
