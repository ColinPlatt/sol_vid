#!/usr/bin/env python3
"""Independently decode Solidity output. Requires ffmpeg, ffprobe and Pillow.

Run forge test --offline -vv first. MP4s here are *offchain viewing copies*.
The .m1v, .avi and .gif files are the unmodified contract return bytes.
"""
import json
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw
from vapor_reference import traits as vapor_traits, frame as vapor_frame, THEMES, MOTIONS

ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "previews"


def run(*args):
    p = subprocess.run(args, capture_output=True, check=True)
    if p.stderr:
        raise AssertionError(p.stderr.decode())
    return p.stdout


def decode(path, fmt="rgb24"):
    return run("ffmpeg", "-v", "error", "-i", str(path), "-vsync", "0", "-f", "rawvideo", "-pix_fmt", fmt, "-")


def probe(path):
    return json.loads(run("ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(path)))["streams"][0]


@lru_cache(maxsize=None)
def keccak_int(encoded):
    return int(run("cast", "keccak", "0x" + encoded.hex()).strip(), 16)


def ball_hash(seed, ball):
    return keccak_int(seed.to_bytes(32, "big") + ball.to_bytes(32, "big"))


def generated_scene(seed, legacy=False):
    if not legacy:
        return vapor_traits(seed)["scene"]
    domain = b"SOL_VIDEO_BALLS_V1"
    encoded = (64).to_bytes(32, "big") + seed.to_bytes(32, "big") + len(domain).to_bytes(32, "big") + domain.ljust(32, b"\0")
    return 3 + keccak_int(encoded) % 4


def validate_recipe(seed):
    """Decode ABI output independently and check the public traits against the recipe."""
    data = (PREVIEWS / f"recipe-seed{seed}.abi").read_bytes()
    def word(offset):
        return int.from_bytes(data[offset:offset + 32], "big")
    base = word(0)
    scene = generated_scene(seed)
    count = {7: 1, 8: 2, 9: 4, 10: 6}[scene]
    assert (word(base), word(base + 32), word(base + 64)) == (seed, scene, count)
    palette_start = base + word(base + 96)
    assert word(palette_start) == 48
    palette = data[palette_start + 32:palette_start + 80]
    balls_start = base + word(base + 128)
    assert word(balls_start) == count
    reference = vapor_traits(seed)
    assert palette == reference["palette"]
    assert word(base + 160) == reference["theme"] and word(base + 192) == reference["motion"]
    balls = []
    for i in range(count):
        h = ball_hash(seed, i)
        radius = 5 + (h >> 24) % 6
        period = 2 * (63 - 2 * radius)
        start = balls_start + 32 + i * 128
        assert (word(start), word(start + 32), word(start + 64)) == (radius, (h >> 40) % period, (h >> 72) % period)
        colour = reference["palette"][3 * (8 + i):3 * (9 + i)]
        assert data[start + 96:start + 99] == colour == palette[3 * (8 + i):3 * (9 + i)]
        balls.append(dict(radius=radius, x_phase=word(start + 32), y_phase=word(start + 64), colour="#" + colour.hex()))
    return dict(seed=seed, scene=scene, ball_count=count, theme=THEMES[reference["theme"]], motion=MOTIONS[reference["motion"]], art_version="GHOULBALLS_VAPOR_V3", balls=balls)


@lru_cache(maxsize=None)
def balls_reference(scene, f, fps, seed):
    """Independent full-canvas disk rasterizer for the seeded logical 64x64 scene."""
    if scene >= 7:
        return vapor_frame(f, fps, seed)
    palette = bytearray(48)
    for i in range(6):
        h = ball_hash(seed, i)
        palette[3 * (i + 1):3 * (i + 2)] = bytes(64 + ((h >> (8 * c)) % 192) for c in range(3))
    centres = []
    for i in range({3: 1, 4: 2, 5: 4, 6: 6}[scene]):
        h = ball_hash(seed, i)
        radius = 9 + (h >> 24) % 7
        span = 63 - 2 * radius
        travelled = 2 * span * f // (2 * fps)
        def coordinate(start):
            p = (start + travelled) % (2 * span)
            return radius + min(p, 2 * span - p)
        centres.append((coordinate((h >> 40) % (2 * span)), coordinate((h >> 72) % (2 * span)), radius))
    indices = bytearray(64 * 64)
    for y in range(64):
        for x in range(64):
            for i, (cx, cy, r) in enumerate(centres):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    indices[y * 64 + x] = i + 1
    rgb = b"".join(bytes(palette[3 * index:3 * index + 3]) for index in indices)
    luma = bytes(16 + ((66 * palette[3 * i] + 129 * palette[3 * i + 1] + 25 * palette[3 * i + 2] + 128) >> 8) for i in indices)
    return rgb, luma


rows = []
for path in sorted(PREVIEWS.glob("*.json")):
    if path.name == "validation.json":
        continue
    record = json.loads(path.read_text())
    record["name"] = path.stem
    if not record["success"]:
        rows.append(record)
        continue
    kind, size, fps, scene = path.stem.split("-")[:4]
    size, fps, scene = int(size), int(fps), int(scene)
    if record.get("generative"):
        assert scene == generated_scene(record["seed"], legacy=scene < 7), "Wrong scene selected from seed"
    ext = {"mpeg": "m1v", "mpg": "mpg", "avi": "avi", "gif": "gif"}[kind]
    media = path.with_suffix("." + ext)
    stream = probe(media)
    assert (stream["width"], stream["height"]) == (size, size)
    assert int(stream["nb_read_frames"]) == fps * 2
    rgb = decode(media)
    assert len(rgb) == size * size * 3 * fps * 2
    frame_bytes = size * size * 3
    frames = [rgb[i:i + frame_bytes] for i in range(0, len(rgb), frame_bytes)]
    assert len(set(frames)) > 1, "Animation must actually change"
    if scene >= 3 and kind in ("avi", "gif"):
        for f, frame in enumerate(frames):
            expected, _ = balls_reference(scene, f, fps, record["seed"])
            expected = Image.frombytes("RGB", (64, 64), expected).resize((size, size), Image.Resampling.NEAREST).tobytes()
            assert frame == expected, f"Ghoul Balls reference mismatch at frame {f}"
    if kind == "gif":
        # Two independent libraries must agree on every GIF pixel.
        with Image.open(media) as im:
            assert im.n_frames == fps * 2
            duration = 0
            for i, frame in enumerate(frames):
                im.seek(i)
                assert im.convert("RGB").tobytes() == frame
                duration += im.info["duration"]
            assert duration == 2000
        avi = PREVIEWS / path.name.replace("gif-", "avi-").replace(".json", ".avi")
        assert decode(avi) == rgb, "AVI and GIF must decode pixel-identically"
    if kind in ("mpeg", "mpg"):
        assert stream["codec_name"] == "mpeg1video"
        assert stream["avg_frame_rate"] == "25/1"
        if kind == "mpg":
            details = json.loads(run("ffprobe", "-v", "error", "-show_frames", "-show_entries", "frame=pts_time,pkt_duration_time", "-of", "json", str(media)))["frames"]
            for i, frame in enumerate(details):
                assert abs(float(frame["pts_time"]) - i / fps) < 1e-6
                assert abs(float(frame["pkt_duration_time"]) - 1 / fps) < 1e-6
            assert decode(PREVIEWS / path.name.replace("mpg-", "mpeg-").replace(".json", ".m1v")) == rgb
        # Verify the intended DC-only restriction with the decoder's raw Y plane.
        yuv = decode(media, "yuv420p")
        stride = size * size * 3 // 2
        for f in range(fps * 2):
            y_plane = yuv[f * stride:f * stride + size * size]
            if scene >= 3:
                _, expected_y = balls_reference(scene, f, fps, record["seed"])
                expected_y = Image.frombytes("L", (64, 64), expected_y).resize((size, size), Image.Resampling.NEAREST).tobytes()
                assert y_plane == expected_y, f"MPEG luma differs from reference at frame {f}"
            for by in range(0, size, 8):
                for bx in range(0, size, 8):
                    value = y_plane[by * size + bx]
                    for dy in range(8):
                        assert y_plane[(by + dy) * size + bx:(by + dy) * size + bx + 8] == bytes([value]) * 8
    if kind in ("mpeg", "mpg") or (kind == "avi" and scene >= 3):
        # Explicit raw-frame input preserves the exact frame count and frame rate.
        p = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size}x{size}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path.with_suffix(".preview.mp4"))], input=rgb, capture_output=True, check=True)
        assert not p.stderr, p.stderr.decode()
    record.update(codec=stream["codec_name"], decoded_frames=len(frames), duration_seconds=2)
    rows.append(record)
    print(f"PASS {path.stem}: {len(frames)} frames, {record['gas']:,} gas, {record['bytes']:,} bytes")

