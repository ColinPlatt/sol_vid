"""Independent Python rasterizer for GHOULBALLS_VAPOR_V3 (no Solidity frame input)."""
from functools import lru_cache
import subprocess

THEMES = ["Midnight", "Lagoon", "Ultraviolet", "Sunset"]
MOTIONS = ["Ricochet", "Orbit", "Float", "Figure Eight"]
SKIES = [
    "08081915102e29134552245c7a3ab0ea5cb4ffbf9ba8fff0",
    "050e210b183818295a3e3d70327ab0d559c7ffcaad94fff0",
    "13091f29113546184176264f9250bcf26d9bffd18cd5b9ff",
    "160b262c153b55214e9039587e55adff8eb8ffe3a39ef5ed",
]

def neon(h):
    """Ball colour from the ball's hash: integer HSV, hue 0..359, saturation 120..229, value 220..255."""
    hue, sat, val = (h >> 136) % 360, 120 + (h >> 152) % 110, 220 + (h >> 168) % 36
    rem = hue % 60 * 255 // 60
    p = val * (255 - sat) // 255
    q = val * (255 - sat * rem // 255) // 255
    t = val * (255 - sat * (255 - rem) // 255) // 255
    return bytes([(val, t, p), (q, val, p), (p, val, t), (p, q, val), (t, p, val), (val, p, q)][hue // 60])

@lru_cache(None)
def keccak(data):
    return int(subprocess.check_output(["cast", "keccak", "0x" + data.hex()]), 16)

@lru_cache(None)
def traits(seed):
    domain = b"GHOULBALLS_VAPOR_V3"
    key = keccak((64).to_bytes(32, "big") + seed.to_bytes(32, "big") + len(domain).to_bytes(32, "big") + domain.ljust(32, b"\0"))
    theme, motion = (key >> 8) % 4, (key >> 16) % 4
    ball_colours = b"".join(neon(keccak(seed.to_bytes(32, "big") + i.to_bytes(32, "big"))) for i in range(6))
    palette = bytes.fromhex(SKIES[theme]) + ball_colours + bytes.fromhex("4a376ff5fff3")
    balls = []
    for i in range([1, 2, 4, 6][key % 4]):
        h = keccak(seed.to_bytes(32, "big") + i.to_bytes(32, "big"))
        r = 5 + (h >> 24) % 6
        period = 2 * (63 - 2 * r)
        balls.append(dict(radius=r, x_phase=(h >> 40) % period, y_phase=(h >> 72) % period,
                          phase=(h >> 104) % 128, colour="#" + palette[24 + 3 * i:27 + 3 * i].hex()))
    return dict(seed=seed, key=key, scene=7 + key % 4, ball_count=len(balls), theme=theme, motion=motion, palette=palette, balls=balls)

def wave(t):
    t %= 128
    p = t % 64
    return p * (64 - p) * (1 if t < 64 else -1)

def trunc_div(a, b):
    return (abs(a) // b) * (1 if a >= 0 else -1)

@lru_cache(None)
def frame(f, fps, seed):
    r = traits(seed)
    phase = (f * 128 // (2 * fps)) % 128
    scroll, shift = phase // 2, r["key"] & 63
    sun_x = 19 + (r["key"] >> 32) % 27
    indices = bytearray(4096)
    for y in range(64):
        for x in range(64):
            c = 1 + y // 14
            if (x - sun_x) ** 2 + (y - 22) ** 2 < 100:
                c = 3 if y > 22 and y % 4 < 2 else 6
            if y < 29 and (x * 73 + y * 37 + shift) % 211 == 0:
                c = 7
            ridge = (x + shift) % 32
            ridge = min(ridge, 32 - ridge)
            if y > 39 - ridge // 3 and y < 41:
                c = 0
            if y > 40:
                depth = y - 40
                c = 4 if (abs(x - 32) * 16) % (depth + 4) < 2 else 0
                if (depth * depth + scroll * 4) % 64 < 4:
                    c = 5
            indices[y * 64 + x] = c
    for i, b in enumerate(r["balls"]):
        radius = b["radius"]
        span = 63 - radius * 2
        offset = 2 * span * (f % (2 * fps)) // (2 * fps)
        def bounce(start):
            p = (start + offset) % (2 * span)
            return radius + min(p, 2 * span - p)
        cx, cy = bounce(b["x_phase"]), bounce(b["y_phase"])
        t = phase + b["phase"]
        if r["motion"] in [1, 3]:
            cx = 32 + trunc_div(wave(t) * (25 - radius), 1024)
            cy = (30 + trunc_div(wave(t + 32) * (23 - radius), 1024)) if r["motion"] == 1 else (31 + trunc_div(wave(2 * t + b["y_phase"]) * (23 - radius), 1024))
        if r["motion"] == 2:
            cy = 30 + trunc_div(wave(t) * (17 - radius), 1024)
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                dx, dy = x - cx, y - cy
                if dx * dx + dy * dy <= radius * radius:
                    c = 14 if dy > radius // 3 and dx > 0 else 8 + i
                    if (dx + radius // 3) ** 2 + (dy + radius // 3) ** 2 < radius * radius // 9:
                        c = 15
                    indices[y * 64 + x] = c
    palette = r["palette"]
    rgb = b"".join(palette[3 * i:3 * i + 3] for i in indices)
    luma = bytes(16 + ((66 * palette[3 * i] + 129 * palette[3 * i + 1] + 25 * palette[3 * i + 2] + 128) >> 8) for i in indices)
    return rgb, luma
