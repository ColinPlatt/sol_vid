#!/usr/bin/env python3
"""Independently decode the metadata captured from an actual deployed video token."""
import argparse,base64,hashlib,json,re,subprocess
from pathlib import Path
from urllib.parse import unquote
from PIL import Image
from vapor_reference import frame
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('kind',choices=['candidate','edition']);args=parser.parse_args()
uri=(ROOT/f'previews/video/live-{args.kind}-metadata.uri').read_text()
metadata=json.loads(base64.b64decode(uri.split(',',1)[1],validate=True));attrs={a['trait_type']:a['value'] for a in metadata['attributes']}
assert attrs['Format']=='AVI BI_RLE8' and attrs['FPS']==25 and attrs['Width']==attrs['Height']==512
seed=int(attrs['Seed']);html=unquote(metadata['animation_url'].split(',',1)[1]);encoded=re.search(r'const encoded="([A-Za-z0-9+/]+={0,2})";',html).group(1)
media=base64.b64decode(encoded,validate=True);path=ROOT/f'previews/video/live-{args.kind}.avi';path.write_bytes(media)
stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(path)]))['streams'][0]
assert stream['codec_name']=='msrle' and stream['width']==stream['height']==512 and int(stream['nb_read_frames'])==50 and stream['avg_frame_rate']=='25/1' and float(stream['duration'])==2
p=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
hashes=[]
try:
    for f in range(50):
        raw=p.stdout.read(512*512*3);expected=Image.frombytes('RGB',(64,64),frame(f,25,seed)[0]).resize((512,512),Image.Resampling.NEAREST).tobytes()
        assert raw==expected,f'Live frame {f} differs from independent reference'
        hashes.append(hashlib.sha256(raw).hexdigest())
    assert not p.stdout.read(1);error=p.stderr.read();assert p.wait()==0 and not error,error
finally:
    if p.poll() is None:p.kill();p.wait()
record={'kind':args.kind,'source':'metadata captured from confirmed Base token 1','seed':str(seed),'media_bytes':len(media),'media_sha256':hashlib.sha256(media).hexdigest(),'frames':50,'fps':25,'duration_seconds':2,'independent_rgb':'every pixel exact','frame_hashes':hashes}
(ROOT/f'previews/video/live-{args.kind}-validation.json').write_text(json.dumps(record,indent=2)+'\n')
print(f'PASS actual Base {args.kind}: all 50 frames match the independent RGB reference; {len(media):,} original AVI bytes.')
