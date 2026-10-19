#!/usr/bin/env python3
"""Read-only audit of the authorized BLOCKS_VIDEO_V4 Base broadcast: receipts, runtime code, the stored mint block and
extras, and every frame of the first token's live metadata against the independent Python references.

Run against a `FOUNDRY_PROFILE=blocks_base` build in `out/`."""
import argparse
import base64
import datetime
import hashlib
import json
import re
import shlex
import subprocess
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET
import numpy as np
from blocks_diversity_reference import kh, word, tagged, palette, badge
from blocks_v4_reference import paint

ROOT = Path(__file__).resolve().parents[1]
CAP = 500_000_000
NAMES = ['canyon', 'descent', 'monorail', 'spire', 'skyline', 'alley', 'nighttrain', 'satoyama']
NETWORKS = {
    'sepolia': dict(name='Ethereum Sepolia', chain_id=11155111, rpc_env='SEPOLIA_RPC_URL', deployer_env='DEPLOYER_ADDRESS',
                    script='DeployBlocksV3.s.sol', evm='amsterdam', profile='default', authorized='2026-10-19',
                    created=['DescentV3', 'BlockArtRenderer', 'BlockVideoRendererV3', 'BlockVideoNFTV3']),
    'base': dict(name='Base', chain_id=8453, rpc='https://mainnet.base.org', deployer_env='BASE_DEPLOYER_ADDRESS',
                 script='DeployBlocksV3Base.s.sol', evm='cancun', profile='blocks_base', authorized='2026-10-19',
                 created=['Canyon', 'DescentV3', 'Monorail', 'Spire', 'Skyline', 'Alley', 'NightTrain', 'Satoyama',
                          'BlockArtRenderer', 'BlockVideoRendererV3', 'BlockVideoNFTV3']),
}
NET = NETWORKS['base']
env = {}
for line in (ROOT / '.env').read_text().splitlines():
    key, sep, value = line.removeprefix('export ').partition('=')
    if sep and not key.strip().startswith('#'):
        env[key.strip()] = ' '.join(shlex.split(value, comments=True))


def rpc(method, params):
    response = subprocess.run(['curl', '-fsS', '--max-time', '300', '-H', 'content-type: application/json',
                               '--data-binary', '@-', NET.get('rpc') or env[NET['rpc_env']]],
                              input=json.dumps(dict(jsonrpc='2.0', id=1, method=method, params=params)),
                              text=True, capture_output=True)
    if response.returncode:
        raise RuntimeError(NET['name'] + ' RPC transport failed')
    data = json.loads(response.stdout)
    if 'error' in data:
        raise RuntimeError(NET['name'] + ' RPC: ' + str(data['error'].get('message', 'read failed')))
    return data['result']


def selector(signature):
    return kh(signature.encode())[:4].hex()


def call(to, signature, args=b''):
    data = '0x' + selector(signature) + args.hex()
    return bytes.fromhex(rpc('eth_call', [dict(to=to, data=data, gas=hex(CAP)), 'latest'])[2:])


