#!/usr/bin/env python3
"""Regression checks for build failures that must survive Python optimization."""
import shutil
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    fixture = Path(directory)
    for name in ('scripts/build_video_player.py', 'players/avi-rle.mjs', 'src/AviPlayer.sol'):
        target = fixture / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    command = ['python3', '-O', str(fixture / 'scripts/build_video_player.py'), '--check']
    subprocess.run(command, check=True)
    constants = fixture / 'src/AviPlayer.sol'
    constants.write_text(constants.read_text() + '// stale\n')
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0 or 'stale' not in result.stderr:
        raise SystemExit('Optimized Python failed to reject stale constants')
    source = fixture / 'players/avi-rle.mjs'
    source.write_text(source.read_text().replace('export function decodeAVI', 'export function renamedDecoder'))
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0 or 'decodeAVI export' not in result.stderr:
        raise SystemExit('Renamed decoder export was not rejected explicitly')
print('PASS player freshness and renamed-export failures under python -O')
