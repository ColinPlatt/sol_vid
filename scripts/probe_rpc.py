#!/usr/bin/env python3
"""Read-only metadata retrieval audit for a deployed MarketplaceProbe. Never signs or sends transactions."""
import argparse,base64,json,os,re,time,urllib.error,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path

def decode_metadata(result):
    raw=bytes.fromhex(result.removeprefix('0x'))
    if len(raw)<64:raise ValueError('Truncated ABI return')
    offset=int.from_bytes(raw[:32],'big')
    if offset%32 or offset+32>len(raw):raise ValueError('Invalid ABI string offset')
    length=int.from_bytes(raw[offset:offset+32],'big')
    if offset+32+length>len(raw):raise ValueError('Truncated ABI string')
    uri=raw[offset+32:offset+32+length].decode()
    prefix='data:application/json;base64,'
    if not uri.startswith(prefix):raise ValueError('Unexpected tokenURI encoding')
    return json.loads(base64.b64decode(uri[len(prefix):],validate=True)),len(uri)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--address',required=True)
    parser.add_argument('--chain-id',type=int,choices=[8453,84532],default=8453)
    parser.add_argument('--gas',type=int,default=500000000)
    parser.add_argument('--rpc-url',default=os.environ.get('PROBE_RPC_URL','https://mainnet.base.org'))
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not re.fullmatch('0x[0-9a-fA-F]{40}',args.address) or int(args.address,16)==0:parser.error('Invalid collection address')
    if args.gas<21000 or args.gas>550000000:parser.error('Gas must be between 21000 and 550000000')
    def rpc(method,params):
        body=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode()
        for attempt in range(3):
            try:
                req=urllib.request.Request(args.rpc_url,data=body,headers={'Content-Type':'application/json'})
                with urllib.request.urlopen(req,timeout=90) as response:result=json.load(response)
                if 'error' in result:raise RuntimeError(json.dumps(result['error']))
                return result['result']
            except urllib.error.HTTPError as error:
                if error.code!=429 or attempt==2:raise
                time.sleep(1+attempt)
    if int(rpc('eth_chainId',[]),16)!=args.chain_id:raise SystemExit('RPC chain ID mismatch')
    if rpc('eth_getCode',[args.address,'latest']) in ['0x','0x0']:raise SystemExit('No contract at the supplied address')
    records=[]
    for token in range(1,16):
        started=time.monotonic();row={'token_id':token}
        try:
            result=rpc('eth_call',[{'to':args.address,'data':'0xc87b56dd'+format(token,'064x'),'gas':hex(args.gas)},'latest'])
            metadata,size=decode_metadata(result)
            if not metadata['name'].startswith(f'ghoulballs probe #{token} - '):raise ValueError('Wrong probe contract')
            row.update(status='retrieved',name=metadata['name'],uri_bytes=size,has_image='image' in metadata,has_animation='animation_url' in metadata)
        except Exception as error:
            row.update(status='read_failed',error=str(error).replace(args.rpc_url,'[rpc]')[:300])
        row['elapsed_seconds']=round(time.monotonic()-started,3);records.append(row)
        print(f"{token:2}: {row['status']}",flush=True)
        time.sleep(.25)
    report={'checked_at':datetime.now(timezone.utc).isoformat(),'chain_id':args.chain_id,'rpc_host':urllib.parse.urlsplit(args.rpc_url).hostname,'collection':args.address,'requested_gas':args.gas,'note':'RPC retrieval only; no inference about marketplace ingestion or gas actually granted.','results':records}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':main()
