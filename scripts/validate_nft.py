#!/usr/bin/env python3
"""Decode exported NFT tokenURI, verify its traits, media, timing and pixels."""
import base64
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
from PIL import Image
from vapor_reference import traits as vapor_traits, frame as vapor_frame, THEMES, MOTIONS

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "previews" / "nft"


def run(*args):
    result = subprocess.run(args, capture_output=True, check=True)
    assert not result.stderr, result.stderr.decode()
    return result.stdout


def data_uri(uri, mime):
    prefix = f"data:{mime};base64,"
    assert uri.startswith(prefix)
    return base64.b64decode(uri[len(prefix):], validate=True)


SVG_HEAD = ("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'"
            "%20width='1024'%20height='1024'%3E%3Cimage%20width='64'%20height='64'%20image-rendering='optimizeSpeed'"
            "%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,")
SVG_TAIL = "'/%3E%3C/svg%3E"


def sharp_gif(uri):
    """The image is a pixelated SVG wrapper; check it decodes to well-formed SVG and return the GIF inside."""
    assert uri.startswith(SVG_HEAD) and uri.endswith(SVG_TAIL)
    svg = ET.fromstring(unquote(uri[len("data:image/svg+xml,"):]))
    image = svg.find("{http://www.w3.org/2000/svg}image")
    assert svg.get("viewBox") == "0 0 64 64" and svg.get("width") == svg.get("height") == "1024"
    assert "image-rendering:pixelated" in image.get("style")
    return data_uri(image.get("href"), "image/gif")


def abi_string(path):
    data = path.read_bytes()
    offset = int.from_bytes(data[:32], "big")
    size = int.from_bytes(data[offset:offset + 32], "big")
    return data[offset + 32:offset + 32 + size].decode()


results = []
for label in ["token-1", "stress"]:
    measured = json.loads((ART / f"{label}.json").read_text())
    seed = int(measured["seed"])
    token_id = measured["token_id"]
    uri = (ART / f"{label}.uri.txt").read_text()
    assert len(uri) == measured["uri_bytes"] and measured["gas"] < 500_000_000
    metadata = json.loads(data_uri(uri, "application/json"))
    assert metadata["name"] == f"ghoulballs #{token_id}"
    attributes = {a["trait_type"]: a["value"] for a in metadata["attributes"]}
    reference = vapor_traits(seed)
    assert attributes["Art Version"] == "GHOULBALLS_VAPOR_V2"
    assert attributes["Theme"] == THEMES[reference["theme"]]
    assert attributes["Motion"] == MOTIONS[reference["motion"]]
    assert attributes["Seed"] == str(seed)
    assert attributes["Ball Count"] in [1, 2, 4, 6]
    assert attributes["Duration Seconds"] == 2 and attributes["Video FPS"] == 25
    assert attributes["Video Format"] == "MPEG-1"

    # Independent ABI encoding of the public seed derivation.
    domain = b"SOL_VIDEO_NFT_V1"
    encoded = (128).to_bytes(32, "big") + measured["chain_id"].to_bytes(32, "big")
    encoded += int(measured["collection"], 16).to_bytes(32, "big") + token_id.to_bytes(32, "big")
    encoded += len(domain).to_bytes(32, "big") + domain.ljust(32, b"\0")
    assert int(run("cast", "keccak", "0x" + encoded.hex()).strip(), 16) == seed

    recipe = (ART / f"{label}.recipe.abi").read_bytes()
    def word(p): return int.from_bytes(recipe[p:p + 32], "big")
    start = word(0)
    assert word(start) == seed and word(start + 64) == attributes["Ball Count"]
    ball_start = start + word(start + 128)
    assert word(ball_start) == attributes["Ball Count"]
    for i in range(attributes["Ball Count"]):
        p = ball_start + 32 + i * 128
        assert attributes[f"Ball {i + 1} Radius"] == word(p)
        assert attributes[f"Ball {i + 1} Colour"] == "0x" + recipe[p + 96:p + 99].hex()

    gif = sharp_gif(metadata["image"])
    mpg = data_uri(metadata["animation_url"], "video/mpeg")
    (ART / f"{label}.gif").write_bytes(gif)
    (ART / f"{label}.mpg").write_bytes(mpg)
    (ART / f"{label}.metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    for field, stem in [("image", "image-uri"), ("animation_url", "animation-uri")]:
        path = ART / f"{label}.{stem}.abi"
        if path.exists(): assert abi_string(path) == metadata[field]

    avi = run("ffmpeg", "-v", "error", "-i", str(ART / f"{label}.avi"), "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-")
    assert len(avi) == 50 * 64 * 64 * 3
    for f in range(50):
        assert avi[f * 64 * 64 * 3:(f + 1) * 64 * 64 * 3] == vapor_frame(f, 25, seed)[0], f"V2 reference mismatch: {label}, frame {f}"
    with Image.open(ART / f"{label}.gif") as im:
        assert im.size == (64, 64) and im.n_frames == 20 and im.info["loop"] == 0
        duration = 0
        for f in range(20):
            im.seek(f)
            duration += im.info["duration"]
            assert im.info["duration"] == 100
            if f % 2 == 0:
                offset = (f * 5 // 2) * 64 * 64 * 3
                assert im.convert("RGB").tobytes() == avi[offset:offset + 64 * 64 * 3]
        assert duration == 2000

    frames = json.loads(run("ffprobe", "-v", "error", "-show_frames", "-show_entries", "frame=width,height,pts_time,pkt_duration_time", "-of", "json", str(ART / f"{label}.mpg")))["frames"]
    assert len(frames) == 50
    for i, frame in enumerate(frames):
        assert (frame["width"], frame["height"]) == (512, 512)
        assert abs(float(frame["pts_time"]) - i / 25) < 1e-6
        assert abs(float(frame["pkt_duration_time"]) - 0.04) < 1e-6
    yuv = run("ffmpeg", "-v", "error", "-i", str(ART / f"{label}.mpg"), "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-")
    stride = 512 * 512 * 3 // 2
    assert len(yuv) == 50 * stride
    for f in range(50):
        frame = avi[f * 64 * 64 * 3:(f + 1) * 64 * 64 * 3]
        expected = bytes(16 + ((66 * frame[p] + 129 * frame[p + 1] + 25 * frame[p + 2] + 128) >> 8) for p in range(0, len(frame), 3))
        expected = Image.frombytes("L", (64, 64), expected).resize((512, 512), Image.Resampling.NEAREST).tobytes()
        assert yuv[f * stride:f * stride + 512 * 512] == expected
    run("ffmpeg", "-v", "error", "-y", "-i", str(ART / f"{label}.mpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(ART / f"{label}.preview.mp4"))
    results.append(dict(token_id=token_id, gas=measured["gas"], uri_bytes=len(uri), gif_bytes=len(gif), mpg_bytes=len(mpg), ball_count=attributes["Ball Count"]))
    print(f"PASS {label}: {measured['gas']:,} gas, {len(uri):,} URI bytes, {attributes['Ball Count']} balls")
(ART / "validation.json").write_text(json.dumps(results, indent=2) + "\n")
print("NFT JSON, seed, traits, pixelated SVG-wrapped GIF, MPEG, standalone URI methods and AVI correspondence verified.")
