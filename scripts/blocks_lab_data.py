#!/usr/bin/env python3
"""Collect measured blocks previews into the site's art lab (blocks-page/dist/lab).

Copies V2/V3 first-frame posters and the V3 diversity images, and writes data.json
with capped-call gas per scene, V3 recipes, stress cases and the diversity audit
summary. Run after regenerating previews; it only reads `previews/`.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "previews"
LAB = ROOT / "blocks-page" / "dist" / "lab"
SCENES = ["canyon", "descent", "monorail", "spire", "skyline", "alley", "nighttrain", "satoyama"]


def read(path):
    return json.loads(path.read_text()) if path.exists() else None


def main():
    assets = LAB / "assets"
    for sub in ("v2", "v3", "stress", "audit"):
        (assets / sub).mkdir(parents=True, exist_ok=True)
    data = {"scenes": SCENES, "v1": {}, "v2": {}, "v3": {}, "stress": [], "audit": None}
    for scene in SCENES:
        v1 = read(PREVIEWS / "blocks-single" / f"{scene}.json")
        if v1:
            data["v1"][scene] = {"metadata_gas": v1["metadata_gas"], "block": v1.get("block")}
        for version, folder in (("v2", "blocks-video"), ("v3", "blocks-video-v3")):
            meta = read(PREVIEWS / folder / f"{scene}.json")
            poster = PREVIEWS / folder / f"{scene}.svg"
            if meta and poster.exists():
                shutil.copyfile(poster, assets / version / f"{scene}.svg")
                data[version][scene] = {k: v for k, v in meta.items() if k != "tint"}
    for meta_path in sorted(PREVIEWS.glob("blocks-video-v3/stress-*.json"), key=lambda p: int(p.stem.split("-")[1])):
        poster = meta_path.with_suffix(".svg")
        if not poster.exists():
            continue
        shutil.copyfile(poster, assets / "stress" / poster.name)
        meta = {k: v for k, v in read(meta_path).items() if k != "tint"}
        meta["poster"] = f"assets/stress/{poster.name}"
        data["stress"].append(meta)
    audit = read(PREVIEWS / "blocks-diversity-v3" / "audit.json")
    if audit:
        keys = ["version", "status", "samples", "scene_counts", "distinct_masked_rgb_frames", "structure_close_pairs",
                "near_duplicate_pairs", "tokens_in_near_duplicate_pairs", "near_duplicate_token_fraction"]
        data["audit"] = {k: audit.get(k) for k in keys}
        data["audit"]["exact_rgb_duplicates"] = len(audit.get("exact_rgb_duplicate_pairs") or [])
        data["audit"]["exact_geometry_duplicates"] = len(audit.get("exact_index_geometry_duplicate_pairs") or [])
        for name in ("overview.png", "closest-pairs.png"):
            source = PREVIEWS / "blocks-diversity-v3" / name
            if source.exists():
                shutil.copyfile(source, assets / "audit" / name)
    (LAB / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"lab data: {len(data['v1'])} V1, {len(data['v2'])} V2, {len(data['v3'])} V3 scenes, {len(data['stress'])} stress cases")


if __name__ == "__main__":
    main()