# A static contact sheet, for quickly inspecting the three MPEG scenes.
images = []
for scene, title in [(0, "NEON ROAD"), (1, "BOUNCING ORB"), (2, "INTERFERENCE")]:
    p = PREVIEWS / f"mpeg-512-25-{scene}.m1v"
    if p.exists():
        rgb = decode(p)
        frame = Image.frombytes("RGB", (512, 512), rgb[10 * 512 * 512 * 3:11 * 512 * 512 * 3])
        panel = Image.new("RGB", (512, 550), "#0b0818")
        panel.paste(frame, (0, 38))
        ImageDraw.Draw(panel).text((16, 12), title, fill="#ffffff")
        images.append(panel)
if images:
    sheet = Image.new("RGB", (len(images) * 512, 550))
    for i, panel in enumerate(images):
        sheet.paste(panel, (i * 512, 0))
    sheet.save(PREVIEWS / "contact-sheet.png")

# Ghoul Balls variants and format comparison, all at the same animation phase.
sheet = Image.new("RGB", (1024, 294), "black")
for col, (scene, count) in enumerate([(3, 1), (4, 2), (5, 4), (6, 6)]):
    with Image.open(PREVIEWS / f"gif-64-25-{scene}.gif") as im:
        im.seek(12)
        sheet.paste(im.convert("RGB").resize((256, 256), Image.Resampling.NEAREST), (col * 256, 38))
    ImageDraw.Draw(sheet).text((col * 256 + 12, 12), f"{count} BALL{'S' if count > 1 else ''}", fill="white")
