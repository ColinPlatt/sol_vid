#!/usr/bin/env python3
"""Copy exact Solidity-generated V2 GIFs and derived static posters to the mint page."""
import json
import shutil
from pathlib import Path
from PIL import Image
from vapor_reference import traits

ROOT = Path(__file__).resolve().parents[1]
assets = ROOT / "mint-page/dist/assets"
seeds = [1, 2, 4, 6, 42, 99, 2026]
for seed in seeds:
    recipe = traits(seed)
    stem = f"gif-64-25-{recipe['scene']}-seed{seed}"
    source = ROOT / "previews" / f"{stem}.gif"
    measured = json.loads(source.with_suffix(".json").read_text())
    assert measured["success"] and measured["gas"] < 500_000_000
    shutil.copyfile(source, assets / f"seed-{seed}.gif")
    with Image.open(source) as im:
        im.seek(12)
        im.convert("RGB").resize((512, 512), Image.Resampling.NEAREST).save(assets / f"seed-{seed}.png")
for old in assets.glob("seed-*.*"):
    if int(old.stem.split("-")[1]) not in seeds:
        old.unlink()
print("Synced exact onchain GIFs and offchain static posters for seven V2 seeds.")
