// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice 128x128 8-bit indexed frame buffer and clipped drawing primitives, all in memory.
/// @dev Pointers are absolute memory addresses of the first pixel (`bytes` data start). Colours are palette indices laid
///      out as 16 ramps x 16 shades: index = ramp * 16 + shade, where shade 0 is the ramp's colour and shade 15 its far
///      end (usually the scene's fog). Coordinates are signed screen pixels; everything clips to the frame.
///      Hot paths are Yul: spans write whole words and finish with one overlapping or masked word, never byte loops.
library Raster {
    uint256 internal constant S = 128;
    uint256 internal constant PIXELS = S * S;
    uint256 private constant ONES = 0x0101010101010101010101010101010101010101010101010101010101010101;

    /// @dev Fill row `y` from x0 (inclusive) to x1 (exclusive) with colour c.
    function span(uint256 p, int256 y, int256 x0, int256 x1, uint256 c) internal pure {
        assembly ("memory-safe") {
            if lt(y, 128) {
                if slt(x0, 0) { x0 := 0 }
                if sgt(x1, 128) { x1 := 128 }
                if slt(x0, x1) {
                    let row := add(p, shl(7, y))
                    let a := add(row, x0)
                    let e := add(row, x1)
                    let w := mul(c, ONES)
                    let n := sub(x1, x0)
                    switch lt(n, 32)
                    case 1 {
                        // Masked write of the first n bytes of the word at a.
                        let keep := shr(shl(3, n), not(0))
                        mstore(a, or(and(mload(a), keep), and(w, not(keep))))
                    }
                    default {
                        for {} lt(add(a, 32), e) { a := add(a, 32) } { mstore(a, w) }
                        mstore(sub(e, 32), w)
                    }
                }
            }
        }
    }

    function rect(uint256 p, int256 x0, int256 y0, int256 x1, int256 y1, uint256 c) internal pure {
        assembly ("memory-safe") {
            if slt(x0, 0) { x0 := 0 }
            if sgt(x1, 128) { x1 := 128 }
            if slt(y0, 0) { y0 := 0 }
            if sgt(y1, 128) { y1 := 128 }
            if slt(x0, x1) {
                let w := mul(c, ONES)
                let n := sub(x1, x0)
                let keep := shr(shl(3, n), not(0))
                for { let y := y0 } slt(y, y1) { y := add(y, 1) } {
                    let row := add(p, shl(7, y))
                    let a := add(row, x0)
                    switch lt(n, 32)
                    case 1 { mstore(a, or(and(mload(a), keep), and(w, not(keep)))) }
                    default {
                        let e := add(row, x1)
                        for {} lt(add(a, 32), e) { a := add(a, 32) } { mstore(a, w) }
                        mstore(sub(e, 32), w)
                    }
                }
            }
        }
    }

    function dot(uint256 p, int256 x, int256 y, uint256 c) internal pure {
        assembly ("memory-safe") {
            if and(lt(x, 128), lt(y, 128)) { mstore8(add(add(p, shl(7, y)), x), c) }
        }
    }

    /// @dev Push pixels in a rectangle `d` shades toward their ramp's far end (d > 0) or back toward the ramp colour
    ///      (d < 0). Used for haze bands, light shafts and soft shadows.
    function shade(uint256 p, int256 x0, int256 y0, int256 x1, int256 y1, int256 d) internal pure {
        assembly ("memory-safe") {
            if slt(x0, 0) { x0 := 0 }
            if sgt(x1, 128) { x1 := 128 }
            if slt(y0, 0) { y0 := 0 }
            if sgt(y1, 128) { y1 := 128 }
            for { let y := y0 } slt(y, y1) { y := add(y, 1) } {
                let row := add(p, shl(7, y))
                for { let x := x0 } slt(x, x1) { x := add(x, 1) } {
                    let a := add(row, x)
                    let v := byte(0, mload(a))
                    let s := add(and(v, 15), d)
                    if slt(s, 0) { s := 0 }
                    if sgt(s, 15) { s := 15 }
                    mstore8(a, or(and(v, 0xf0), s))
                }
            }
        }
    }

    /// @dev Bresenham line, both ends inclusive, Cohen-Sutherland clipped to the frame first so lines from far
    ///      off-screen cost nothing to walk.
    function line(uint256 p, int256 x0, int256 y0, int256 x1, int256 y1, uint256 c) internal pure {
        assembly ("memory-safe") {
            function code(x, y) -> o {
                if slt(x, 0) { o := 1 }
                if sgt(x, 127) { o := 2 }
                if slt(y, 0) { o := or(o, 4) }
                if sgt(y, 127) { o := or(o, 8) }
            }
            let c0 := code(x0, y0)
            let c1 := code(x1, y1)
            let visible := 1
            for { let n := 0 } lt(n, 8) { n := add(n, 1) } {
                if iszero(or(c0, c1)) { break }
                if and(c0, c1) {
                    visible := 0
                    break
                }
                // Move the endpoint that is outside onto the boundary it crosses.
                let o := c0
                if iszero(o) { o := c1 }
                let x := 0
                let y := 0
                switch and(o, 12)
                case 4 {
                    y := 0
                    x := add(x0, sdiv(mul(sub(x1, x0), sub(0, y0)), sub(y1, y0)))
                }
                case 8 {
                    y := 127
                    x := add(x0, sdiv(mul(sub(x1, x0), sub(127, y0)), sub(y1, y0)))
                }
                default {
                    switch and(o, 1)
                    case 1 {
                        x := 0
                        y := add(y0, sdiv(mul(sub(y1, y0), sub(0, x0)), sub(x1, x0)))
                    }
                    default {
                        x := 127
                        y := add(y0, sdiv(mul(sub(y1, y0), sub(127, x0)), sub(x1, x0)))
                    }
                }
                switch eq(o, c0)
                case 1 {
                    x0 := x
                    y0 := y
                    c0 := code(x0, y0)
                }
                default {
                    x1 := x
                    y1 := y
                    c1 := code(x1, y1)
                }
            }
            if or(c0, c1) { visible := 0 }
            if visible {
                let dx := sub(x1, x0)
                if slt(dx, 0) { dx := sub(0, dx) }
                let dy := sub(y1, y0)
                if sgt(dy, 0) { dy := sub(0, dy) }
                let sx := 1
                if slt(x1, x0) { sx := not(0) }
                let sy := 1
                if slt(y1, y0) { sy := not(0) }
                let err := add(dx, dy)
                for {} 1 {} {
                    mstore8(add(add(p, shl(7, y0)), x0), c)
                    if and(eq(x0, x1), eq(y0, y1)) { break }
                    let e2 := add(err, err)
                    if iszero(slt(e2, dy)) {
                        err := add(err, dy)
                        x0 := add(x0, sx)
                    }
                    if iszero(sgt(e2, dx)) {
                        err := add(err, dx)
                        y0 := add(y0, sy)
                    }
                }
            }
        }
    }

    /// @dev Filled convex quadrilateral (vertices in order, either winding), coordinates in 1/16 pixel. Pixel centres
    ///      inside the shape are filled.
    function quad(uint256 p, int256[8] memory v, uint256 c) internal pure {
        assembly ("memory-safe") {
            // Load one edge at a time: keeping eight coordinates live overflowed the compiler's Yul stack.
            function cross(vertices, off, yc, lo, hi) -> l, h {
                l := lo
                h := hi
                let a := add(vertices, off)
                let b := add(vertices, and(add(off, 64), 255))
                let ya := mload(add(a, 32))
                let yb := mload(add(b, 32))
                if xor(iszero(sgt(ya, yc)), iszero(sgt(yb, yc))) {
                    let x := add(mload(a), sdiv(mul(sub(mload(b), mload(a)), sub(yc, ya)), sub(yb, ya)))
                    if slt(x, l) { l := x }
                    if sgt(x, h) { h := x }
                }
            }
            let ys := 0
            let ye := 0
            {
                let top := mload(add(v, 32))
                let bot := top
                for { let off := 96 } lt(off, 256) { off := add(off, 64) } {
                    let yy := mload(add(v, off))
                    if slt(yy, top) { top := yy }
                    if sgt(yy, bot) { bot := yy }
                }
                ys := sar(4, add(top, 7))
                ye := sar(4, add(bot, 8))
                if slt(ys, 0) { ys := 0 }
                if sgt(ye, 128) { ye := 128 }
            }
            let w := mul(c, ONES)
            for { let y := ys } slt(y, ye) { y := add(y, 1) } {
                let yc := add(shl(4, y), 8)
                let lo := 0x7fffffff
                let hi := sub(0, 0x7fffffff)
                lo, hi := cross(v, 0, yc, lo, hi)
                lo, hi := cross(v, 64, yc, lo, hi)
                lo, hi := cross(v, 128, yc, lo, hi)
                lo, hi := cross(v, 192, yc, lo, hi)
                let a := sar(4, add(lo, 8))
                let b := sar(4, add(hi, 8))
                if slt(a, 0) { a := 0 }
                if sgt(b, 128) { b := 128 }
                if slt(a, b) {
                    let row := add(p, shl(7, y))
                    let n := sub(b, a)
                    a := add(row, a)
                    switch lt(n, 32)
                    case 1 {
                        let keep := shr(shl(3, n), not(0))
                        mstore(a, or(and(mload(a), keep), and(w, not(keep))))
                    }
                    default {
                        let e := add(row, b)
                        for {} lt(add(a, 32), e) { a := add(a, 32) } { mstore(a, w) }
                        mstore(sub(e, 32), w)
                    }
                }
            }
        }
    }

    /// @dev Convenience for scenes projected directly into pixels; `quad` itself takes 1/16-pixel coordinates.
    function quadPixels(uint256 p, int256[8] memory v, uint256 c) internal pure {
        assembly ("memory-safe") {
            for { let off := 0 } lt(off, 256) { off := add(off, 32) } {
                mstore(add(v, off), shl(4, mload(add(v, off))))
            }
        }
        quad(p, v, c);
    }

    function disc(uint256 p, int256 cx, int256 cy, int256 r, uint256 c) internal pure {
        int256 rr = r * r + r;
        for (int256 dy = -r; dy <= r; ++dy) {
            int256 w;
            while ((w + 1) * (w + 1) + dy * dy <= rr) ++w;
            span(p, cy + dy, cx - w, cx + w + 1, c);
        }
    }

    /// @dev Draw an 8x8 bitmap glyph (row-major, MSB = top-left pixel) at (x, y), scaled by `k`.
    function glyph(uint256 p, int256 x, int256 y, uint256 bits, uint256 k, uint256 c) internal pure {
        if (k != 1) return glyphSized(p, x, y, bits, k * 8, c);
        assembly ("memory-safe") {
            for { let r := 0 } lt(r, 8) { r := add(r, 1) } {
                let row := and(shr(sub(56, shl(3, r)), bits), 0xff)
                let py := add(y, r)
                if and(iszero(iszero(row)), lt(py, 128)) {
                    let base := add(p, shl(7, py))
                    for { let q := 0 } lt(q, 8) { q := add(q, 1) } {
                        let px := add(x, q)
                        if and(and(shr(sub(7, q), row), 1), lt(px, 128)) { mstore8(add(base, px), c) }
                    }
                }
            }
        }
    }

    /// @dev Draw an 8x8 glyph resampled (nearest neighbour) into a `size` x `size` box at (x, y).
    function glyphSized(uint256 p, int256 x, int256 y, uint256 bits, uint256 size, uint256 c) internal pure {
        assembly ("memory-safe") {
            for { let ty := 0 } lt(ty, size) { ty := add(ty, 1) } {
                let row := and(shr(sub(56, shl(3, div(shl(3, ty), size))), bits), 0xff)
                let py := add(y, ty)
                if and(iszero(iszero(row)), lt(py, 128)) {
                    let base := add(p, shl(7, py))
                    for { let q := 0 } lt(q, size) { q := add(q, 1) } {
                        let px := add(x, q)
                        if and(and(shr(sub(7, div(shl(3, q), size)), row), 1), lt(px, 128)) {
                            mstore8(add(base, px), c)
                        }
                    }
                }
            }
        }
    }

    /// @dev 3x5 digits and a few marks for numbers: index 0-9 digits, 10 '#', 11 ',', 12 '.', 13 '%'.
    ///      Each glyph is 15 bits, row-major from the top-left, in 16-bit slots.
    uint256 private constant SMALL = 0x7b6f2c9773e772cf5bc979cf79ef72927bef7bcf5f7d0014000252a5;

    function small(uint256 p, int256 x, int256 y, uint256 ch, uint256 c) internal pure {
        assembly ("memory-safe") {
            let bits := and(shr(shl(4, sub(13, ch)), SMALL), 0x7fff)
            for { let i := 0 } lt(i, 15) { i := add(i, 1) } {
                if and(shr(sub(14, i), bits), 1) {
                    let px := add(x, mod(i, 3))
                    let py := add(y, div(i, 3))
                    if and(lt(px, 128), lt(py, 128)) { mstore8(add(add(p, shl(7, py)), px), c) }
                }
            }
        }
    }

    /// @dev Draw a block number as "#52,546,966" in the 3x5 font, centred on cx; 4 px per character.
    function number(uint256 p, int256 cx, int256 y, uint256 n, uint256 c) internal pure {
        uint256[16] memory chars;
        uint256 len;
        uint256 digits;
        do {
            if (digits > 0 && digits % 3 == 0) chars[len++] = 11;
            chars[len++] = n % 10;
            n /= 10;
            ++digits;
        } while (n > 0);
        chars[len++] = 10;
        int256 x = cx - int256(len * 4 - 1) / 2;
        for (uint256 i = len; i > 0; --i) {
            small(p, x, y, chars[i - 1], c);
            x += 4;
        }
    }
}