sheet.save(PREVIEWS / "ghoul-balls-variants.png")
sheet = Image.new("RGB", (1152, 422), "black")
for col, (name, label, size) in enumerate([
    ("avi-64-25-6.avi", "AVI / 64x64 lossless", 64),
    ("mpg-512-25-6.mpg", "MPEG / 512x512, 64x64 logical", 512),
    ("gif-64-25-6.gif", "GIF / 64x64 lossless", 64),
]):
    raw = decode(PREVIEWS / name)
    offset = 12 * size * size * 3
    frame = Image.frombytes("RGB", (size, size), raw[offset:offset + size * size * 3])
    sheet.paste(frame.resize((384, 384), Image.Resampling.NEAREST), (col * 384, 38))
    ImageDraw.Draw(sheet).text((col * 384 + 12, 12), label, fill="white")
sheet.save(PREVIEWS / "ghoul-balls-formats.png")

# Eight version-two seed-only artworks. This montage is a viewing artifact assembled offchain
# from exact onchain-generated GIFs; it is not itself a contract return value.
seeds = [1, 2, 6, 4, 7, 42, 99, 2026]
if all((PREVIEWS / f"recipe-seed{seed}.abi").exists() for seed in seeds):
    recipes = [validate_recipe(seed) for seed in seeds]
    gallery_dir = PREVIEWS / "generative"
    gallery_dir.mkdir(exist_ok=True)
    (gallery_dir / "recipes.json").write_text(json.dumps(recipes, indent=2) + "\n")
    sources = [Image.open(PREVIEWS / f"gif-64-25-{r['scene']}-seed{r['seed']}.gif") for r in recipes]
    gallery = []
    for f in range(50):
        panel = Image.new("RGB", (1024, 588), "#080810")
        draw = ImageDraw.Draw(panel)
        for i, (im, r) in enumerate(zip(sources, recipes)):
            im.seek(f)
            x, y = (i % 4) * 256, (i // 4) * 294
            panel.paste(im.convert("RGB").resize((256, 256), Image.Resampling.NEAREST), (x, y + 38))
            draw.text((x + 12, y + 12), f"SEED {r['seed']} / {r['ball_count']} / {r['motion'].upper()}", fill="white")
        gallery.append(panel)
    gallery[12].save(gallery_dir / "seed-gallery.png")
    gallery[0].save(gallery_dir / "seed-gallery.preview.gif", save_all=True, append_images=gallery[1:], duration=40, loop=0)
    for im in sources:
        im.close()
(PREVIEWS / "validation.json").write_text(json.dumps(rows, indent=2) + "\n")
print("All emitted files decoded successfully. MP4 files are offchain viewing copies.")
