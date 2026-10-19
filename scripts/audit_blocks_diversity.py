#!/usr/bin/env python3
"""Audit actual canonical Solidity frames. No serial, changed block labels, phase or reverse playback gets uniqueness credit.
Dependencies: numpy, scipy, faiss-cpu, Pillow, pycryptodome. Native corpus: BlocksDiversityAuditTest (opt-in).
"""
import argparse,hashlib,json,os,time
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import gaussian_filter
import faiss
from blocks_diversity_reference import recipe,canonical_crop
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'previews/blocks-diversity-v3';SIZE=17153;BATCH=192
NAMES=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']

_maps={}
def image_at(index,normalized=False):
 batch=index//BATCH
 if batch not in _maps:_maps[batch]=np.memmap(OUT/'raw'/f'{batch}.bin',dtype=np.uint8,mode='r').reshape(-1,SIZE)
 raw=_maps[batch][index%BATCH]
 indices=raw[769:].reshape(128,128)
 if normalized:indices=canonical_crop(indices,recipe(index))
 return raw[1:769].reshape(256,3)[indices]
def descriptor(image):
 # Discard caption/header bands; this is artwork geometry and colour, not the token label.
 return np.asarray(Image.fromarray(image).resize((16,10),Image.Resampling.BOX),dtype=np.float32).ravel()/255

def ssim(a,b):
 # Luminance SSIM, 5x5 Gaussian support. Independent of colour distance below.
 if a.ndim==3:a=a@np.array([.2126,.7152,.0722]);b=b@np.array([.2126,.7152,.0722])
 ma=gaussian_filter(a,1);mb=gaussian_filter(b,1)
 va=np.maximum(gaussian_filter(a*a,1)-ma*ma,0);vb=np.maximum(gaussian_filter(b*b,1)-mb*mb,0)
 cov=gaussian_filter(a*b,1)-ma*mb
 return float(np.mean(((2*ma*mb+.01**2)*(2*cov+.03**2))/((ma*ma+mb*mb+.01**2)*(va+vb+.03**2))))
def thumb(image):return np.asarray(Image.fromarray(image).resize((32,20),Image.Resampling.BOX),dtype=np.float32)/255

