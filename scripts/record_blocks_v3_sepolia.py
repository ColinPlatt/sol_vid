#!/usr/bin/env python3
"""Read-only Sepolia audit of the authorized BLOCKS_VIDEO_V3 broadcast: receipts, runtime code, the stored mint
block and every frame of the first token's live metadata against the independent Python composition reference."""
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
from blocks_diversity_reference import kh, word, tagged, palette, compose, badge

ROOT = Path(__file__).resolve().parents[1]
CAP = 500_000_000
env = {}
for line in (ROOT / '.env').read_text().splitlines():
    key, sep, value = line.removeprefix('export ').partition('=')
    if sep and not key.strip().startswith('#'):
        env[key.strip()] = ' '.join(shlex.split(value, comments=True))


def rpc(method, params):
    response = subprocess.run(['curl', '-fsS', '--max-time', '300', '-H', 'content-type: application/json',
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


assert int(rpc('eth_chainId', []), 16) == 11155111
broadcast = json.loads((ROOT / 'broadcast/DeployBlocksV3.s.sol/11155111/run-latest.json').read_text())
transactions = broadcast['transactions']
names = [t['contractName'] for t in transactions]
assert names == ['DescentV3', 'BlockArtRenderer', 'BlockVideoRendererV3', 'BlockVideoNFTV3', 'BlockVideoNFTV3'], names
receipts = [rpc('eth_getTransactionReceipt', [t['hash']]) for t in transactions]
assert all(r and r['status'] == '0x1' for r in receipts)
descent, router, renderer, collection = (t['contractAddress'].lower() for t in transactions[:4])
assert transactions[4]['transactionType'] == 'CALL' and transactions[4]['contractAddress'].lower() == collection
deployer = env['DEPLOYER_ADDRESS'].lower()
reused = json.loads((ROOT / 'deployments/blocks-sepolia.json').read_text())['scenes']
slots = [reused['canyon'], descent, reused['monorail'], reused['spire'], reused['skyline'], reused['alley'],
         reused['nighttrain'], reused['satoyama']]


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


runtimes = dict(DescentV3=check_code(descent, 'DescentV3', []),
                BlockArtRenderer=check_code(router, 'BlockArtRenderer', slots),
                BlockVideoRendererV3=check_code(renderer, 'BlockVideoRendererV3', [router]),
                BlockVideoNFTV3=check_code(collection, 'BlockVideoNFTV3', [renderer]))

mint = receipts[4]; token = int(mint['blockNumber'], 16); tid = word(token)
block = rpc('eth_getBlockByNumber', [mint['blockNumber'], False])
assert int.from_bytes(call(collection, 'totalSupply()')) == 1
assert int.from_bytes(call(collection, 'latestTokenId()')) == token
assert call(collection, 'ownerOf(uint256)', tid)[-20:].hex() == deployer[2:]
assert dynamic(call(collection, 'ART_VERSION()')).decode() == 'BLOCKS_VIDEO_V3'
assert dynamic(call(collection, 'name()')).decode() == dynamic(call(collection, 'symbol()')).decode() == 'blocks'
raw = call(collection, 'blockData(uint256)', tid)
fields = [int.from_bytes(raw[i:i + 32]) for i in range(0, len(raw), 32)]
assert fields == [token, int(block['timestamp'], 16), int(block['gasLimit'], 16), int(block['baseFeePerGas'], 16),
                  int(block['mixHash'], 16), int(block['miner'], 16), 11155111], 'Stored block differs from the mint block'
version = b'BLOCKS_VIDEO_V3'
seed = kh(word(256) + b''.join(map(word, fields)) + word(len(version)) + version.ljust(32, b'\0'))
assert call(collection, 'seedOf(uint256)', tid) == seed
r = recipe(seed)
onchain = call(collection, 'recipeOf(uint256)', tid)
onchain = [int.from_bytes(onchain[i:i + 32]) for i in range(0, len(onchain), 32)]
assert onchain == [r['hue'], r['saturation'], r['heightBand'], r['density'], r['layout'], r['crop'], r['pan'],
                   int(r['mirror']), int(r['reverse']), r['phase'], r['tint']], 'recipeOf differs from the reference'
scene = scene_of(seed)
assert int.from_bytes(call(collection, 'sceneOf(uint256)', tid)) == scene
art = artwork(fields, seed, r)
assert int.from_bytes(call(router, 'sceneOf(bytes)', encode_bytes(art))) == scene
# Untransformed scene movie for this exact input, from the scene contract the new router selects.
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
assert uri.startswith('data:application/json;base64,')
metadata = json.loads(base64.b64decode(uri.split(',', 1)[1], validate=True))
traits = {t['trait_type']: t['value'] for t in metadata['attributes']}
assert traits['Art Version'] == 'BLOCKS_VIDEO_V3' and traits['Rare'] == ('Yes' if scene == 7 else 'No')
assert metadata['animation_url'].startswith('data:text/html,') and 'gif' not in metadata['image'][:40]
encoded = re.search(r'const encoded="([A-Za-z0-9+/=]+)";', unquote(metadata['animation_url'])).group(1)
movie = base64.b64decode(encoded, validate=True)
assert movie == dynamic(call(collection, 'video(uint256)', tid))
assert len(movie) == len(reference) == 1477976 and movie[:4] == b'RIFF' and movie[8:12] == b'AVI '

out = ROOT / 'previews/blocks-video-v3-sepolia'; out.mkdir(exist_ok=True)
avi_path = out / f'{token}.avi'; avi_path.write_bytes(movie)
original = np.array([list(reference[212 + i * 4:215 + i * 4][::-1]) for i in range(256)], np.uint8)
pal = palette(original, r)
assert bytes(c for i in range(256) for c in movie[212 + i * 4:215 + i * 4][::-1]) == pal.tobytes()
expected = []
for frame in range(90):
    source = (r['phase'] + (-frame if r['reverse'] else frame)) % 90
    indices = np.frombuffer(reference, dtype=np.uint8, offset=1256 + source * 16392, count=16384).reshape(128, 128)[::-1]
    result = compose(badge(indices, scene), r)
    native = np.frombuffer(movie, dtype=np.uint8, offset=1256 + frame * 16392, count=16384).reshape(128, 128)[::-1]
    assert np.array_equal(native, result), f'frame {frame}'
    expected.append(pal[result].tobytes())
decoded = subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(avi_path), '-vsync', '0', '-f', 'rawvideo',
                          '-pix_fmt', 'rgb24', '-threads', '1', '-'], capture_output=True, check=True)
