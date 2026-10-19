// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {Glyphs} from "./Glyphs.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {BlockExtras} from "./BlockExtras.sol";

/// @notice BLOCKS_VIDEO_V4 data bands drawn over the final, unmirrored frame. The header holds ベース・ブロック with the
///         block number, then ガス with the gas limit, 鎖 with the chain ID and the UTC time. The footer shows still
///         pages, a label over a value, that cycle once per loop so every figure, full hashes included, can be read.
/// @dev Frames are 128x128 palette indices, top-down here; `paintMovie` writes them into the AVI's bottom-up rows.
library BlocksHud {
    using Strings for uint256;

    uint256 internal constant HEADER = 22; // rows 0..21; row 21 is the accent rule
    uint256 internal constant FOOTER = 112; // rows 112..127; row 112 is the accent rule
    uint256 internal constant PAGE_Y = 115; // label rows 115..119, value rows 121..125
    uint256 internal constant PAGE_ROWS = 11;
    uint256 internal constant BG = 240; // dark ramp, brightest end: near-black in every recolouring
    uint256 internal constant TEXT = 208; // white ramp, kept desaturated by the V3 palette
    /// @dev " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#,.:-/*" as 15-bit 3x5 bitmaps (scripts/blocks_hud_font.py).
    bytes internal constant FONT =
        hex"00007b6f2c9762a7628e5bc9798e39ef72927bef7bce2bed6bae39236b6e79a779a4396b5bed7497126a5bad49275fed6b6d2b6a6ba42b736bad388e74925b6f5b6a5bfd5aad5a9272a75f7d00140002041001c012a40080";

    struct Bands {
        bytes header; // HEADER x 128
        bytes footer; // 16 x 128 with an empty page area
        bytes pages; // count x PAGE_ROWS x 128, each a label line over a value line
        uint256 count; // pages shown in turn over the 90-frame loop
    }

    function accent(uint256 hue) internal pure returns (uint256) {
        return (5 + hue % 6) * 16;
    }

    function _index(uint8 ch) private pure returns (uint256) {
        if (ch >= 0x30 && ch <= 0x39) return ch - 0x2f;
        if (ch >= 0x41 && ch <= 0x5a) return ch - 0x36;
        if (ch == 0x23) return 37;
        if (ch == 0x2c) return 38;
        if (ch == 0x2e) return 39;
        if (ch == 0x3a) return 40;
        if (ch == 0x2d) return 41;
        if (ch == 0x2f) return 42;
        if (ch == 0x2a) return 43;
        return 0;
    }

    /// @dev Draw `s` in the 3x5 font into a `width`-wide buffer at (x, y), 4 px per character, clipped at the right edge.
    function text(bytes memory buf, uint256 width, uint256 x, uint256 y, bytes memory s, uint256 c) internal pure {
        bytes memory font = FONT;
        for (uint256 k; k < s.length; ++k) {
            uint256 g = _index(uint8(s[k]));
            uint256 bits = uint256(uint8(font[2 * g])) << 8 | uint8(font[2 * g + 1]);
            for (uint256 i; i < 15; ++i) {
                uint256 col = x + k * 4 + i % 3;
                if ((bits >> (14 - i)) & 1 == 1 && col < width) buf[(y + i / 3) * width + col] = bytes1(uint8(c));
            }
        }
    }

    function _kana(bytes memory buf, uint256 x, uint256 y, bytes memory word, uint256 c) private pure {
        bytes memory table = Glyphs.TABLE;
        for (uint256 k; k < word.length; ++k) {
            uint256 bits = Glyphs.bits(table, uint8(word[k]));
            for (uint256 i; i < 64; ++i) {
                if ((bits >> (63 - i)) & 1 == 1) buf[(y + i / 8) * 128 + x + k * 8 + i % 8] = bytes1(uint8(c));
            }
        }
    }

    /// @dev 52811146 -> "52,811,146".
    function grouped(uint256 n) internal pure returns (bytes memory out) {
        bytes memory d = bytes(n.toString());
        out = new bytes(d.length + (d.length - 1) / 3);
        uint256 o = out.length;
        for (uint256 k; k < d.length; ++k) {
            if (k > 0 && k % 3 == 0) out[--o] = ",";
            out[--o] = d[d.length - 1 - k];
        }
    }

    /// @dev Whole millions as "400M"; anything else grouped in full.
    function gas(uint256 n) internal pure returns (bytes memory) {
        return n % 1e6 == 0 && n > 0 ? bytes.concat(bytes((n / 1e6).toString()), "M") : grouped(n);
    }

    function _pad(uint256 n, uint256 width) private pure returns (bytes memory out) {
        out = bytes(n.toString());
        while (out.length < width) out = bytes.concat("0", out);
    }

    /// @dev Base fee as "0.005 GWEI" (millgwei precision, rounded down), or "15 WEI" below 0.001 gwei.
    function fee(uint256 wei_) internal pure returns (bytes memory) {
        if (wei_ < 1e6) return bytes.concat(bytes(wei_.toString()), " WEI");
        return bytes.concat(bytes((wei_ / 1e9).toString()), ".", _pad(wei_ % 1e9 / 1e6, 3), " GWEI");
    }

    function _hex(uint256 v, uint256 digits) internal pure returns (bytes memory out) {
        out = new bytes(digits);
        for (uint256 k = digits; k > 0; --k) {
            uint256 nib = v & 15;
            out[k - 1] = bytes1(uint8(nib < 10 ? 48 + nib : 55 + nib));
            v >>= 4;
        }
    }

    /// @dev UTC calendar date from a Unix timestamp (Howard Hinnant's civil_from_days).
    function date(uint256 ts) internal pure returns (uint256 y, uint256 m, uint256 d) {
        uint256 z = ts / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        d = doy - (153 * mp + 2) / 5 + 1;
        m = mp < 10 ? mp + 3 : mp - 9;
        y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    }

    function clock(uint256 ts) internal pure returns (bytes memory) {
        uint256 s = ts % 86400;
        return bytes.concat(_pad(s / 3600, 2), ":", _pad(s / 60 % 60, 2), ":", _pad(s % 60, 2));
    }

    function _centred(bytes memory page, uint256 y, bytes memory s, uint256 c) private pure {
        text(page, 128, (129 - s.length * 4) / 2, y, s, c);
    }

    /// @dev Label and value lines for each page; hashes are split into two 32-digit halves.
    function pageText(SingleBlockData.Info memory info, BlockExtras.Extras memory x)
        internal
        pure
        returns (bytes[] memory labels, bytes[] memory values)
    {
        bool l1 = x.l1Number != 0;
        labels = new bytes[](l1 ? 7 : 4);
        values = new bytes[](labels.length);
        bytes memory parent = _hex(uint256(x.parentHash), 64);
        (labels[0], values[0]) = ("BASE FEE * BLOB FEE", bytes.concat(fee(info.baseFee), " * ", fee(x.blobBaseFee)));
        (labels[1], values[1]) = ("PARENT HASH 1/2", _slice(parent, 0));
        (labels[2], values[2]) = ("PARENT HASH 2/2", _slice(parent, 32));
        uint256 k = 3;
        if (l1) {
            bytes memory l1Hash = _hex(uint256(x.l1Hash), 64);
            (labels[3], values[3]) =
            ("L1 BLOCK * L1 BASE FEE", bytes.concat(grouped(x.l1Number), " * ", fee(x.l1BaseFee)));
            (labels[4], values[4]) = ("L1 HASH 1/2", _slice(l1Hash, 0));
            (labels[5], values[5]) = ("L1 HASH 2/2", _slice(l1Hash, 32));
            k = 6;
        }
        (uint256 y, uint256 m, uint256 d) = date(info.timestamp);
        uint256 coinbase = uint256(uint160(info.beneficiary));
        labels[k] = "COINBASE * DATE UTC";
        values[k] = bytes.concat(
            _hex(coinbase >> 144, 4),
            "..",
            _hex(coinbase & 0xffff, 4),
            " * ",
            bytes(y.toString()),
            "-",
            _pad(m, 2),
            "-",
            _pad(d, 2)
        );
    }

    function _slice(bytes memory s, uint256 from) private pure returns (bytes memory out) {
        out = new bytes(32);
        for (uint256 i; i < 32; ++i) {
            out[i] = s[from + i];
        }
    }

    function bands(SingleBlockData.Info memory info, BlockExtras.Extras memory x, uint256 hue)
        internal
        pure
        returns (Bands memory b)
    {
        uint256 acc = accent(hue);
        b.header = new bytes(HEADER * 128);
        for (uint256 i; i < b.header.length; ++i) {
            b.header[i] = bytes1(uint8(i >= (HEADER - 1) * 128 ? acc : BG));
        }
        _kana(b.header, 3, 2, Glyphs.BASE_BLOCK, acc);
        bytes memory num = grouped(info.number);
        text(b.header, 128, 125 - num.length * 4, 3, num, TEXT);
        _kana(b.header, 3, 11, Glyphs.GAS, acc);
        bytes memory limit = gas(info.gasLimit);
        text(b.header, 128, 21, 13, limit, TEXT);
        bytes memory time = clock(info.timestamp);
        text(b.header, 128, 125 - time.length * 4, 13, time, TEXT);
        // 鎖 (chain) and the chain ID, centred between the gas limit and the time when they fit.
        bytes memory chain = bytes(info.chainId.toString());
        uint256 lo = 21 + limit.length * 4;
        uint256 hi = 124 - time.length * 4;
        uint256 w = chain.length * 4 + 9;
        if (hi >= lo + w + 2) {
            uint256 cx = lo + (hi - lo - w) / 2;
            _kana(b.header, cx, 11, hex"0a", acc);
            text(b.header, 128, cx + 10, 13, chain, TEXT);
        }

        b.footer = new bytes(16 * 128);
        for (uint256 i; i < b.footer.length; ++i) {
            b.footer[i] = bytes1(uint8(i < 128 ? acc : BG));
        }

        (bytes[] memory labels, bytes[] memory values) = pageText(info, x);
        b.count = labels.length;
        b.pages = new bytes(b.count * PAGE_ROWS * 128);
        for (uint256 i; i < b.pages.length; ++i) {
            b.pages[i] = bytes1(uint8(BG));
        }
        for (uint256 k; k < b.count; ++k) {
            bytes memory page = new bytes(PAGE_ROWS * 128);
            for (uint256 i; i < page.length; ++i) {
                page[i] = bytes1(uint8(BG));
            }
            _centred(page, 0, labels[k], acc);
            _centred(page, 6, values[k], TEXT);
            uint256 o = k * page.length;
            for (uint256 i; i < page.length; ++i) {
                b.pages[o + i] = page[i];
            }
        }
    }

    /// @dev Pages advance evenly through the loop, so frame 90 would show the first page again.
    function pageAt(Bands memory b, uint256 f) internal pure returns (uint256) {
        return f * b.count / 90;
    }

    /// @dev Overwrite the bands of one top-down 128x128 frame starting at `p` (a memory pointer).
    function paintTopDown(uint256 p, Bands memory b, uint256 f) internal pure {
        bytes memory header = b.header;
        bytes memory footer = b.footer;
        bytes memory pages = b.pages;
        uint256 page = pageAt(b, f) * PAGE_ROWS * 128;
        assembly ("memory-safe") {
            mcopy(p, add(header, 32), 2816)
            mcopy(add(p, 14336), add(footer, 32), 2048)
            mcopy(add(p, 14720), add(add(pages, 32), page), 1408)
        }
    }

    /// @dev Overwrite the bands of every frame of a 90-frame BI_RGB AVI (bottom-up rows).
    function paintMovie(bytes memory movie, Bands memory b) internal pure {
        bytes memory header = b.header;
        bytes memory footer = b.footer;
        bytes memory pages = b.pages;
        for (uint256 f; f < 90; ++f) {
            uint256 page = pageAt(b, f) * PAGE_ROWS * 128;
            assembly ("memory-safe") {
                let frame := add(add(movie, 32), add(1256, mul(f, 16392)))
                for { let y := 0 } lt(y, 22) { y := add(y, 1) } {
                    mcopy(add(frame, shl(7, sub(127, y))), add(add(header, 32), shl(7, y)), 128)
                }
                for { let y := 112 } lt(y, 128) { y := add(y, 1) } {
                    let src := add(add(footer, 32), shl(7, sub(y, 112)))
                    if and(iszero(lt(y, 115)), lt(y, 126)) {
                        src := add(add(add(pages, 32), page), shl(7, sub(y, 115)))
                    }
                    mcopy(add(frame, shl(7, sub(127, y))), src, 128)
                }
            }
        }
    }
}
