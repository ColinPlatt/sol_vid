"""Independent BLOCKS_VIDEO_V4 data-band reference. Formatting uses Python's own integer, date and hex handling, not
the Solidity code; only the glyph bitmaps are shared data (Glyphs.sol's Misaki table and blocks_hud_font.py)."""
import datetime
import re
from pathlib import Path
import numpy as np
from blocks_hud_font import CHARS, GLYPHS

ROOT = Path(__file__).resolve().parents[1]
BG, TEXT = 240, 208
_glyphs = re.search(r'TABLE =\s*hex"([0-9a-f]+)"', (ROOT / 'src/blockart/Glyphs.sol').read_text()).group(1)
KANA = [int(_glyphs[i * 16:(i + 1) * 16], 16) for i in range(len(_glyphs) // 16)]
BASE_BLOCK = [0x18, 0x19, 0x1a, 0x1f, 0x1b, 0x1c, 0x1d, 0x1e]  # ベース・ブロック
GAS = [0x20, 0x1a]  # ガス
CHAIN_KANA = 0x0a  # 鎖


def accent(hue):
    return (5 + hue % 6) * 16


def text(buf, x, y, s, colour):
    """3x5 font, 4 px advance, clipped at the buffer's right edge."""
    for k, ch in enumerate(s):
        for row, cells in enumerate(GLYPHS[ch if ch in CHARS else ' ']):
            for col, cell in enumerate(cells):
                if cell == '#' and x + k * 4 + col < buf.shape[1]:
                    buf[y + row, x + k * 4 + col] = colour


def kana(buf, x, y, word, colour):
    for k, g in enumerate(word):
        for i in range(64):
            if KANA[g] >> (63 - i) & 1:
                buf[y + i // 8, x + k * 8 + i % 8] = colour


def fee(wei):
    return f'{wei} WEI' if wei < 10 ** 6 else f'{wei // 10 ** 9}.{wei % 10 ** 9 // 10 ** 6:03d} GWEI'


def ticker_text(info):
    """Base fee, parent hash, the anchoring L1 block when present, blob fee, coinbase and UTC date. No RANDAO."""
    when = datetime.datetime.fromtimestamp(info['timestamp'], datetime.timezone.utc)
    coinbase = f"{int(info['beneficiary']):040X}"
    line = f"BASE FEE {fee(info['baseFee'])} * PARENT {int(info['parentHash']):064X}"[:-56] + " * "
    if int(info['l1Number']):
        line += (f"L1 {int(info['l1Number']):,} * L1 HASH {int(info['l1Hash']):064X}"[:-56]
                 + f" * L1 FEE {fee(int(info['l1BaseFee']))} * ")
    return line + f"BLOB FEE {fee(int(info['blobBaseFee']))} * COINBASE {coinbase[:4]}..{coinbase[-4:]} * {when:%Y-%m-%d} UTC * "


def bands(info, hue):
    acc = accent(hue)
    header = np.full((14, 128), BG, np.uint8)
    header[13] = acc
    kana(header, 3, 3, BASE_BLOCK, acc)
    number = f"{info['number']:,}"
    text(header, 125 - len(number) * 4, 4, number, TEXT)
    footer = np.full((16, 128), BG, np.uint8)
    footer[0] = acc
    kana(footer, 3, 2, GAS, acc)
    limit = f"{info['gasLimit'] // 10 ** 6}M" if info['gasLimit'] and info['gasLimit'] % 10 ** 6 == 0 else f"{info['gasLimit']:,}"
    text(footer, 21, 4, limit, TEXT)
    clock = datetime.datetime.fromtimestamp(info['timestamp'], datetime.timezone.utc).strftime('%H:%M:%S')
    text(footer, 125 - len(clock) * 4, 4, clock, TEXT)
    # 鎖 + chain ID centred in the free columns between the gas limit and the clock (2 px clear of each), if it fits.
    gas_last, clock_first = 21 + len(limit) * 4 - 2, 125 - len(clock) * 4
    chain = str(info['chainId'])
    free = range(gas_last + 2, clock_first - 1)
    width = 8 + 2 + len(chain) * 4 - 1
    if width + 2 <= len(free):
        x = free.start + (len(free) - width - 2) // 2 + 1
        kana(footer, x, 2, [CHAIN_KANA], acc)
        text(footer, x + 10, 4, chain, TEXT)
    line = ticker_text(info)
    period = len(line) * 4
    strip = np.full((5, period), BG, np.uint8)
    text(strip, 0, 0, line, acc)
    return header, footer, strip, period


def paint(frame, info, hue, f):
    """Overwrite the bands of a top-down 128x128 index frame for output frame f (0..89)."""
    header, footer, strip, period = bands(info, hue)
    out = np.array(frame, copy=True).reshape(128, 128)
    out[:14] = header
    out[112:] = footer
    start = f * period // 90
    out[122:127] = strip[:, (start + np.arange(128)) % period]
    return out
