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
manifest = ROOT / 'deployments/blocks-single-sepolia.json'
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
# Explicitly bounded fees; this is a cap, not the effective gas price. Avoid a default gwei-scale testnet tip.
gas_price = int(rpc('eth_gasPrice', []), 16)
fee_cap = max(gas_price * 4, 1000)
if fee_cap > 1_000_000:
    raise SystemExit('Unexpected Sepolia gas price: refresh the deployment estimate before broadcasting')
priority = max(int(rpc('eth_maxPriorityFeePerGas', []), 16), 1)
balance = int(rpc('eth_getBalance', [env['DEPLOYER_ADDRESS'], 'latest']), 16)
if balance < 30_000_000 * fee_cap:
    raise SystemExit('Deployment wallet lacks the conservative 30M-gas fee-cap allowance')
print(f'Ethereum Sepolia single-block collection, wallet {env["DEPLOYER_ADDRESS"]}, balance {balance / 1e18:.9f} test ETH', flush=True)
print(f'Gas price {gas_price} wei; max fee {fee_cap} wei; mode {"BROADCAST" if args.broadcast else "SIMULATION"}', flush=True)
command = [env.get('FORGE_BIN', '/tmp/ghoulballs-toolchain/forge'), 'script',
           'script/DeploySingleBlock.s.sol:DeploySingleBlockSepolia', '--rpc-url', env['SEPOLIA_RPC_URL'],
           '--sender', env['DEPLOYER_ADDRESS'], '--chain', '11155111', '--offline',
           '--use', env.get('SOLC_BIN', '/tmp/ghoulballs-toolchain/solc'), '--slow',
           '--with-gas-price', str(fee_cap), '--priority-gas-price', str(priority), '-vv']
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
