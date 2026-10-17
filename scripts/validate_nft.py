#!/usr/bin/env python3
"""Decode exported NFT sets (GIF, AVI and MPEG tokens): verify traits, seeds, media, players, timing and pixels."""
import base64
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
from PIL import Image
from vapor_reference import traits as vapor_traits, frame as vapor_frame, THEMES, MOTIONS
from build_players import HEAD, tail

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "previews" / "nft"
FORMATS = [("gif", "GIF", 10), ("avi", "AVI", 25), ("mpeg", "MPEG-1", 25)]
SVG_HEAD = ("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'"
            "%20width='1024'%20height='1024'%3E%3Cimage%20width='64'%20height='64'%20image-rendering='optimizeSpeed'"
            "%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,")
SVG_TAIL = "'/%3E%3C/svg%3E"


def run(*args):
    result = subprocess.run(args, capture_output=True, check=True)
    assert not result.stderr, result.stderr.decode()
    return result.stdout


def data_uri(uri, mime):
    prefix = f"data:{mime};base64,"
    assert uri.startswith(prefix)
    return base64.b64decode(uri[len(prefix):], validate=True)


def sharp_gif(uri):
    """The image is a pixelated SVG wrapper; check it decodes to well-formed SVG and return the GIF inside."""
    assert uri.startswith(SVG_HEAD) and uri.endswith(SVG_TAIL)
    svg = ET.fromstring(unquote(uri[len("data:image/svg+xml,"):]))
    image = svg.find("{http://www.w3.org/2000/svg}image")
    assert svg.get("viewBox") == "0 0 64 64" and svg.get("width") == svg.get("height") == "1024"
    assert "image-rendering:pixelated" in image.get("style")
    return data_uri(image.get("href"), "image/gif")


def player(uri, decoder):
    """The animation is percent-encoded HTML around base64 media; check the page is exactly the built player."""
    prefix = "data:text/html,"
    assert uri.startswith(prefix)
    html = unquote(uri[len(prefix):])
    assert html.startswith(HEAD) and html.endswith(tail(decoder))
    return html, base64.b64decode(html[len(HEAD):-len(tail(decoder))], validate=True)


def abi_string(path):
    data = path.read_bytes()
    offset = int.from_bytes(data[:32], "big")
    size = int.from_bytes(data[offset:offset + 32], "big")
    return data[offset + 32:offset + 32 + size].decode()


