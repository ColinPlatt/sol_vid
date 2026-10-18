#!/usr/bin/env python3
"""Rebuild the recorded Sepolia verification inputs without RPC, keys or a Foundry artifact cache."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--solc', default='solc')
args = p.parse_args()
version = subprocess.check_output([args.solc, '--version'], text=True)
if '0.8.37+commit.f401782d' not in version:
    p.error('Use the recorded Solidity 0.8.37+commit.f401782d compiler')
rows = json.loads((ROOT / 'verification/blocks-sepolia/contracts.json').read_text())

def check(row):
    name = row['contract']
    source = ROOT / f'verification/blocks-sepolia/{name}.standard.json'
    result = subprocess.run([args.solc, '--standard-json'], input=source.read_bytes(), capture_output=True, check=True)
    output = json.loads(result.stdout)
    errors = [e['formattedMessage'] for e in output.get('errors', []) if e['severity'] == 'error']
    if errors:
        raise RuntimeError('\n'.join(errors))
    code = bytes.fromhex(output['contracts'][row['source']][name]['evm']['bytecode']['object'])
    if hashlib.sha256(code).hexdigest() != row['creation_bytecode_sha256']:
        raise AssertionError(f'{name}: creation bytecode differs from the recorded deployment')
    print(f'PASS {name}: exact recorded creation bytecode ({len(code):,} bytes)', flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(check, rows))
