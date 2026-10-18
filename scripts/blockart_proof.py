#!/usr/bin/env python3
"""Fetch and verify public epoch headers for a future mint/dry-run; never signs anything."""
import argparse,json,os,sys
import blockart_fixtures as fixtures
parser=argparse.ArgumentParser();parser.add_argument('epoch',type=int);parser.add_argument('--rpc',default=os.environ.get('BASE_RPC_URL','https://mainnet.base.org'));args=parser.parse_args()
if args.epoch<0:parser.error('epoch must be nonnegative')
fixtures.RPC=args.rpc
blocks=fixtures.rpc([('eth_getBlockByNumber',[hex(args.epoch*10+i),False]) for i in range(10)])
headers=[]
for i,block in enumerate(blocks):
    if block is None:raise SystemExit('Epoch is not complete')
    encoded=fixtures.header(block);actual=fixtures.keccak(encoded)
    if actual.lower()!=block['hash'].lower():raise SystemExit('Header hash mismatch')
    if i and block['parentHash'].lower()!=blocks[i-1]['hash'].lower():raise SystemExit('Broken parent chain')
    if int(block['number'],16)!=args.epoch*10+i:raise SystemExit('Wrong block number')
    headers.append('0x'+encoded.hex())
json.dump({'epoch':args.epoch,'last_hash':blocks[-1]['hash'],'headers':headers},sys.stdout);sys.stdout.write('\n')
