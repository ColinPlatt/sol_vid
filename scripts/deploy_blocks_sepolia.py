#!/usr/bin/env python3
"""Rehearse, or explicitly broadcast, blocks on Ethereum Sepolia. Never prints signing credentials."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--broadcast', action='store_true', help='Send transactions; requires prior deployment authorization')
p.add_argument('--env-file', type=Path, default=ROOT / '.env')
args = p.parse_args()
manifest = ROOT / 'deployments/blocks-sepolia.json'
if args.broadcast and manifest.exists() and json.loads(manifest.read_text()).get('status') == 'deployed':
    p.error('blocks is already deployed on Ethereum Sepolia; refusing a duplicate broadcast')
env = os.environ.copy()
for line in args.env_file.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    if line.startswith('export '):
        line = line[7:]
    key, sep, value = line.partition('=')
    if sep:
        words = shlex.split(value, comments=True)
        env[key.strip()] = ' '.join(words)
for key in ['SEPOLIA_RPC_URL', 'DEPLOYER_PRIVATE_KEY', 'DEPLOYER_ADDRESS']:
    if not env.get(key):
        p.error(f'Missing {key} in local environment')
env['FOUNDRY_PROFILE'] = 'default'
env['PATH'] = str(Path(env.get('FORGE_BIN', '/tmp/ghoulballs-toolchain/forge')).parent) + os.pathsep + env['PATH']

def rpc(method, params):
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params})
    result = subprocess.run(['curl', '-sS', '--fail', '--max-time', '60', '-H', 'content-type: application/json',
                             '--data-binary', '@-', env['SEPOLIA_RPC_URL']], input=payload, text=True,
                            capture_output=True, check=False)
    if result.returncode:
        raise SystemExit('Sepolia RPC request failed; check the local RPC setting')
    value = json.loads(result.stdout)
    if 'error' in value:
        raise SystemExit('Sepolia RPC error: ' + str(value['error'].get('message', 'unknown error')))
    return value['result']

if int(rpc('eth_chainId', []), 16) != 11155111:
    raise SystemExit('RPC is not Ethereum Sepolia (11155111)')
sys.path.insert(0, str(ROOT / 'scripts'))
import blockart_fixtures as fixtures
height = int(rpc('eth_blockNumber', []), 16)
# Choose a completed epoch with a few confirmations, leaving ample time for eleven transactions.
epoch = (height - 20) // 10
headers = []
last = None
for number in range(epoch * 10, epoch * 10 + 10):
    block = rpc('eth_getBlockByNumber', [hex(number), False])
    encoded = fixtures.header(block)
    digest = subprocess.check_output([env.get('CAST_BIN', '/tmp/ghoulballs-toolchain/cast'), 'keccak',
                                      '0x' + encoded.hex()], text=True).strip()
    if digest.lower() != block['hash'].lower() or (last and block['parentHash'].lower() != last.lower()):
        raise SystemExit('Header proof hash or parent mismatch; refusing deployment')
    headers.append('0x' + encoded.hex())
    last = digest
proof = {'epoch': epoch, 'last_hash': last, 'headers': headers}
env['BLOCKART_EPOCH'] = str(epoch)
env['BLOCKART_HEADERS_JSON'] = json.dumps(proof)
# Explicitly bounded fees; this is a cap, not the effective gas price. Avoid a default gwei-scale testnet tip.
gas_price = int(rpc('eth_gasPrice', []), 16)
fee_cap = max(gas_price * 4, 1000)
if fee_cap > 1_000_000:
    raise SystemExit('Unexpected Sepolia gas price: refresh the deployment estimate before broadcasting')
priority = max(int(rpc('eth_maxPriorityFeePerGas', []), 16), 1)
balance = int(rpc('eth_getBalance', [env['DEPLOYER_ADDRESS'], 'latest']), 16)
if balance < 400_000_000 * fee_cap:
    raise SystemExit('Deployment wallet lacks the conservative 400M-gas fee-cap allowance')
print(f'Ethereum Sepolia: epoch {epoch}, wallet {env["DEPLOYER_ADDRESS"]}, balance {balance / 1e18:.9f} test ETH', flush=True)
print(f'Gas price {gas_price} wei; max fee {fee_cap} wei; mode {"BROADCAST" if args.broadcast else "SIMULATION"}', flush=True)
command = [env.get('FORGE_BIN', '/tmp/ghoulballs-toolchain/forge'), 'script',
           'script/DeployBlockArt.s.sol:DeployBlockArtSepolia', '--rpc-url', env['SEPOLIA_RPC_URL'],
           '--sender', env['DEPLOYER_ADDRESS'], '--chain', '11155111', '--offline',
           '--use', env.get('SOLC_BIN', '/tmp/ghoulballs-toolchain/solc'), '--slow',
           '--with-gas-price', str(fee_cap), '--priority-gas-price', str(priority), '-vv']
target = ROOT / 'broadcast' / 'blocks-sepolia-proof.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(proof, indent=2) + '\n')
if args.broadcast:
    command.append('--broadcast')
    if env.get('ETHERSCAN_API_KEY'):
        command += ['--verify', '--verifier', 'etherscan']
# Keep stdout useful while making sure a failing trace cannot reveal a local credential.
result = subprocess.run(command, env=env, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
output = result.stdout
for secret in [env['DEPLOYER_PRIVATE_KEY'], str(int(env['DEPLOYER_PRIVATE_KEY'], 16)), env['SEPOLIA_RPC_URL'], env.get('ETHERSCAN_API_KEY', '')]:
    if secret:
        output = output.replace(secret, '[REDACTED]')
print(output)
sys.exit(result.returncode)
