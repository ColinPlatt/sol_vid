// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Looping GIF89a writer for 128x128 frames with a 256-colour palette.
/// @dev Pixels are stored as literal LZW codes (no compression) at a fixed 9-bit code size: a clear code starts every
///      group of 239 pixels, so the dictionary never grows past 9 bits. A group is 240 codes = ten blocks of 24 codes,
///      and 24 codes x 9 bits = 27 bytes, so each block packs with word operations: byte-swap 24 pixels into
///      little-endian order, spread the 8-bit fields to 9-bit slots with five masked shifts, byte-swap back, one mstore.
///      Frame delays alternate 7, 7, 6 centiseconds: exactly 15fps.
library GifWriter {
    uint256 internal constant PIXELS = 16384;
    uint256 internal constant GROUP = 239;
    uint256 internal constant FULL_GROUPS = PIXELS / GROUP; // 68
    uint256 internal constant TAIL = PIXELS - FULL_GROUPS * GROUP; // 132
    /// @dev Codes per frame: full groups, the last group's clear + tail pixels, and end-of-information.
    uint256 internal constant CODES = FULL_GROUPS * (GROUP + 1) + 1 + TAIL + 1;
    uint256 internal constant LZW_BYTES = (CODES * 9 + 7) / 8; // 18,511
    uint256 internal constant SUB_BLOCKS = (LZW_BYTES + 254) / 255; // 73
    /// @dev Graphic control (8) + image descriptor (10) + min code size (1) + data + length bytes + terminator.
    uint256 internal constant FRAME_BYTES = 8 + 10 + 1 + LZW_BYTES + SUB_BLOCKS + 1;
    uint256 internal constant HEADER_BYTES = 6 + 7 + 768 + 19;

    function size(uint256 frames) internal pure returns (uint256) {
        return HEADER_BYTES + frames * FRAME_BYTES + 1;
    }

    /// @notice Allocate the whole file and write its header, palette and loop extension. Returns the write position.
    function start(uint256 frames, bytes memory palette) internal pure returns (bytes memory out, uint256 pos) {
        require(palette.length == 768);
        out = new bytes(size(frames));
        assembly ("memory-safe") {
            let o := add(out, 32)
            // "GIF89a", 128x128, global colour table of 256 entries (flags 0xf7), background 0, aspect 0.
            mstore(o, shl(152, 0x47494638396180008000f70000))
            mcopy(add(o, 13), add(palette, 32), 768)
            // NETSCAPE2.0 application extension: loop forever.
            let n := add(o, 781)
            mstore(n, shl(104, 0x21ff0b4e45545343415045322e300301000000))
        }
        pos = HEADER_BYTES;
    }

    /// @notice Append frame `f` (its pixels at memory pointer `px`) at `pos`; `scratch` holds LZW_BYTES + 32.
    function frame(bytes memory out, uint256 pos, uint256 px, uint256 f, bytes memory scratch)
        internal
        pure
        returns (uint256)
    {
        assembly ("memory-safe") {
            function bswap(x) -> y {
                x := or(
                    shr(8, and(x, 0xff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00)),
                    shl(8, and(x, 0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff))
                )
                x := or(
                    shr(16, and(x, 0xffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000)),
                    shl(16, and(x, 0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff))
                )
                x := or(
                    shr(32, and(x, 0xffffffff00000000ffffffff00000000ffffffff00000000ffffffff00000000)),
                    shl(32, and(x, 0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffff))
                )
                x := or(
                    shr(64, and(x, 0xffffffffffffffff0000000000000000ffffffffffffffff0000000000000000)),
                    shl(64, and(x, 0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffff))
                )
                y := or(shr(128, x), shl(128, x))
            }
            // Move 8-bit field i (at bit 8i) to bit 9i, i = 0..23.
            function spread(v) -> r {
                v := or(
                    and(v, 0xffffffffffffffffffffffffffffffff),
                    shl(16, and(v, 0xffffffffffffffff00000000000000000000000000000000))
                )
                v := or(
                    and(v, 0xffffffffffffffff00000000000000000000ffffffffffffffff),
                    shl(8, and(v, 0xffffffffffffffff0000000000000000))
                )
                v := or(
                    and(v, 0xffffffff0000000000ffffffff0000000000ffffffff),
                    shl(4, and(v, 0xffffffff0000000000ffffffff0000000000ffffffff00000000))
                )
                v := or(
                    and(v, 0xffff00000ffff00000ffff00000ffff00000ffff00000ffff),
                    shl(2, and(v, 0xffff00000ffff00000ffff00000ffff00000ffff00000ffff0000))
                )
                r := or(
                    and(v, 0x3fc00ff003fc00ff003fc00ff003fc00ff003fc00ff003fc00ff),
                    shl(1, and(v, 0x3fc00ff003fc00ff003fc00ff003fc00ff003fc00ff003fc00ff00))
                )
            }
            let w := add(scratch, 32)
            for { let g := 0 } lt(g, 68) { g := add(g, 1) } {
                // Block 0: clear code, then 23 pixels.
                mstore(
                    w,
                    bswap(
                        or(spread(shl(8, and(bswap(mload(px)), 0xffffffffffffffffffffffffffffffffffffffffffffff))), 256)
                    )
                )
                w := add(w, 27)
                px := add(px, 23)
                for { let k := 0 } lt(k, 9) { k := add(k, 1) } {
                    mstore(w, bswap(spread(and(bswap(mload(px)), 0xffffffffffffffffffffffffffffffffffffffffffffffff))))
                    w := add(w, 27)
                    px := add(px, 24)
                }
            }
            // Last group: clear, 132 pixels, end-of-information, through a plain bit accumulator.
            let acc := 256
            let nb := 9
            for { let k := 0 } lt(k, 133) { k := add(k, 1) } {
                let code := 257
                if lt(k, 132) { code := byte(0, mload(add(px, k))) }
                acc := or(acc, shl(nb, code))
                nb := add(nb, 9)
                for {} gt(nb, 7) {} {
                    mstore8(w, acc)
                    w := add(w, 1)
                    acc := shr(8, acc)
                    nb := sub(nb, 8)
                }
            }
            if nb { mstore8(w, acc) }
        }
        assembly ("memory-safe") {
            let o := add(add(out, 32), pos)
            // Graphic control extension: no transparency, delay 7/7/6 cs; image descriptor 128x128, no local table.
            let delay := 7
            if eq(mod(f, 3), 2) { delay := 6 }
            mstore8(o, 0x21)
            mstore8(add(o, 1), 0xf9)
            mstore8(add(o, 2), 4)
            mstore8(add(o, 3), 4) // disposal: do not dispose
            mstore8(add(o, 4), delay)
            mstore8(add(o, 5), 0)
            mstore8(add(o, 6), 0)
            mstore8(add(o, 7), 0)
            mstore8(add(o, 8), 0x2c)
            mstore8(add(o, 9), 0)
            mstore8(add(o, 10), 0)
            mstore8(add(o, 11), 0)
            mstore8(add(o, 12), 0)
            mstore8(add(o, 13), 128)
            mstore8(add(o, 14), 0)
            mstore8(add(o, 15), 128)
            mstore8(add(o, 16), 0)
            mstore8(add(o, 17), 0)
            mstore8(add(o, 18), 8) // LZW minimum code size
            o := add(o, 19)
            let src := add(scratch, 32)
            let left := 18511
            for {} left {} {
                let n := 255
                if lt(left, 255) { n := left }
                mstore8(o, n)
                mcopy(add(o, 1), src, n)
                o := add(o, add(n, 1))
                src := add(src, n)
                left := sub(left, n)
            }
            mstore8(o, 0)
        }
        return pos + FRAME_BYTES;
    }

    function finish(bytes memory out, uint256 pos) internal pure {
        out[pos] = 0x3b;
        assert(pos + 1 == out.length);
    }
}
