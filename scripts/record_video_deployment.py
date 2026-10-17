#!/usr/bin/env python3
"""Confirm an existing broadcast; never signs, sends, or assumes a dry-run address is deployed."""
import argparse,base64,datetime,hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('kind',choices=['candidate','edition'])
parser.add_argument('--rpc-url',default='https://mainnet.base.org')
parser.add_argument('--broadcast-file',type=Path,default=ROOT/'broadcast/DeployVideo.s.sol/8453/run-latest.json')
parser.add_argument('--manifest',type=Path,default=ROOT/'deployments/video-base.json')
parser.add_argument('--output-dir',type=Path,default=ROOT/'previews/video')
args=parser.parse_args()
run=json.loads(args.broadcast_file.read_text())
expected='VideoCandidate' if args.kind=='candidate' else 'VideoNFT'
transactions=run['transactions'];creations={t.get('contractName'):t for t in transactions if t.get('transactionType')=='CREATE'}
assert set(creations)=={'AviRleVideo',expected},'Wrong broadcast; expected exactly the video renderer and requested collection'
renderer=creations['AviRleVideo']['contractAddress'];collection=creations[expected]['contractAddress']
def rpc(method,params):
    request=urllib.request.Request(args.rpc_url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json','User-Agent':'foundry'})
    result=json.load(urllib.request.urlopen(request,timeout=90));assert 'error' not in result,result.get('error');return result['result']
assert int(rpc('eth_chainId',[]),16)==8453
receipts=[]
for transaction in transactions:
    receipt=rpc('eth_getTransactionReceipt',[transaction['hash']]);assert receipt and int(receipt['status'],16)==1,'Unconfirmed/reverted transaction'
    if transaction.get('contractAddress') and transaction.get('transactionType')=='CREATE':assert receipt['contractAddress'].lower()==transaction['contractAddress'].lower()
    receipts.append(receipt)
checks={}
for name,address in [('AviRleVideo',renderer),(expected,collection)]:
    artifact=json.loads((ROOT/f'out/{name}.sol/{name}.json').read_text())
    metadata=json.loads(artifact['metadata']) if isinstance(artifact.get('metadata'),str) else artifact.get('metadata',{})
    assert metadata['compiler']['version'].startswith('0.8.30') and metadata['settings']['evmVersion']=='cancun','Build the Base profile before checking bytecode'
    raw=bytearray.fromhex(artifact['deployedBytecode']['object'].removeprefix('0x'))
    for refs in artifact['deployedBytecode'].get('immutableReferences',{}).values():
        for ref in refs:
            assert ref['length']==32
            raw[ref['start']:ref['start']+32]=bytes.fromhex(renderer[2:]).rjust(32,b'\0')
    live=bytes.fromhex(rpc('eth_getCode',[address,'latest'])[2:]);assert bytes(raw)==live,f'{name} runtime mismatch'
    checks[name]={'runtime_bytes':len(live),'runtime_sha256':hashlib.sha256(live).hexdigest()}
def call(data):return rpc('eth_call',[{'to':collection,'data':data,'gas':hex(500_000_000)},'latest'])
assert int(call('0x18160ddd'),16)==1,'First token missing'
assert call('0x8ada6b0f')[-40:].lower()==renderer[2:].lower(),'Renderer mismatch'
owner='0x'+call('0x6352211e'+hex(1)[2:].zfill(64))[-40:]
assert owner.lower()==transactions[0]['transaction']['from'].lower(),'First token not owned by deployer'
raw=bytes.fromhex(call('0xc87b56dd'+hex(1)[2:].zfill(64))[2:]);offset=int.from_bytes(raw[:32]);length=int.from_bytes(raw[offset:offset+32]);uri=raw[offset+32:offset+32+length].decode()
prefix='data:application/json;base64,';assert uri.startswith(prefix)
metadata=json.loads(base64.b64decode(uri[len(prefix):]));assert metadata['animation_url'].startswith('data:text/html,')
args.output_dir.mkdir(parents=True,exist_ok=True)
(args.output_dir/f'live-{args.kind}-metadata.uri').write_text(uri)
record={'status':'deployed','receipt_verified':True,'collection':collection,'renderer':renderer,'transaction_hashes':[t['hash'] for t in transactions],'confirmed_blocks':[int(r['blockNumber'],16) for r in receipts],'gas_used':[int(r['gasUsed'],16) for r in receipts],'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runtime_checks':checks,'first_token_owner':owner,'first_token_uri_bytes':length,'opensea_playback':{'status':'not_checked','evidence_url':None,'checked_at_utc':None}}
manifest=args.manifest;m=json.loads(manifest.read_text())
if args.kind=='candidate':m['candidate']=record
else:
    assert m['candidate'].get('opensea_playback',{}).get('status')=='passed','Candidate approval missing'
    m.update(record)
manifest.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(record,indent=2))