def dynamic(raw):
    offset = int.from_bytes(raw[:32]); size = int.from_bytes(raw[offset:offset + 32])
    assert offset >= 32 and offset + 32 + size <= len(raw)
    return raw[offset + 32:offset + 32 + size]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode_bytes(data):
    return word(32) + word(len(data)) + data.ljust((len(data) + 31) // 32 * 32, b'\0')


def recipe(seed):
    h = int.from_bytes(tagged(seed, 'composition'), 'big')
    return dict(hue=h % 360, saturation=65 + (h >> 16) % 31, heightBand=(h >> 24) % 8, density=(h >> 32) % 4,
                layout=(h >> 40) % 4, crop=(h >> 48) % 4, pan=(h >> 56) % 9, mirror=bool((h >> 64) & 1),
                reverse=bool((h >> 72) & 1), phase=(h >> 80) % 90, tint=int.from_bytes(tagged(seed, 'palette'), 'big'))


def artwork(fields, seed, r):
    """The documented V3 ten-record scene input, written independently of the Solidity library."""
    out = bytearray()
    for i in range(10):
        channel = int.from_bytes(seed if i == 9 else kh(seed + word(i)), 'big')
        side = i % 2 if r['layout'] == 1 else (0 if i < 7 else 1) if r['layout'] == 2 else (1 if i < 7 else 0)
        if r['layout'] and i != 9:
            channel = channel & ~(1 << 248) | side << 248
        c = word(channel)
        intensity = 100 + r['heightBand'] * 300 + int.from_bytes(tagged(c, 'height'), 'big') % 701
        meta = (fields[0] % 2**64) << 192 | intensity << 128 | 10000 << 64 | fields[1] % 2**64
        out += word(meta) + c + tagged(c, 'windows')
        for j in range(8):
            text = b'lights'
            lights = int.from_bytes(kh(c + word(96) + word(j) + word(len(text)) + text.ljust(32, b'\0')), 'big')
            text = b'occupancy'
            mask = int.from_bytes(kh(c + word(96) + word(j) + word(len(text)) + text.ljust(32, b'\0')), 'big')
            if r['density'] == 0: lights &= mask & (mask >> 1)
            elif r['density'] == 1: lights &= mask
            elif r['density'] == 3: lights |= mask
            out += word(lights)
    assert len(out) == 3520
    return bytes(out)


def scene_of(seed):
    return 7 if seed[4] < 4 else int.from_bytes(seed[:4], 'big') % 7



assert int(rpc('eth_chainId', []), 16) == 8453
broadcast = json.loads((ROOT / 'broadcast/DeployBlocksV4Base.s.sol/8453/run-latest.json').read_text())
transactions = broadcast['transactions']
names = [t['contractName'] for t in transactions]
assert names == ['BlocksBandsV4', 'BlockVideoRendererV4', 'BlockVideoNFTV4', 'BlockVideoNFTV4'], names
receipts = [rpc('eth_getTransactionReceipt', [t['hash']]) for t in transactions]
assert all(r and r['status'] == '0x1' for r in receipts)
bands, renderer, collection = (t['contractAddress'].lower() for t in transactions[:3])
assert transactions[3]['transactionType'] == 'CALL' and transactions[3]['contractAddress'].lower() == collection
deployer = env['BASE_DEPLOYER_ADDRESS'].lower()
v3 = json.loads((ROOT / 'deployments/blocks-video-v3-base.json').read_text())
router = v3['scene_router']


def check_code(address, artifact_name, immutables):
    artifact = json.loads((ROOT / f'out/{artifact_name}.sol/{artifact_name}.json').read_text())
    expected = bytearray.fromhex(artifact['deployedBytecode']['object'].removeprefix('0x'))
    refs = artifact['deployedBytecode'].get('immutableReferences', {})
    assert len(refs) == len(immutables), (artifact_name, len(refs))
    # Immutable reference ids are assigned in declaration order.
    for (_, places), value in zip(sorted(refs.items(), key=lambda kv: int(kv[0])), immutables):
        for ref in places:
            expected[ref['start']:ref['start'] + ref['length']] = bytes.fromhex(value[2:].rjust(ref['length'] * 2, '0'))
    code = bytes.fromhex(rpc('eth_getCode', [address, 'latest'])[2:])
    assert code == expected, f'{artifact_name} runtime differs from the local build'
    creation = bytes.fromhex(artifact['bytecode']['object'].removeprefix('0x'))
    return dict(address=address, runtime_bytes=len(code), runtime_sha256=sha(code), creation_bytecode_sha256=sha(creation))


runtimes = dict(BlocksBandsV4=check_code(bands, 'BlocksBandsV4', []),
                BlockVideoRendererV4=check_code(renderer, 'BlockVideoRendererV4', [router, bands]),
                BlockVideoNFTV4=check_code(collection, 'BlockVideoNFTV4', [renderer]))

mint = receipts[3]; token = int(mint['blockNumber'], 16); tid = word(token)
block = rpc('eth_getBlockByNumber', [mint['blockNumber'], False])
assert int.from_bytes(call(collection, 'totalSupply()')) >= 1
assert call(collection, 'ownerOf(uint256)', tid)[-20:].hex() == deployer[2:]
assert dynamic(call(collection, 'ART_VERSION()')).decode() == 'BLOCKS_VIDEO_V4'
assert dynamic(call(collection, 'name()')).decode() == dynamic(call(collection, 'symbol()')).decode() == 'blocks'
raw = call(collection, 'blockData(uint256)', tid)
fields = [int.from_bytes(raw[i:i + 32]) for i in range(0, len(raw), 32)]
assert fields == [token, int(block['timestamp'], 16), int(block['gasLimit'], 16), int(block['baseFeePerGas'], 16),
                  int(block['mixHash'], 16), int(block['miner'], 16), 8453], 'Stored block differs from the mint block'
raw = call(collection, 'extrasOf(uint256)', tid)
parent_hash, blob_fee, l1_number, l1_hash, l1_fee = (int.from_bytes(raw[i:i + 32]) for i in range(0, 160, 32))
assert parent_hash == int(block['parentHash'], 16), 'Parent hash differs from the chain'
# The L1 context must equal Base's L1Block predeploy as of the mint block.
l1 = '0x4200000000000000000000000000000000000015'
at = lambda sig: int(rpc('eth_call', [dict(to=l1, data='0x' + selector(sig)), mint['blockNumber']]), 16)
assert (l1_number, l1_hash, l1_fee, blob_fee) == (at('number()'), at('hash()'), at('basefee()'), at('blobBaseFee()')), \
    'Stored L1 context differs from L1Block at the mint block'
version = b'BLOCKS_VIDEO_V3'  # V4 keeps V3's seed
seed = kh(word(256) + b''.join(map(word, fields)) + word(len(version)) + version.ljust(32, b'\0'))
assert call(collection, 'seedOf(uint256)', tid) == seed
r = recipe(seed)
scene = scene_of(seed)
assert int.from_bytes(call(collection, 'sceneOf(uint256)', tid)) == scene
art = artwork(fields, seed, r)
reference = dynamic(call(router, 'avi(bytes)', encode_bytes(art)))

data = '0x' + selector('tokenURI(uint256)') + tid.hex()


def passes(limit):
    try:
        rpc('eth_call', [dict(to=collection, data=data, gas=hex(limit)), 'latest'])
        return True
    except RuntimeError:
        return False


# Providers bound eth_estimateGas by the block gas limit, so bisect actual capped calls (100k-gas resolution).
low, high = 0, CAP
assert passes(high)
while high - low > 100_000:
    mid = (low + high) // 2
    low, high = (low, mid) if passes(mid) else (mid, high)
uri_gas = high
uri = dynamic(call(collection, 'tokenURI(uint256)', tid)).decode()
metadata = json.loads(base64.b64decode(uri.split(',', 1)[1], validate=True))
traits = {t['trait_type']: t['value'] for t in metadata['attributes']}
assert traits['Art Version'] == 'BLOCKS_VIDEO_V4' and traits['Rare'] == ('Yes' if scene == 7 else 'No')
assert traits['Parent Hash'] == f'0x{parent_hash:064x}' and traits['L1 Block'] == l1_number
encoded = re.search(r'const encoded="([A-Za-z0-9+/=]+)";', unquote(metadata['animation_url'])).group(1)
movie = base64.b64decode(encoded, validate=True)
assert movie == dynamic(call(collection, 'video(uint256)', tid))
assert len(movie) == len(reference) == 1477976

out = ROOT / 'previews/blocks-video-v4-base-live'; out.mkdir(exist_ok=True)
avi_path = out / f'{token}.avi'; avi_path.write_bytes(movie)
info = dict(number=token, timestamp=fields[1], gasLimit=fields[2], baseFee=fields[3], beneficiary=str(fields[5]),
            chainId=8453, parentHash=str(parent_hash), blobBaseFee=blob_fee, l1Number=l1_number, l1Hash=str(l1_hash),
            l1BaseFee=l1_fee)
original = np.array([list(reference[212 + i * 4:215 + i * 4][::-1]) for i in range(256)], np.uint8)
pal = palette(original, r)
assert bytes(c for i in range(256) for c in movie[212 + i * 4:215 + i * 4][::-1]) == pal.tobytes()
expected = []
for frame in range(90):
    source = (r['phase'] + (-frame if r['reverse'] else frame)) % 90
    indices = np.frombuffer(reference, dtype=np.uint8, offset=1256 + source * 16392, count=16384).reshape(128, 128)[::-1]
    result = paint(badge(indices, scene), info, r['hue'], frame)
    native = np.frombuffer(movie, dtype=np.uint8, offset=1256 + frame * 16392, count=16384).reshape(128, 128)[::-1]
    assert np.array_equal(native, result), f'frame {frame}'
    expected.append(pal[result].tobytes())
decoded = subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(avi_path), '-vsync', '0', '-f', 'rawvideo',
                          '-pix_fmt', 'rgb24', '-threads', '1', '-'], capture_output=True, check=True)
