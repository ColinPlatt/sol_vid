#!/usr/bin/env python3
"""Validate onchain AVI, static poster and player independently, without transcoding."""
import argparse,base64,hashlib,json,re,subprocess,sys,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
from PIL import Image
from vapor_reference import traits,frame,THEMES,MOTIONS
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'previews/video'
def sha(data):return hashlib.sha256(data).hexdigest()
def unpack(uri):
    prefix='data:application/json;base64,';assert uri.startswith(prefix)
    m=json.loads(base64.b64decode(uri[len(prefix):],validate=True))
    assert 'image/gif' not in uri
    assert m['image'].startswith('data:image/svg+xml;base64,')
    assert m['animation_url'].startswith('data:text/html,')
    html=unquote(m['animation_url'][len('data:text/html,'):])
    assert 'http://' not in html and 'https://' not in html and 'fetch(' not in html
    payload=re.search(r'const encoded="([A-Za-z0-9+/]+={0,2})";',html).group(1)
    media=base64.b64decode(payload,validate=True)
    return m,media,base64.b64decode(m['image'].split(',',1)[1],validate=True)
def poster(svg,expected):
    root=ET.fromstring(svg);assert root.attrib['viewBox']=='0 0 64 64'
    rgb=bytearray(64*64*3);coverage=set()
    for path in root:
        assert path.tag=='{http://www.w3.org/2000/svg}path'
        match=re.fullmatch(r'M(\d+) (\d+)h(\d+)v1H(\d+)z',path.attrib['d']);assert match
        x,y,w,back=map(int,match.groups());assert x==back and x+w<=64 and y<64
        colour=bytes.fromhex(path.attrib['fill'][1:]);assert len(colour)==3
        for xx in range(x,x+w):
            assert (xx,y) not in coverage;coverage.add((xx,y));rgb[(y*64+xx)*3:(y*64+xx+1)*3]=colour
    assert len(coverage)==4096 and bytes(rgb)==expected,'Poster differs from frame zero'
def inspect(path,seed):
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(path)]))['streams'][0]
    size=info['width'];assert size in (256,512) and info['height']==size
    assert info['codec_name']=='msrle' and info['avg_frame_rate']=='25/1' and int(info['nb_read_frames'])==50 and abs(float(info['duration'])-2)<1e-9
    proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-f','rawvideo','-pix_fmt','rgba','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    hashes=[]
    try:
        for f in range(50):
            raw=proc.stdout.read(size*size*4);assert len(raw)==size*size*4
            expected=Image.frombytes('RGB',(64,64),frame(f,25,seed)[0]).resize((size,size),Image.Resampling.NEAREST).convert('RGBA').tobytes()
            assert raw==expected,f'{path.name} frame {f} differs from independent RGB reference'
            hashes.append(sha(raw))
        assert not proc.stdout.read(1)
        err=proc.stderr.read();assert proc.wait()==0 and not err,err
    finally:
        if proc.poll() is None:proc.kill();proc.wait()
    frame.cache_clear()
    return hashes
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['amsterdam','base'],required=True);args=parser.parse_args()
subprocess.run([sys.executable,str(ROOT/'scripts/build_video_player.py'),'--check'],check=True)
rows=[];paths=[];expected_hashes=[];coverage=set()
for path in sorted((OUT/'matrix').glob('*.uri'),key=lambda p:int(p.stem)):
    record=json.loads(path.with_suffix('.json').read_text());seed=int(record['seed']);r=traits(seed)
    key=(r['scene']-7,r['theme'],r['motion']);assert int(path.stem)==key[0]+4*key[1]+16*key[2];coverage.add(key)
    assert record['gas']<=500_000_000
    metadata,media,svg=unpack(path.read_text());attrs={a['trait_type']:a['value'] for a in metadata['attributes']}
    assert attrs['Art Version']=='GHOULBALLS_VAPOR_V3' and attrs['Seed']==str(seed) and attrs['FPS']==25 and attrs['Ball Count']==r['ball_count'] and attrs['Width']==attrs['Height']==512
    assert attrs['Theme']==THEMES[r['theme']] and attrs['Motion']==MOTIONS[r['motion']]
    for i,ball in enumerate(r['balls'],1):assert attrs[f'Ball {i} Colour']=='0x'+ball['colour'][1:] and attrs[f'Ball {i} Radius']==ball['radius']
    avi=path.with_suffix('.avi');avi.write_bytes(media);poster(svg,frame(0,25,seed)[0])
    hashes=inspect(avi,seed);paths.append(str(avi));expected_hashes.append(hashes)
    rows.append(dict(record,media_bytes=len(media),media_sha256=sha(media),poster_sha256=sha(svg),frame_hashes=hashes))
assert len(coverage)==64,'Run all VideoMatrixTest cases before validation'
# One Node process avoids repeated startup; it uses the exact embedded decoder source.
players=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/validate_avi_player.mjs'),*paths]))
for player,hashes in zip(players,expected_hashes,strict=True):assert player['hashes']==hashes and player['fps']==25,'Embedded player differs from FFmpeg'
for size in (256,512):inspect(OUT/f'avi-rle-{size}-42.avi',42)
metadata,media,svg=unpack((OUT/'nft-metadata.bin').read_text());seed=int((OUT/'nft-seed.txt').read_text());poster(svg,frame(0,25,seed)[0]);assert media==(OUT/'nft-video.bin').read_bytes()
assert metadata['animation_url']==(OUT/'nft-animation.bin').read_text()
(OUT/'nft-player.html').write_text(unquote(metadata['animation_url'][len('data:text/html,'):]))
report={'scope':'Current development source; deployed release evidence remains pinned separately','profile':args.profile,'budget':500_000_000,'matrix_cases':64,'frames_per_case':50,'width':512,'height':512,'fps':25,'duration_seconds':2,'full_metadata_max_gas':max(r['gas'] for r in rows),'full_metadata_min_gas':min(r['gas'] for r in rows),'full_metadata_max_bytes':max(r['bytes'] for r in rows),'rgb_reference':'all frames exact','embedded_decoder':'all frames equal FFmpeg RGBA','poster':'all first frames exact','marketplace_playback':'not_checked','rows':rows}
(OUT/f'validation-{args.profile}-development.json').write_text(json.dumps(report,indent=2)+'\n')
print(f"PASS {args.profile}: 64 artwork combinations × 50 exact RGB frames, embedded decoder, posters; max full metadata {report['full_metadata_max_gas']:,} gas / {report['full_metadata_max_bytes']:,} bytes. Marketplace playback unverified.")
