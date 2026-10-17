#!/usr/bin/env python3
"""Check both contract RLE8 examples against FFmpeg and the independent RGB artwork."""
import json,subprocess
from pathlib import Path
from PIL import Image
from vapor_reference import frame
ROOT=Path(__file__).resolve().parents[1]
for size in (256,512):
    path=ROOT/f'previews/video/avi-rle-{size}-42.avi'
    stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(path)]))['streams'][0]
    assert stream['codec_name']=='msrle' and stream['avg_frame_rate']=='25/1' and int(stream['nb_read_frames'])==50
    assert stream['width']==stream['height']==size and abs(float(stream['duration'])-2)<1e-9
    decoder=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for f in range(50):
            actual=decoder.stdout.read(size*size*3)
            expected=Image.frombytes('RGB',(64,64),frame(f,25,42)[0]).resize((size,size),Image.Resampling.NEAREST).tobytes()
            assert actual==expected,f'{size}px frame {f} differs from reference'
        assert not decoder.stdout.read(1)
        error=decoder.stderr.read();assert decoder.wait()==0 and not error,error
    finally:
        if decoder.poll() is None:decoder.kill();decoder.wait()
    print(f'PASS {size}px BI_RLE8: 50 exact RGB frames at 25fps, two seconds')