def main():
 p=argparse.ArgumentParser();p.add_argument('--count',type=int,default=100000);p.add_argument('--wait-for-export',action='store_true');p.add_argument('--baseline',type=Path);args=p.parse_args();n=args.count
 baseline=None
 if args.baseline:
  baseline=json.loads((args.baseline/'audit.json').read_text());assert baseline['samples']==n and baseline['status']=='passed'
  assert baseline['method']['near_threshold']=='RGB RMSE <=0.035 AND luminance SSIM >=0.98; at most 0.1% tokens in flagged pairs'
  for name,digest in baseline['native_corpus_sha256'].items():assert hashlib.sha256((args.baseline/'raw'/name).read_bytes()).hexdigest()==digest,name
  old_near=[row for row in baseline['closest_pairs'] if row['rgb_rmse']<=.035 and row['luminance_ssim']>=.98]
  assert len(old_near)==baseline['near_duplicate_pairs'] and all(row['scene']=='descent' for row in old_near),'Baseline has unaccounted unchanged near pairs'
 OUT.mkdir(exist_ok=True);features=np.empty((n,480),np.float32);geometry=np.empty((n,160),np.float32);thumbnails=np.empty((n,20,32,3),np.uint8);scenes=np.empty(n,np.uint8)
 exact={};grey={};duplicates=[];grey_duplicates=[];hist=Counter();traits={name:Counter() for name in ['hue','saturation','heightBand','density','layout','crop','pan','mirror']};checksums={};stress=[None]*8;dense=[None]*8;start=time.time()
 for batch in range((n+BATCH-1)//BATCH):
  file=OUT/'raw'/f'{batch}.bin';expected=min(BATCH,n-batch*BATCH)
  if args.wait_for_export:
   while not file.exists() or file.stat().st_size!=expected*SIZE:time.sleep(1)
  data=file.read_bytes();assert len(data)==expected*SIZE,(file,len(data),expected)
  checksums[file.name]=hashlib.sha256(data).hexdigest()
  records=np.frombuffer(data,dtype=np.uint8).reshape(expected,SIZE)
  if baseline:
   before=np.frombuffer((args.baseline/'raw'/file.name).read_bytes(),dtype=np.uint8).reshape(expected,SIZE)
   unchanged=records[:,0]!=1
   assert np.array_equal(records[unchanged],before[unchanged]),'An unaudited scene changed'
  for j,record in enumerate(records):
   i=batch*BATCH+j;scene=int(record[0]);scenes[i]=scene;hist[NAMES[scene]]+=1
   r=recipe(i);indices=canonical_crop(record[769:],r);image=record[1:769].reshape(256,3)[indices]
   h=int.from_bytes(r['seed'],'big');assert scene==(7 if (h>>216)&255<4 else (h>>224)%7)
   for name,counts in traits.items():counts[str(r[name])]+=1
   raw=record[769:].reshape(128,128);runs=128+int(np.count_nonzero(raw[:,1:]!=raw[:,:-1]));item=(runs,i)
   if stress[scene] is None or item>stress[scene]:stress[scene]=item
   if r['heightBand']==7 and r['density']==3 and r['mirror'] and (dense[scene] is None or item>dense[scene]):dense[scene]=item
   crop=image;digest=hashlib.sha256(crop.tobytes()).digest()
   if digest in exact:duplicates.append([exact[digest],i])
   exact[digest]=i
   # Palette-index geometry is audited separately so recolouring cannot conceal identical compositions.
   key=hashlib.sha256(indices.tobytes()).digest()
   if key in grey:grey_duplicates.append([grey[key],i])
   grey[key]=i;features[i]=descriptor(image)
   thumbnails[i]=np.asarray(Image.fromarray(image).resize((32,20),Image.Resampling.BOX))
   geometry[i]=np.asarray(Image.fromarray(image.max(axis=2)).resize((16,10),Image.Resampling.BOX),dtype=np.float32).ravel()/255
  if batch%50==0:print(f'FEATURES {min(n,(batch+1)*BATCH)}/{n}',flush=True)
 (OUT/'stress-seeds.json').write_text(json.dumps(dict(indices=[item[1] for item in stress]+[(dense[i] or stress[i])[1] for i in range(8)],selection='Highest canonical poster row-run count per scene, then highest among height band 7/density 3/mirrored samples; audit Info and phase fixed as documented'),indent=2)+'\n')
 # Search each scene independently so rare rural pieces get the same neighbour scrutiny as regular scenes.
 faiss.omp_set_num_threads(min(8,os.cpu_count() or 1));pairs=set();geometry_pairs=set()
 for scene in range(8):
  ids=np.flatnonzero(scenes==scene);f=np.ascontiguousarray(features[ids]);k=min(9,len(ids))
  index=faiss.IndexHNSWFlat(480,32);index.hnsw.efConstruction=160;index.hnsw.efSearch=192;index.add(f)
  _,near=index.search(f,k)
  for i,neighbours in enumerate(near):
   for neighbour in neighbours:
    a,b=int(ids[i]),int(ids[neighbour])
    if a!=b:pairs.add(tuple(sorted((a,b))))
  gf=np.ascontiguousarray(geometry[ids]);gi=faiss.IndexHNSWFlat(160,32);gi.hnsw.efConstruction=160;gi.hnsw.efSearch=192;gi.add(gf);_,gn=gi.search(gf,k)
  for i,neighbours in enumerate(gn):
   for neighbour in neighbours:
    a,b=int(ids[i]),int(ids[neighbour])
    if a!=b:geometry_pairs.add(tuple(sorted((a,b))))
  print(f'NEIGHBOURS {NAMES[scene]} {len(ids)}',flush=True)
 # Global exact search includes cross-scene pairs. BOX downsampling contracts L2;
 # 2/255 covers both stages' integer rounding, so all passing fine-image pairs are candidates.
 projected=features.reshape(-1,5,2,4,4,3).mean(axis=(2,4)).reshape(-1,60)
 exact_index=faiss.IndexFlatL2(60);exact_index.add(projected)
 radius=60*(.035+2/255)**2+1e-5;fine_radius=480*(.035+2/255)**2+1e-5
 queries=np.flatnonzero(scenes==1) if baseline else np.arange(n)
 for first in range(0,len(queries),256):
  query_ids=queries[first:first+256]
  limits,distances,neighbours=exact_index.range_search(projected[query_ids],radius)
  for q in range(len(limits)-1):
   a=int(query_ids[q]);ids=neighbours[limits[q]:limits[q+1]];ids=ids[ids!=a] if baseline else ids[ids>a]
   if not len(ids):continue
   delta=features[ids]-features[a];ids=ids[np.einsum('ij,ij->i',delta,delta)<=fine_radius]
   for b in ids:pairs.add(tuple(sorted((a,int(b)))))
  if first%6400==0:print(f'EXACT RADIUS {first}/{len(queries)}',flush=True)
 # Refine the most similar descriptor candidates. A far coarse image cannot meet the strict fine-image MAE gate.
 candidates=[]
 for a,b in pairs:
  d=float(np.mean(np.abs(features[a]-features[b])))
  if d<=.06:candidates.append((d,a,b))
 candidates.sort();near=[];worst=[]
 def ssim_batch(a,b):
  if a.ndim==4:a=a@np.array([.2126,.7152,.0722],dtype=np.float32);b=b@np.array([.2126,.7152,.0722],dtype=np.float32)
  sigma=(0,1,1);ma=gaussian_filter(a,sigma);mb=gaussian_filter(b,sigma)
  va=np.maximum(gaussian_filter(a*a,sigma)-ma*ma,0);vb=np.maximum(gaussian_filter(b*b,sigma)-mb*mb,0)
  cov=gaussian_filter(a*b,sigma)-ma*mb
  return np.mean(((2*ma*mb+.01**2)*(2*cov+.03**2))/((ma*ma+mb*mb+.01**2)*(va+vb+.03**2)),axis=(1,2))
 for first in range(0,len(candidates),512):
  batch=candidates[first:first+512];ids=np.array([(a,b) for _,a,b in batch],dtype=np.int64)
  aa=thumbnails[ids[:,0]].astype(np.float32)/255;bb=thumbnails[ids[:,1]].astype(np.float32)/255
  mae=np.mean(np.abs(aa-bb),axis=(1,2,3));rmse=np.sqrt(np.mean((aa-bb)**2,axis=(1,2,3)))
  # Every possible passing pair gets SSIM; a fixed closest-candidate subset also gets human-review scores.
  selected=np.flatnonzero((rmse<=.035)|(np.arange(first,first+len(batch))<2000))
  if len(selected):
   similarities=ssim_batch(aa[selected],bb[selected])
   for j,z in enumerate(selected):
    a,b=map(int,ids[z]);similarity=float(similarities[j]);error=float(mae[z]);root=float(rmse[z])
    row=dict(a=a,b=b,scene=NAMES[int(scenes[a])],rgb_mae=error,rgb_rmse=root,luminance_ssim=similarity,score=similarity-error)
    worst.append(row)
    if root<=.035 and similarity>=.98:near.append(row)
  if first%32768==0:print(f'REFINE {first}/{len(candidates)}',flush=True)
 structure_close=[];structural=list(geometry_pairs)
 for first in range(0,len(structural),2048):
  ids=np.array(structural[first:first+2048],dtype=np.int64);aa=geometry[ids[:,0]];bb=geometry[ids[:,1]]
  selected=np.flatnonzero(np.mean(np.abs(aa-bb),axis=1)<=.025)
  if not len(selected):continue
  scores=ssim_batch(aa[selected].reshape(-1,10,16),bb[selected].reshape(-1,10,16))
  for j in np.flatnonzero(scores>=.98):
   a,b=map(int,ids[selected[j]]);structure_close.append(dict(a=a,b=b,ssim=float(scores[j]),scene=NAMES[int(scenes[a])]))
 worst.sort(key=lambda r:r['score'],reverse=True)
 # Human review: both the closest pairs and a stratified overview, at native pixel scale.
 sheet=Image.new('RGB',(8*128,8*155),'#090714');draw=ImageDraw.Draw(sheet)
 for j,row in enumerate(worst[:32]):
  x=(j%4)*256;y=(j//4)*155
  for k,i in enumerate([row['a'],row['b']]):sheet.paste(Image.fromarray(image_at(i)),(x+k*128,y));draw.text((x+k*128+3,y+131),f"#{i} {row['scene']}",fill='white')
  draw.text((x+3,y+143),f"SSIM {row['luminance_ssim']:.4f} MAE {row['rgb_mae']:.4f}",fill='#60ffda')
 sheet.save(OUT/'closest-pairs.png')
 overview=Image.new('RGB',(8*128,8*144),'#090714');draw=ImageDraw.Draw(overview)
 for scene in range(8):
  ids=np.flatnonzero(scenes==scene)
  for k,i in enumerate(ids[np.linspace(0,len(ids)-1,8,dtype=int)]):overview.paste(Image.fromarray(image_at(int(i))),(scene*128,k*144));draw.text((scene*128+2,k*144+129),f'{NAMES[scene]} #{i}',fill='white')
 overview.save(OUT/'overview.png')
 unique_near=len({i for row in near for i in [row['a'],row['b']]});passed=not duplicates and not grey_duplicates and unique_near/n<=.001
 sources={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in list((ROOT/'src').rglob('*.sol'))+[Path(__file__),ROOT/'scripts/blocks_diversity_reference.py',ROOT/'test/blockart/BlocksDiversityAudit.t.sol',ROOT/'scripts/export_blocks_diversity.py']}
 report=dict(version='BLOCKS_VIDEO_V3',status='passed' if passed else 'needs_revision',samples=n,scene_counts=dict(hist),trait_counts={name:dict(counts) for name,counts in traits.items()},distinct_masked_rgb_frames=len(exact),exact_rgb_duplicate_pairs=duplicates[:100],exact_index_geometry_duplicate_pairs=grey_duplicates[:100],structure_close_pairs=len(structure_close),tokens_in_structure_close_pairs=len({i for row in structure_close for i in [row['a'],row['b']]}),structure_close_examples=sorted(structure_close,key=lambda row:row['ssim'],reverse=True)[:50],near_duplicate_pairs=len(near),tokens_in_near_duplicate_pairs=unique_near,near_duplicate_token_fraction=unique_near/n,
  method=dict(corpus='Actual Solidity-rendered frame 0; fixed block number/timestamp/gas limit/base fee/beneficiary/chain ID; prevrandao 1..N; no phase/reversal/mirror/crop/pan credit',comparison='Exactly undo mirror/crop/pan, then mask to source y=32..111; exact RGB and palette-index hashes; global exact L2 radius search on a 60D averaging projection followed by a full 480D distance filter, covering every pair that can pass the RGB-RMSE threshold, with 2/255 rounding margin; HNSW adds closest-pair previews and diagnostic structure neighbours; refine at 32x20 RGB RMSE and Gaussian luminance SSIM',near_threshold='RGB RMSE <=0.035 AND luminance SSIM >=0.98; at most 0.1% tokens in flagged pairs',limits='The RGB near-duplicate gate covers all pairs under this downsampled metric; structural diagnostic neighbours use approximate HNSW. Neither is a guarantee of subjective uniqueness or of future mints. Full 90-frame movies are separately validated on selected samples.',compiler='0.8.37',evm='amsterdam'),closest_pairs=worst[:100],incremental_baseline=None if not baseline else dict(previous_audit_sha256=hashlib.sha256((args.baseline/'audit.json').read_bytes()).hexdigest(),method='All seven unchanged scenes checked byte-for-byte against the fully audited baseline; every new tunnel sample searched against the entire new corpus'),native_corpus_sha256=checksums,source_sha256=sources,elapsed_seconds=round(time.time()-start,2))
 (OUT/'audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','samples','distinct_masked_rgb_frames','near_duplicate_pairs','tokens_in_near_duplicate_pairs']}),flush=True)
 if not passed:raise SystemExit('Diversity gate failed; revise the recipe before release')
if __name__=='__main__':main()
