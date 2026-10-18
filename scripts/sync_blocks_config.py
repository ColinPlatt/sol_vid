#!/usr/bin/env python3
"""Build the separate blocks page settings from confirmed release evidence."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def address(value):return isinstance(value,str) and bool(re.fullmatch(r'0x[0-9a-fA-F]{40}',value)) and int(value,16)!=0
def build(manifest):
    if manifest.get('chain_id')!=8453 or manifest.get('collection_name')!='blocks' or manifest.get('collection_symbol')!='blocks':raise ValueError('Wrong collection settings')
    deployed=manifest.get('status')=='deployed'
    config=dict(name='Base',chainId=8453,chainHex='0x2105',rpcUrl='https://mainnet.base.org',explorerUrl='https://basescan.org',deployed=False,mintEnabled=False,collectionAddress=None,rendererAddress=None)
    if not deployed:return config
    collection=manifest.get('collection');renderer=manifest.get('renderer');scenes=list(manifest.get('scenes',{}).values())
    if not address(collection) or not address(renderer) or len(scenes)!=8 or not all(map(address,scenes)) or len(set(v.lower() for v in scenes+[renderer,collection]))!=10:raise ValueError('Incomplete contract addresses')
    hashes=manifest.get('transaction_hashes',[])
    receipts=manifest.get('receipts',[])
    if len(hashes)!=11 or len(set(hashes))!=11 or any(not re.fullmatch(r'0x[0-9a-fA-F]{64}',h) for h in hashes):raise ValueError('Missing deployment/mint transactions')
    if {r.get('transactionHash','').lower() for r in receipts if r.get('status')=='0x1'}!={h.lower() for h in hashes}:raise ValueError('Missing successful receipts')
    config.update(deployed=True,collectionAddress=collection,rendererAddress=renderer)
    evidence=manifest.get('marketplace_playback',{})
    if evidence.get('status')=='passed':
        prefix='https://opensea.io/item/base/'+collection.lower()+'/'
        if not evidence.get('checked_at_utc') or not evidence.get('evidence_url','').lower().startswith(prefix):raise ValueError('Playback evidence is for another collection')
        if not manifest.get('runtime_verified'):raise ValueError('Missing deployed runtime validation')
        config['mintEnabled']=True
    return config
if __name__=='__main__':
    config=build(json.loads((ROOT/'deployments/blocks-base.json').read_text()))
    (ROOT/'mint-page/dist/blocks/config.json').write_text(json.dumps(config,indent=2)+'\n')
    print('blocks page mint enabled:',config['mintEnabled'])
