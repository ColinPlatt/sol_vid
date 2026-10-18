#!/usr/bin/env python3
"""Read-only Sepolia audit: confirm the authorized broadcast and export its first NFT."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
env = {}
for line in (ROOT / '.env').read_text().splitlines():
    key, sep, value = line.removeprefix('export ').partition('=')
    if sep and not key.strip().startswith('#'):
        env[key.strip()] = ' '.join(shlex.split(value, comments=True))

def rpc(method, params):
    response = subprocess.run(['curl', '-fsS', '--max-time', '120', '-H', 'content-type: application/json',
                               '--data-binary', '@-', env['SEPOLIA_RPC_URL']],
                              input=json.dumps(dict(jsonrpc='2.0', id=1, method=method, params=params)),
                              text=True, capture_output=True)
    if response.returncode:
        raise RuntimeError('Sepolia RPC transport failed')
    data = json.loads(response.stdout)
    if 'error' in data:
        raise RuntimeError('Sepolia RPC: ' + str(data['error'].get('message', 'read failed')))
    return data['result']

def selector(signature):
    return subprocess.check_output(['/tmp/ghoulballs-toolchain/cast', 'sig', signature], text=True).strip()

def call(signature, token=None):
    data = selector(signature) + (f'{token:064x}' if token is not None else '')
    return bytes.fromhex(rpc('eth_call', [dict(to=collection, data=data, gas=hex(500_000_000)), 'latest'])[2:])

def dynamic(raw):
    offset = int.from_bytes(raw[:32]); size = int.from_bytes(raw[offset:offset+32])
    assert offset >= 32 and offset+32+size <= len(raw)
    return raw[offset+32:offset+32+size]

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert int(rpc('eth_chainId', []), 16) == 11155111
broadcast = json.loads((ROOT / 'broadcast/DeploySingleBlock.s.sol/11155111/run-latest.json').read_text())
transactions = broadcast['transactions']; assert len(transactions) == 2
assert transactions[0]['contractName'] == 'SingleBlockNFT' and transactions[0]['transactionType'] == 'CREATE'
collection = transactions[0]['contractAddress'].lower()
assert transactions[1]['contractAddress'].lower() == collection
receipts = [rpc('eth_getTransactionReceipt', [t['hash']]) for t in transactions]
assert all(r and r['status'] == '0x1' for r in receipts)
assert receipts[0]['contractAddress'].lower() == collection
mint = receipts[1]; token = int(mint['blockNumber'], 16)
block = rpc('eth_getBlockByNumber', [mint['blockNumber'], False])
assert int.from_bytes(call('totalSupply()')) == 1
assert int.from_bytes(call('latestTokenId()')) == token
assert call('ownerOf(uint256)', token).hex()[-40:] == env['DEPLOYER_ADDRESS'].lower()[2:]
assert dynamic(call('ART_VERSION()')).decode() == 'BLOCKS_SINGLE_V1'
renderer = '0x' + call('renderer()').hex()[-40:]
artifact = json.loads((ROOT / 'out/SingleBlockNFT.sol/SingleBlockNFT.json').read_text())
creation = bytes.fromhex(artifact['bytecode']['object'].removeprefix('0x'))
actual_tx = rpc('eth_getTransactionByHash', [transactions[0]['hash']])
assert bytes.fromhex(actual_tx['input'][2:]) == creation + bytes.fromhex(renderer[2:].rjust(64, '0'))
expected = bytearray.fromhex(artifact['deployedBytecode']['object'].removeprefix('0x'))
for refs in artifact['deployedBytecode']['immutableReferences'].values():
    for ref in refs:
        expected[ref['start']:ref['start']+ref['length']] = bytes.fromhex(renderer[2:].rjust(ref['length']*2, '0'))
code = bytes.fromhex(rpc('eth_getCode', [collection, 'latest'])[2:]); assert code == expected
values = call('blockData(uint256)', token)
values = [int.from_bytes(values[i:i+32]) for i in range(0, len(values), 32)]
expected_values = [token, int(block['timestamp'],16), int(block['gasLimit'],16), int(block['baseFeePerGas'],16),
                   int(block['mixHash'],16), int(block['miner'],16), 11155111]
assert values == expected_values, 'Stored block fields differ from the mint block'
uri = dynamic(call('tokenURI(uint256)', token)).decode()
assert uri.startswith('data:application/json;base64,')
metadata = json.loads(base64.b64decode(uri.split(',',1)[1], validate=True))
svg = ET.fromstring(unquote(metadata['image']).split(',',1)[1]); image = svg[0].attrib['href']
gif = base64.b64decode(image.split(',',1)[1], validate=True)
assert gif[:6] in [b'GIF89a', b'GIF87a'] and 'animation_url' not in metadata
assert gif == dynamic(call('gif(uint256)', token))
avi = dynamic(call('avi(uint256)', token)); assert avi[:4] == b'RIFF' and avi[8:12] == b'AVI '
out = ROOT / 'previews/blocks-single-sepolia'; out.mkdir(exist_ok=True)
(out / f'{token}.gif').write_bytes(gif); (out / f'{token}.avi').write_bytes(avi)
(ROOT / f'blocks-page/dist/assets/block-{token}.gif').write_bytes(gif)
manifest_path = ROOT / 'deployments/blocks-single-sepolia.json'
manifest = json.loads(manifest_path.read_text())
gas = sum(int(r['gasUsed'],16) for r in receipts)
fee = sum(int(r['gasUsed'],16)*int(r['effectiveGasPrice'],16) for r in receipts)
manifest.update(status='deployed', collection=collection, renderer=renderer, first_token_id=token,
                first_scene=metadata['name'].split(' #')[0], owner=env['DEPLOYER_ADDRESS'],
                transaction_hashes=[t['hash'] for t in transactions], receipts=receipts,
                gas_used=gas, transaction_fee_wei=str(fee), runtime_verified=True, runtime_bytes=len(code),
                creation_bytecode_sha256=sha(creation), runtime_bytecode_sha256=sha(code),
                mint_enabled=True, broadcast_authorization='explicit_user_approval_2026-10-18',
                checked_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                validation=dict(chain_id=11155111, capped_static_call_gas=500_000_000,
                                block_fields_match_mint_block=True, token_uri_bytes=len(uri),
                                gif_bytes=len(gif), gif_sha256=sha(gif), avi_bytes=len(avi), avi_sha256=sha(avi)))
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(collection=collection, token=token, scene=manifest['first_scene'], gas=gas,
                      fee_wei=str(fee), runtime_bytes=len(code), token_uri_bytes=len(uri), gif_sha256=sha(gif)),indent=2))
