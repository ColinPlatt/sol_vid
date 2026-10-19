"""Independent V3 palette/composition reference. Integer arithmetic mirrors the documented recipe, not EVM code."""
from Crypto.Hash import keccak
import numpy as np

def kh(data):
 h=keccak.new(digest_bits=256);h.update(data);return h.digest()
def word(n):return int(n).to_bytes(32,'big')
def tagged(seed,text):
 data=text.encode();return kh(seed+word(64)+word(len(data))+data.ljust((len(data)+31)//32*32,b'\0'))
def recipe(index):
 version=b'BLOCKS_VIDEO_V3'
 fields=[13000000,1800000000,60000000,20,index+1,0xBEEF,11155111]
 seed=kh(word(256)+b''.join(map(word,fields))+word(len(version))+version.ljust(32,b'\0'))
 h=int.from_bytes(tagged(seed,'composition'),'big')
 return dict(hue=h%360,saturation=65+(h>>16)%31,heightBand=(h>>24)%8,density=(h>>32)%4,layout=(h>>40)%4,
             crop=(h>>48)%4,pan=(h>>56)%9,mirror=bool((h>>64)&1),reverse=bool((h>>72)&1),phase=(h>>80)%90,
             tint=int.from_bytes(tagged(seed,'palette'),'big'),seed=seed)
def rgb(h,s,v):
 low=v*(100-s)//100;up=low+(v-low)*(h%60)//60;down=v-(v-low)*(h%60)//60
 return [(v,up,low),(down,v,low),(low,v,up),(low,down,v),(up,low,v),(v,low,down)][h//60]
def palette(source,r):
 source=np.asarray(source,dtype=np.uint8).reshape(256,3);tint=int(r['tint']).to_bytes(32,'big')
 return np.asarray([rgb((r['hue']+tint[i//16]*360//256)%360,15 if i//16==13 else r['saturation'],int(max(source[i]))) for i in range(256)],dtype=np.uint8)
def compose(indices,r):
 raw=np.asarray(indices,dtype=np.uint8).reshape(128,128)
 y=np.clip(r['crop']*4+np.arange(128)*(128-r['crop']*8)//128+r['pan']-4,0,127)
 return raw[y,::-1] if r['mirror'] else raw[y,:]
def badge(raw,scene):
 raw=np.array(raw,copy=True).reshape(128,128)
 if scene<6:
  top=22 if scene==2 else 19;raw[top:top+11,39:89]=240
  for chip in range(6):raw[top+4:top+7,42+chip*7:46+chip*7]=(5+chip)*16
 return raw

def canonical_crop(indices,r):
 """Exactly undo V3's reversible view over the shared source rows 32..111; no framing gets diversity credit."""
 raw=np.asarray(indices,dtype=np.uint8).reshape(128,128)
 source=np.clip(r['crop']*4+np.arange(128)*(128-r['crop']*8)//128+r['pan']-4,0,127)
 wanted=np.arange(32,112);rows=np.searchsorted(source,wanted)
 assert np.array_equal(source[rows],wanted)
 restored=raw[rows,:]
 return restored[:,::-1] if r['mirror'] else restored