assert not decoded.stderr and decoded.stdout == b''.join(expected), 'FFmpeg decode differs'
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-of', 'json',
                                            str(avi_path)]))['streams'][0]
assert probe['avg_frame_rate'] == '15/1' and int(probe['nb_read_frames']) == 90 and abs(float(probe['duration']) - 6) < 1e-8
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
path = ROOT / 'deployments/blocks-video-v3-sepolia.json'
manifest = json.loads(path.read_text()) if path.exists() else {}
manifest.update({
    'status': 'deployed', 'network': 'Ethereum Sepolia', 'chain_id': 11155111,
    'collection_name': 'blocks', 'collection_symbol': 'blocks', 'art_version': 'BLOCKS_VIDEO_V3',
    'collection': collection, 'renderer': renderer, 'scene_router': router, 'descent_v3': descent,
    'scenes': dict(zip(['canyon', 'descent', 'monorail', 'spire', 'skyline', 'alley', 'nighttrain', 'satoyama'], slots)),
    'reused_scenes_from': 'deployments/blocks-sepolia.json',
    'mint_signature': 'mint()', 'token_id': 'execution block number',
    'limit': 'one NFT per block, first successful caller',
    'image': 'native SVG of final AVI frame 0',
    'animation_url': 'self-contained HTML data URI embedding AVI and decoder', 'gif_in_metadata': False,
    'format': 'AVI BI_RGB', 'width': 128, 'height': 128, 'frames': 90, 'fps': 15, 'duration_seconds': 6,
    'compiler': '0.8.37+commit.f401782d', 'evm_version': 'amsterdam', 'profile': 'default',
    'optimizer_runs': 200, 'via_ir': True, 'experimental': True,
    'deployer': env['DEPLOYER_ADDRESS'], 'first_token_id': token, 'first_scene': metadata['name'].split(' #')[0],
    'first_recipe': {k: (str(v) if k == 'tint' else v) for k, v in r.items()},
    'transaction_hashes': [t['hash'] for t in transactions], 'receipts': receipts,
    'gas_used': gas, 'transaction_fee_wei': str(fee), 'runtimes': runtimes, 'runtime_verified': True,
    'broadcast_authorization': 'explicit_user_approval_2026-10-19',
    'live_media_validation': {
        'gas_cap': CAP, 'token_uri_min_passing_call_gas': uri_gas, 'token_uri_bytes': len(uri),
        'avi_bytes': len(movie), 'avi_sha256': sha(movie), 'svg_bytes': len(svg), 'svg_sha256': sha(svg),
        'block_fields_match_mint_block': True,
        'independent_reference': 'seed, recipe and scene input rebuilt in Python; all 90 frames, palette, FFmpeg decode '
                                 'and SVG poster match scripts/blocks_diversity_reference.py transforms of the router AVI',
        'files': f'previews/blocks-video-v3-sepolia/{token}.*'},
    'mint_enabled': False,
    'marketplace_playback': manifest.get('marketplace_playback', {'status': 'not_checked'}),
    'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
})
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(dict(collection=collection, token=token, scene=manifest['first_scene'], gas=gas, fee_wei=str(fee),
                      token_uri_gas=uri_gas, token_uri_bytes=len(uri), avi_sha256=sha(movie)), indent=2, ensure_ascii=False))
