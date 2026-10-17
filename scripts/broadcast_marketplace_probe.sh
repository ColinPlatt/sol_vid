#!/usr/bin/env bash
# The user authorized this Base probe on 2026-10-17. Unlock the signer locally;
# never paste the password or private key into chat, command arguments or this file.
set -euo pipefail
cd "$(dirname "$0")/.."
forge_bin="${FORGE_BIN:-/tmp/ghoulballs-toolchain/forge}"
if [[ ! -x "$forge_bin" ]]; then forge_bin=forge; fi
export FOUNDRY_PROFILE=base
export FOUNDRY_SOLC="${FOUNDRY_SOLC:-/usr/bin/solc}"
export PROBE_DEPLOYER_ADDRESS=0xBb789F9508DFBDd31De814E7A13ee1B549703D68
export PROBE_HOSTED_HTML_URL=https://ghoulballs.vercel.app/probe/player.html
python3 - <<'PY'
import urllib.request
from pathlib import Path
remote=urllib.request.urlopen('https://ghoulballs.vercel.app/probe/player.html',timeout=30).read()
assert remote==Path('fixtures/marketplace-probe/html-js.html').read_bytes(),'Hosted probe control differs'
PY
exec "$forge_bin" script script/DeployMarketplaceProbe.s.sol:DeployMarketplaceProbeBase \
  --rpc-url https://mainnet.base.org --chain 8453 \
  --account ghoulballs_base --sender "$PROBE_DEPLOYER_ADDRESS" \
  --broadcast --slow --offline -vv
