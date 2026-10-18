#!/usr/bin/env bash
# Broadcast only after explicit authorization. Password stays in the local terminal.
set -euo pipefail
cd "$(dirname "$0")/.."
kind="${1:-}"
case "$kind" in
  candidate) entry=DeployVideoCandidateBase ;;
  edition)
    python3 - <<'PY'
import json
from urllib.parse import urlparse
r=json.load(open('deployments/video-base.json'))['candidate']
e=r.get('opensea_playback',{});u=urlparse(e.get('evidence_url') or '')
assert r['status']=='deployed' and e.get('status')=='passed' and e.get('checked_at_utc'),'Candidate has not passed OpenSea playback'
assert u.scheme=='https' and u.hostname=='opensea.io' and f"/base/{r['collection'].lower()}/" in u.path.lower(),'Candidate evidence mismatch'
PY
    entry=DeployVideoBase ;;
  *) echo 'Usage: broadcast_video.sh candidate|edition' >&2; exit 2 ;;
esac
forge_bin="${FORGE_BIN:-/tmp/ghoulballs-toolchain/forge}"
if [[ ! -x "$forge_bin" ]]; then forge_bin=forge; fi
export FOUNDRY_PROFILE=base
export FOUNDRY_SOLC="${FOUNDRY_SOLC:-/usr/bin/solc}"
exec "$forge_bin" script "script/DeployVideo.s.sol:$entry" \
  --rpc-url https://mainnet.base.org --chain 8453 \
  --account ghoulballs_base --sender 0xBb789F9508DFBDd31De814E7A13ee1B549703D68 \
  --broadcast --slow --offline -vv
