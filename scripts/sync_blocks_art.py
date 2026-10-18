#!/usr/bin/env python3
"""Copy only validated Solidity-rendered block-art previews into the separate page."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'previews/blockart';dest=ROOT/'mint-page/dist/blocks/assets'
report=json.loads((source/'validation-blocks_base.json').read_text())
if report['profile']!='blocks_base' or len(report['scenes'])!=8:raise SystemExit('Validate all Base scenes first')
dest.mkdir(parents=True,exist_ok=True)
for scene in report['scenes']:
    if scene['token_uri_gas']>500_000_000 or scene['dense_synthetic_metadata_gas']>500_000_000:raise SystemExit('Gas gate failed')
    import hashlib
    path=source/(scene['scene']+'.gif')
    if hashlib.sha256(path.read_bytes()).hexdigest()!=scene['gif_sha256']:raise SystemExit('Media changed after validation')
    shutil.copyfile(path,dest/path.name)
print('Synced eight validated Base GIFs; mint configuration unchanged')
