#!/usr/bin/env bash
# BLOCKS_VIDEO_V4 on Base: band formatter, renderer, collection and first mint, reusing the V3 scene router.
# Usage: scripts/broadcast_blocks_v3_base.sh          # simulate only
#        scripts/broadcast_blocks_v3_base.sh --broadcast   # sign with the ghoulballs_base keystore and verify
# The keystore password stays in the local terminal.
set -euo pipefail
cd "$(dirname "$0")/.."
export FOUNDRY_PROFILE=blocks_base
args=(script script/DeployBlocksV4Base.s.sol:DeployBlocksV4Base
  --rpc-url https://mainnet.base.org --chain 8453
  --sender 0xBb789F9508DFBDd31De814E7A13ee1B549703D68 --gas-limit 600000000 --slow -vv)
if [[ "${1:-}" == "--broadcast" ]]; then
  args+=(--account ghoulballs_base --broadcast --verify)
fi
exec forge "${args[@]}"