results = []
for label in ["set-1", "stress"]:
    tokens = {}
    for stem, name, fps in FORMATS:
        measured = json.loads((ART / f"{label}-{stem}.json").read_text())
        uri = (ART / f"{label}-{stem}.uri.txt").read_text()
        assert len(uri) == measured["uri_bytes"] and measured["gas"] < 500_000_000
        metadata = json.loads(data_uri(uri, "application/json"))
        tokens[stem] = (measured, uri, metadata)
    measured = tokens["gif"][0]
    seed, set_id, first = int(measured["seed"]), measured["set"], measured["token_id"]
    assert first == 3 * set_id - 2

    # Independent ABI encoding of the public, per-set seed derivation.
    domain = b"GHOULBALLS_SET_V1"
    encoded = (128).to_bytes(32, "big") + measured["chain_id"].to_bytes(32, "big")
    encoded += int(measured["collection"], 16).to_bytes(32, "big") + set_id.to_bytes(32, "big")
    encoded += len(domain).to_bytes(32, "big") + domain.ljust(32, b"\0")
    assert int(run("cast", "keccak", "0x" + encoded.hex()).strip(), 16) == seed

    recipe = (ART / f"{label}.recipe.abi").read_bytes()
    def word(p): return int.from_bytes(recipe[p:p + 32], "big")
    reference = vapor_traits(seed)
    gifs = set()
    for i, (stem, name, fps) in enumerate(FORMATS):
        token_measured, uri, metadata = tokens[stem]
        assert token_measured["token_id"] == first + i and int(token_measured["seed"]) == seed
        assert metadata["name"] == f"ghoulballs #{set_id} {name}"
        attributes = {a["trait_type"]: a["value"] for a in metadata["attributes"]}
        assert attributes["Format"] == name and attributes["Set"] == set_id and attributes["FPS"] == fps
        assert attributes["Art Version"] == "GHOULBALLS_VAPOR_V3" and attributes["Duration Seconds"] == 2
        assert attributes["Theme"] == THEMES[reference["theme"]] and attributes["Motion"] == MOTIONS[reference["motion"]]
        assert attributes["Seed"] == str(seed) and attributes["Ball Count"] == reference["ball_count"]
        start = word(0)
        assert word(start) == seed and word(start + 64) == attributes["Ball Count"]
        ball_start = start + word(start + 128)
        for b in range(attributes["Ball Count"]):
            p = ball_start + 32 + b * 128
            assert attributes[f"Ball {b + 1} Radius"] == word(p)
            assert attributes[f"Ball {b + 1} Colour"] == "0x" + recipe[p + 96:p + 99].hex()
        gifs.add(sharp_gif(metadata["image"]))
        assert ("animation_url" in metadata) == (stem != "gif")
        (ART / f"{label}-{stem}.metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    assert len(gifs) == 1, "The three tokens of a set must share one image"
    gif = gifs.pop()
    assert abi_string(ART / f"{label}.image-uri.abi") == tokens["gif"][2]["image"]

    avi_html, avi = player(tokens["avi"][2]["animation_url"], "avi.js")
    mpeg_html, mpg = player(tokens["mpeg"][2]["animation_url"], "mpeg.js")
    assert avi == (ART / f"{label}.avi").read_bytes(), "AVI player must embed the token's avi() bytes"
    for stem, html in [("avi", avi_html), ("mpeg", mpeg_html)]:
        assert abi_string(ART / f"{label}.{stem}-animation-uri.abi") == tokens[stem][2]["animation_url"]
        (ART / f"{label}-{stem}.player.html").write_text(html)
    (ART / f"{label}.gif").write_bytes(gif)
    (ART / f"{label}.mpg").write_bytes(mpg)
    print(run("node", str(ROOT / "scripts" / "validate_players.mjs"), str(ART / f"{label}-avi.player.html"), str(ART / f"{label}-mpeg.player.html")).decode().strip())

    rgb = run("ffmpeg", "-v", "error", "-i", str(ART / f"{label}.avi"), "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-")
    assert len(rgb) == 50 * 64 * 64 * 3
    for f in range(50):
        assert rgb[f * 64 * 64 * 3:(f + 1) * 64 * 64 * 3] == vapor_frame(f, 25, seed)[0], f"V2 reference mismatch: {label}, frame {f}"
    with Image.open(ART / f"{label}.gif") as im:
        assert im.size == (64, 64) and im.n_frames == 20 and im.info["loop"] == 0
        duration = 0
        for f in range(20):
            im.seek(f)
            duration += im.info["duration"]
            assert im.info["duration"] == 100
            assert im.convert("RGB").tobytes() == vapor_frame(f, 10, seed)[0], f"GIF reference mismatch: {label}, frame {f}"
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
        frame = rgb[f * 64 * 64 * 3:(f + 1) * 64 * 64 * 3]
        expected = bytes(16 + ((66 * frame[p] + 129 * frame[p + 1] + 25 * frame[p + 2] + 128) >> 8) for p in range(0, len(frame), 3))
        expected = Image.frombytes("L", (64, 64), expected).resize((512, 512), Image.Resampling.NEAREST).tobytes()
        assert yuv[f * stride:f * stride + 512 * 512] == expected
    run("ffmpeg", "-v", "error", "-y", "-i", str(ART / f"{label}.mpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(ART / f"{label}.preview.mp4"))
    summary = dict(set=set_id, first_token_id=first, ball_count=reference["ball_count"],
                   gif_bytes=len(gif), avi_bytes=len(avi), mpg_bytes=len(mpg))
    for stem, _, _ in FORMATS:
        summary[f"{stem}_gas"] = tokens[stem][0]["gas"]
        summary[f"{stem}_uri_bytes"] = tokens[stem][0]["uri_bytes"]
    results.append(summary)
    print(f"PASS {label}: set {set_id}; tokenURI gas GIF {summary['gif_gas']:,}, AVI {summary['avi_gas']:,}, MPEG {summary['mpeg_gas']:,}")
(ART / "validation.json").write_text(json.dumps(results, indent=2) + "\n")
print("Sets, seeds, traits, pixelated SVG GIF, onchain AVI/MPEG players (decoders vs FFmpeg), MPEG timing and AVI/GIF reference pixels verified.")
