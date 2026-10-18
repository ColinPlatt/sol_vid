#!/usr/bin/env python3
"""Generate independent video settings; never enable a mint without release evidence."""
import json,re
from urllib.parse import urlparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def build(manifest):
    assert manifest['chain_id']==8453
    deployed=manifest['status']=='deployed'
    def address(value):
        if not isinstance(value,str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}',value) or int(value,16)==0:raise ValueError('Invalid confirmed video address')
        return value
    collection=address(manifest['collection']) if deployed else None
    renderer=address(manifest['renderer']) if deployed else None
    verified=manifest['opensea_playback']['status']=='passed'
    if deployed:
        if len(manifest['transaction_hashes'])<2 or any(not re.fullmatch(r'0x[0-9a-fA-F]{64}',h) for h in manifest['transaction_hashes']):raise ValueError('Confirmed deployment receipts required')
    if verified:
        evidence=manifest['opensea_playback']
        if not deployed or not evidence.get('checked_at_utc'):raise ValueError('Confirmed deployment and OpenSea evidence required')
        url=urlparse(evidence.get('evidence_url') or '')
        if url.scheme!='https' or url.hostname!='opensea.io' or f'/base/{collection.lower()}/' not in url.path.lower():raise ValueError('OpenSea evidence must identify this production collection')
    return {'collectionName':'ghoulballs','defaultChainId':8453,'playbackVerified':verified,'mintEnabled':deployed and verified,'networks':[{'chainId':8453,'chainHex':'0x2105','name':'Base','testnet':False,'rpcUrl':'https://mainnet.base.org','renderRpcUrls':['https://mainnet.base.org','https://base.gateway.tenderly.co'],'explorerUrl':'https://basescan.org','collectionAddress':collection,'rendererAddress':renderer,'deployed':deployed,'tokensPerMint':1,'mintLimit':1}]}
if __name__=='__main__':
    config=build(json.loads((ROOT/'deployments/video-base.json').read_text()))
    (ROOT/'mint-page/dist/video-config.json').write_text(json.dumps(config,indent=2)+'\n')
    print('Video config synced; mint enabled:',config['mintEnabled'])
