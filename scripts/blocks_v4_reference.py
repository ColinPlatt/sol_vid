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


def hexdigits(value):
    return f"{int(value):064X}"


def pages(info):
    """(label, value) pairs: fees, the parent hash in two halves, the L1 block and its hash when present, coinbase."""
    when = datetime.datetime.fromtimestamp(info['timestamp'], datetime.timezone.utc)
    coinbase = f"{int(info['beneficiary']):040X}"
    parent = hexdigits(info['parentHash'])
    out = [("BASE FEE * BLOB FEE", f"{fee(info['baseFee'])} * {fee(int(info['blobBaseFee']))}"),
           ("PARENT HASH 1/2", parent[:32]), ("PARENT HASH 2/2", parent[32:])]
    if int(info['l1Number']):
        l1 = hexdigits(info['l1Hash'])
        out += [("L1 BLOCK * L1 BASE FEE", f"{int(info['l1Number']):,} * {fee(int(info['l1BaseFee']))}"),
                ("L1 HASH 1/2", l1[:32]), ("L1 HASH 2/2", l1[32:])]
    return out + [("COINBASE * DATE UTC", f"{coinbase[:4]}..{coinbase[-4:]} * {when:%Y-%m-%d}")]


def centred(buf, y, s, colour):
    text(buf, (129 - len(s) * 4) // 2, y, s, colour)


def bands(info, hue):
    acc = accent(hue)
    header = np.full((22, 128), BG, np.uint8)
    header[21] = acc
    kana(header, 3, 2, BASE_BLOCK, acc)
    number = f"{info['number']:,}"
    text(header, 125 - len(number) * 4, 3, number, TEXT)
    kana(header, 3, 11, GAS, acc)
    limit = f"{info['gasLimit'] // 10 ** 6}M" if info['gasLimit'] and info['gasLimit'] % 10 ** 6 == 0 else f"{info['gasLimit']:,}"
    text(header, 21, 13, limit, TEXT)
    clock = datetime.datetime.fromtimestamp(info['timestamp'], datetime.timezone.utc).strftime('%H:%M:%S')
    text(header, 125 - len(clock) * 4, 13, clock, TEXT)
    # 鎖 + chain ID centred in the free columns between the gas limit and the clock (2 px clear of each), if it fits.
    gas_last, clock_first = 21 + len(limit) * 4 - 2, 125 - len(clock) * 4
    chain = str(info['chainId'])
    free = range(gas_last + 2, clock_first - 1)
    width = 8 + 2 + len(chain) * 4 - 1
    if width + 2 <= len(free):
        x = free.start + (len(free) - width - 2) // 2 + 1
        kana(header, x, 11, [CHAIN_KANA], acc)
        text(header, x + 10, 13, chain, TEXT)
    footer = np.full((16, 128), BG, np.uint8)
    footer[0] = acc
    sheets = []
    for label, value in pages(info):
        page = np.full((11, 128), BG, np.uint8)
        centred(page, 0, label, acc)
        centred(page, 6, value, TEXT)
        sheets.append(page)
    return header, footer, sheets


def paint(frame, info, hue, f):
    """Overwrite the bands of a top-down 128x128 index frame for output frame f (0..89)."""
    header, footer, sheets = bands(info, hue)
    out = np.array(frame, copy=True).reshape(128, 128)
    out[:22] = header
    out[112:] = footer
    out[115:126] = sheets[f * len(sheets) // 90]
    return out