assert not decoded.stderr and decoded.stdout == b''.join(expected), 'FFmpeg decode differs'
svg = base64.b64decode(metadata['image'].split(',', 1)[1], validate=True)
poster = bytearray(128 * 128 * 3); covered = 0
for path in ET.fromstring(svg):
    colour = bytes.fromhex(path.attrib['stroke'][1:])
    for m in re.finditer(r'M(\d+) (\d+)\.5h(\d+)', path.attrib['d']):
        x, y, w = map(int, m.groups())
        for px in range(x, x + w):
            poster[(y * 128 + px) * 3:(y * 128 + px) * 3 + 3] = colour; covered += 1
assert covered == 16384 and poster == expected[0], 'SVG poster differs from frame 0'
(out / f'{token}.svg').write_bytes(svg)
(out / f'{token}.json').write_text(json.dumps({k: v for k, v in metadata.items() if k not in ('image', 'animation_url')},
                                              ensure_ascii=False, indent=1) + '\n')

gas = sum(int(x['gasUsed'], 16) for x in receipts)
fee = sum(int(x['gasUsed'], 16) * int(x['effectiveGasPrice'], 16) for x in receipts)
path = ROOT / 'deployments/blocks-video-v4-base.json'
manifest = json.loads(path.read_text()) if path.exists() else {}
manifest.update({
    'status': 'deployed', 'network': 'Base', 'chain_id': 8453, 'collection_name': 'blocks', 'collection_symbol': 'blocks',
    'art_version': 'BLOCKS_VIDEO_V4', 'collection': collection, 'renderer': renderer, 'bands': bands,
    'scene_router': router, 'scenes': v3['scenes'], 'reused_from': 'deployments/blocks-video-v3-base.json',
    'mint_signature': 'mint()', 'token_id': 'execution block number', 'limit': 'one NFT per block, first successful caller',
    'image': 'native SVG of final AVI frame 0', 'animation_url': 'self-contained HTML data URI embedding AVI and decoder',
    'format': 'AVI BI_RGB', 'width': 128, 'height': 128, 'frames': 90, 'fps': 15, 'duration_seconds': 6,
    'compiler': '0.8.37+commit.f401782d', 'evm_version': 'cancun', 'profile': 'blocks_base', 'optimizer_runs': 200,
    'via_ir': True, 'deployer': env['BASE_DEPLOYER_ADDRESS'], 'first_token_id': token,
    'first_scene': metadata['name'].split(' #')[0], 'first_extras': dict(parent_hash=f'0x{parent_hash:064x}',
    blob_base_fee=blob_fee, l1_number=l1_number, l1_hash=f'0x{l1_hash:064x}', l1_base_fee=l1_fee),
    'transaction_hashes': [t['hash'] for t in transactions], 'receipts': receipts, 'gas_used': gas,
    'transaction_fee_wei': str(fee), 'runtimes': runtimes, 'runtime_verified': True,
    'broadcast_authorization': 'explicit_user_approval_2026-10-19 (broadcast by the user)',
    'live_media_validation': {
        'gas_cap': CAP, 'token_uri_min_passing_call_gas': uri_gas, 'token_uri_bytes': len(uri), 'avi_bytes': len(movie),
        'avi_sha256': sha(movie), 'svg_bytes': len(svg), 'block_fields_match_mint_block': True,
        'extras_match_chain': 'parent hash from the block header; L1 fields equal L1Block at the mint block',
        'independent_reference': 'all 90 frames, palette, FFmpeg decode and SVG poster match scripts/blocks_v4_reference.py',
        'files': f'previews/blocks-video-v4-base-live/{token}.*'},
    'mint_enabled': manifest.get('mint_enabled', False),
    'marketplace_playback': manifest.get('marketplace_playback', {'status': 'not_checked'}),
    'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
})
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(dict(collection=collection, token=token, scene=manifest['first_scene'], gas=gas, fee_wei=str(fee),
                      token_uri_gas=uri_gas, extras=manifest['first_extras']), indent=2, ensure_ascii=False))
