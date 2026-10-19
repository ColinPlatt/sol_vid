#!/usr/bin/env python3
"""Independently check the Solidity AVI, native SVG first frame, palette recipe and variation samples."""
import base64
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'previews/ARCHIVE/blocks-video'
NAMES=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']

def recolour(palette,r):
    permutations=[(0,1,2),(2,0,1),(1,2,0),(1,0,2),(2,1,0),(0,2,1)]
    result=[]
    for i in range(0,len(palette),3):
        colour=[palette[i+j] for j in permutations[r['colourway']]]
        if r['light']==1:colour=[v*7//8 for v in colour]
        if r['light']==2:colour=[18+v*237//255 for v in colour]
        result.extend(colour)
    return bytes(result)

def badge(indices,scene,r,bottom_up=False):
    data=bytearray(indices)
    if scene<6:
        top=22 if scene==2 else 19
        def row(y):return (127-y if bottom_up else y)*128
        for y in range(top,top+11):data[row(y)+39:row(y)+89]=bytes([240])*50
        for chip in range(6):
            colour=(5+(r['colourway']+chip)%6)*16+r['light']*3
            for y in range(top+4,top+7):data[row(y)+42+chip*7:row(y)+46+chip*7]=bytes([colour])*4
    return bytes(data)

def ffmpeg(path):
    result=subprocess.run(['ffmpeg','-v','error','-threads','1','-i',str(path),'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'],capture_output=True,check=True)
    assert not result.stderr
    return result.stdout

rows=[];panels=[]
for name in NAMES:
    stem=OUT/name;record=json.loads(stem.with_suffix('.json').read_text());assert record['metadata_gas']<=500000000
    movie=stem.with_suffix('.avi').read_bytes();reference=Path(str(stem)+'.reference.avi').read_bytes()
    assert len(movie)==len(reference)==1477976
    palette=bytes(c for i in range(256) for c in reference[212+i*4:215+i*4][::-1])
    palette=recolour(palette,record)
    assert bytes(c for i in range(256) for c in movie[212+i*4:215+i*4][::-1])==palette
    expected=[]
    for f in range(90):
        source=(record['phase']+(-f if record['reverse'] else f))%90
        start=1256+source*16392;indices=badge(reference[start:start+16384],record['scene'],record,True)
        assert movie[1256+f*16392:1256+f*16392+16384]==indices
        image=Image.frombytes('P',(128,128),indices).transpose(Image.Transpose.FLIP_TOP_BOTTOM);image.putpalette(palette);expected.append(image.convert('RGB').tobytes())
    assert ffmpeg(stem.with_suffix('.avi'))==b''.join(expected)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(stem.with_suffix('.avi'))]))['streams'][0]
    assert probe['avg_frame_rate']=='15/1' and int(probe['nb_read_frames'])==90 and abs(float(probe['duration'])-6)<1e-8
    uri=stem.with_suffix('.uri').read_text();metadata=json.loads(base64.b64decode(uri.split(',',1)[1],validate=True));assert 'gif' not in metadata['image'].lower()
    svg=base64.b64decode(metadata['image'].split(',',1)[1],validate=True);tree=ET.fromstring(svg)
    assert tree.tag=='{http://www.w3.org/2000/svg}svg' and len(tree)>0
    # Independent rasterization of the deliberately tiny native SVG path subset; no bitmap or script is allowed.
    poster=bytearray(128*128*3);covered=set()
    for path in tree:
        assert path.tag=='{http://www.w3.org/2000/svg}path'
        assert re.fullmatch('#[0-9a-f]{6}',path.attrib['stroke'])
        assert re.fullmatch(r'(?:M\d+ \d+\.5h\d+)+',path.attrib['d'])
        colour=bytes.fromhex(path.attrib['stroke'][1:])
        for match in re.finditer(r'M(\d+) (\d+)\.5h(\d+)',path.attrib['d']):
            x,y,w=map(int,match.groups());assert y<128 and x+w<=128 and w>0
            for px in range(x,x+w):
                assert (px,y) not in covered;covered.add((px,y));offset=(y*128+px)*3;poster[offset:offset+3]=colour
    assert len(covered)==16384 and poster==expected[0]
    stem.with_suffix('.svg').write_bytes(svg)
    rows.append(dict(name=name,metadata_gas=record['metadata_gas'],avi_bytes=len(movie),svg_bytes=len(svg),token_uri_bytes=len(uri),first_frame_rgb_sha256=hashlib.sha256(poster).hexdigest()))
    panel=Image.frombytes('RGB',(128,128),poster).resize((256,256),Image.Resampling.NEAREST);panels.append(panel)
    print(f'PASS {name}: all 90 AVI frames match independent recipe; SVG is exactly frame 0; metadata {record["metadata_gas"]:,} gas')

unique=set();within={};colourways=Counter();lights=Counter();directions=Counter();phases=Counter()
contact=Image.new('RGB',(8*128,32*128))
for scene,name in enumerate(NAMES):
    seen=set()
    for k in range(32):
        stem=OUT/f'samples/{scene}/{k}';r=json.loads(stem.with_suffix('.json').read_text());indices=badge(stem.with_suffix('.raw').read_bytes(),scene,r);palette=recolour(stem.with_suffix('.palette').read_bytes(),r)
        image=Image.frombytes('P',(128,128),indices);image.putpalette(palette);image=image.convert('RGB');digest=hashlib.sha256(image.tobytes()).hexdigest();seen.add(digest);unique.add(digest)
        contact.paste(image,(scene*128,k*128));colourways[r['colourway']]+=1;lights[r['light']]+=1;directions[str(r['reverse'])]+=1;phases[r['phase']]+=1
    within[name]=len(seen);assert len(seen)==32
assert len(unique)==256 and len(colourways)==6 and len(lights)==3 and len(directions)==2
contact.save(OUT/'variation-256.png')
poster_grid=Image.new('RGB',(4*256,2*256))
for i,panel in enumerate(panels):poster_grid.paste(panel,(i%4*256,i//4*256))
poster_grid.save(OUT/'posters.png')
report=dict(profile='default',compiler='0.8.37',evm='amsterdam',status='passed',scenes=rows,
            variation=dict(samples=256,distinct_rgb_first_frames=len(unique),distinct_per_scene=within,colourways=dict(colourways),lights=dict(lights),directions=dict(directions),distinct_phases=len(phases),
                           methodology='32 independently rendered entropy samples per scene, holding block number and timestamp fixed; not a guarantee of future uniqueness'))
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS 256/256 distinct first-frame images with fixed block labels; all six colourways, three light levels and both directions represented')
subprocess.run(['python3',str(ROOT/'scripts/build_blocks_video_player.py'),'--check'],check=True)
subprocess.run(['node',str(ROOT/'scripts/validate_blocks_video_player.mjs')],cwd=ROOT,check=True)
