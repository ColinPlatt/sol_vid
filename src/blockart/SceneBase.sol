// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Raster} from "./Raster.sol";
import {GifWriter} from "./GifWriter.sol";
import {Glyphs} from "./Glyphs.sol";
import {Epoch} from "./Epoch.sol";
import {AviWriter} from "./AviWriter.sol";
import {InPlace} from "./InPlace.sol";

/// @notice Shared drawing pieces for the block-art scenes, with a palette layout every scene follows:
///         ramp 0 = sky (16 explicit colours), 1-4 and 11-12 scene-specific, 5-10 the six neon colours, 13 white,
///         14 rain, 15 dark (a near-black ramp toward a rim colour). Ramps other than the sky fade toward the fog.
library SceneKit {
    using Epoch for bytes;

    uint256 internal constant FRAMES = 90; // 6 s at 15fps
    uint256 internal constant PER_BLOCK = 9; // frames per block
    uint256 internal constant SKY = 0;
    uint256 internal constant NEON = 5;
    uint256 internal constant WHITE = 13;
    uint256 internal constant RAIN = 14;
    uint256 internal constant DARK = 15;

    /// @dev round(15 * u^0.75) for u = i/32.
    uint256 private constant FOG_CURVE = 0x00010203030404050506060707080808090a0a0b0b0b0c0c0c0d0d0e0e0e0f0f;

    /// @dev Build the 768-byte palette. `from[r]` is ramp r's colour, shading to `fog` (or `darkTo` for the dark
    ///      ramp) over 16 steps. The six neons and white are fixed for the whole series. Ramp 0 is `sky` (16 explicit
    ///      colours) and ramp 12 may be given explicitly too (`ramp12`, 48 bytes, or empty).
    function palette(uint24[16] memory from, uint24 fog, uint24 darkTo, bytes memory sky, bytes memory ramp12)
        internal
        pure
        returns (bytes memory pal)
    {
        from[5] = 0xff2e88;
        from[6] = 0x00e5ff;
        from[7] = 0xb14cff;
        from[8] = 0xffb000;
        from[9] = 0x39ff88;
        from[10] = 0xff4d4d;
        from[13] = 0xe1e6f0;
        pal = new bytes(768);
        for (uint256 r; r < 16; ++r) {
            uint256 a = from[r];
            uint256 b = r == DARK ? darkTo : fog;
            for (uint256 s; s < 16; ++s) {
                uint256 o = (r * 16 + s) * 3;
                if (r == SKY || (r == 12 && ramp12.length == 48)) {
                    bytes memory src = r == SKY ? sky : ramp12;
                    pal[o] = src[s * 3];
                    pal[o + 1] = src[s * 3 + 1];
                    pal[o + 2] = src[s * 3 + 2];
                    continue;
                }
                for (uint256 c; c < 3; ++c) {
                    uint256 x = (a >> (16 - 8 * c)) & 0xff;
                    uint256 y = (b >> (16 - 8 * c)) & 0xff;
                    pal[o + c] = bytes1(uint8((x * (15 - s) + y * s + 7) / 15));
                }
            }
        }
    }

    /// @dev Depth fog shade 0..15 for distance dz between near and far.
    function fog(int256 dz, int256 near, int256 far) internal pure returns (uint256) {
        int256 u = (dz - near) * 32 / (far - near);
        if (u <= 0) return 0;
        if (u >= 32) return 15;
        return (FOG_CURVE >> (8 * (31 - uint256(u)))) & 0xff;
    }

    /// @dev sin of `phase` (in 1/1024 turn) scaled to +/-1024: Bhaskara I's approximation, error < 0.2%.
    function sin(int256 phase) internal pure returns (int256) {
        int256 x = wrap(phase, 1024);
        int256 sign = 1;
        if (x >= 512) {
            x -= 512;
            sign = -1;
        }
        // x in [0, 512) maps to [0, pi): sin ~ 16 u (1 - u) / (5 - 4 u (1 - u)) with u = x / 512.
        int256 q = x * (512 - x); // u(1-u) * 512^2
        return sign * 16 * q * 1024 / (5 * 262144 - 4 * q);
    }

    function wrap(int256 x, int256 m) internal pure returns (int256) {
        return ((x % m) + m) % m;
    }

    /// @dev The block whose turn it is at frame f, `ahead` blocks ahead of the camera (in 1/100 block), switching to
    ///      the next block 85% of the way through (the concepts crossfade there).
    function turn(uint256 f, uint256 ahead) internal pure returns (uint256 i) {
        uint256 pos = f * 100 / PER_BLOCK + ahead;
        i = (pos / 100) % 10;
        if (pos % 100 >= 85) i = (i + 1) % 10;
    }

    /// @dev Vertical sky gradient through `stops` (shade at y = 0, at y = mid, at y = 127; in 1/16 shade), plus an
    ///      optional radial glow at (gx, gy) of radius r adding up to `glow` shades; Bayer-dithered into ramp 0.
    function sky(
        uint256 p,
        uint256 top,
        uint256 mid,
        uint256 midY,
        uint256 bottom,
        int256 gx,
        int256 gy,
        int256 r,
        uint256 glow
    ) internal pure {
        assembly ("memory-safe") {
            let bayer := 0x000802100c040e06030b01090f070d05
            let rr := mul(r, r)
            for { let y := 0 } lt(y, 128) { y := add(y, 1) } {
                let g := add(top, sdiv(mul(sub(mid, top), y), midY))
                if gt(y, midY) { g := add(mid, sdiv(mul(sub(bottom, mid), sub(y, midY)), sub(127, midY))) }
                for { let x := 0 } lt(x, 128) { x := add(x, 1) } {
                    let v := g
                    if glow {
                        let dx := sub(x, gx)
                        let dy := sub(y, gy)
                        let r2 := add(mul(dx, dx), mul(dy, dy))
                        if lt(r2, rr) {
                            let q := div(mul(sub(rr, r2), 1024), rr)
                            let q5 := shr(40, mul(mul(mul(mul(q, q), q), q), q))
                            v := add(v, div(mul(q5, mul(glow, 16)), 1024))
                        }
                    }
                    v := add(v, byte(add(add(16, shl(2, and(y, 3))), and(x, 3)), bayer))
                    v := shr(4, v)
                    if gt(v, 15) { v := 15 }
                    mstore8(add(add(p, shl(7, y)), x), v)
                }
            }
        }
    }

    /// @dev ベース・ブロック hologram for block i: header, #number, ガス n.n%, over faint scanlines; centred on cx,
    ///      30 px tall from y.
    function hologram(uint256 p, bytes memory e, uint256 i, int256 cx, int256 y) internal pure {
        uint256 nc = (NEON + e.neon(i)) * 16;
        for (int256 yy = y - 1; yy < y + 27; yy += 3) {
            for (int256 sx = cx - 40; sx < cx + 40; sx += 2) {
                Raster.dot(p, sx, yy, nc + 11);
            }
        }
        bytes memory table = Glyphs.TABLE;
        bytes memory head = Glyphs.BASE_BLOCK;
        for (uint256 k; k < 8; ++k) {
            Raster.glyph(p, cx - 32 + int256(k) * 8, y, Glyphs.bits(table, uint8(head[k])), 1, nc);
        }
        Raster.number(p, cx, y + 10, e.number(i), WHITE * 16);
        Raster.glyph(p, cx - 23, y + 17, Glyphs.bits(table, uint8(Glyphs.GAS[0])), 1, nc + 2);
        Raster.glyph(p, cx - 15, y + 17, Glyphs.bits(table, uint8(Glyphs.GAS[1])), 1, nc + 2);
        uint256 pct = e.gasBps(i) / 10; // tenths of a percent
        int256 x = cx - 4;
        if (pct >= 100) {
            Raster.small(p, x, y + 19, (pct / 100) % 10, nc + 2);
            x += 4;
        }
        Raster.small(p, x, y + 19, (pct / 10) % 10, nc + 2);
        Raster.small(p, x + 4, y + 19, 12, nc + 2);
        Raster.small(p, x + 7, y + 19, pct % 10, nc + 2);
        Raster.small(p, x + 11, y + 19, 13, nc + 2);
    }

    /// @dev Rain streaks; whole numbers of falls per loop keep it seamless. `slant` = x drift per 4 px of fall.
    function rain(uint256 p, bytes memory e, uint256 f, uint256 count, int256 slant, uint256 c) internal pure {
        for (uint256 k; k < count; ++k) {
            uint256 b = k % 10;
            int256 x = int256((e.hashByte(b, k) * 7 + k * 13) % 128);
            int256 len = 2 + int256(e.hashByte(b, k + 3) % 3);
            uint256 speed = 2 + k % 3;
            int256 y = int256(
                ((e.hashByte(b, k + 7) * FRAMES + f * speed * 255) % (FRAMES * 255)) * uint256(128 + len)
                    / (FRAMES * 255)
            ) - len;
            Raster.line(p, x, y, x - len * slant / 4, y + len, c);
        }
    }

    /// @dev Vertical neon sign: plate, glow rim, glyphs top to bottom; a plain neon bar when too small to read.
    function verticalSign(uint256 p, uint256 word, int256 cx, int256 top, int256 fs, uint256 ramp, uint256 shade)
        internal
        pure
    {
        (uint256 len, uint256 ix) = Glyphs.word(word);
        uint256 nc = ramp * 16 + shade;
        int256 w = fs * 124 / 100 + 1;
        int256 h = fs * int256(len * 108 + 50) / 100;
        int256 x0 = cx - w / 2;
        int256 y0 = top - fs * 7 / 10;
        if (fs < 6) {
            Raster.rect(p, x0, y0, x0 + w, y0 + h, nc);
            if (fs >= 3) Raster.rect(p, x0 + 1, y0 + 1, x0 + w - 1, y0 + h - 1, shade + 3 > 15 ? nc : nc + 3);
            return;
        }
        Raster.rect(p, x0 - 1, y0 - 1, x0 + w + 1, y0 + h + 1, shade + 8 > 15 ? nc : nc + 8);
        Raster.rect(p, x0, y0, x0 + w, y0 + h, DARK * 16);
        bytes memory table = Glyphs.TABLE;
        for (uint256 k; k < len; ++k) {
            uint256 g = (ix >> (8 * k)) & 0xff;
            Raster.glyphSized(
                p, cx - fs / 2, top - fs / 2 + int256(k) * fs * 108 / 100, Glyphs.bits(table, g), uint256(fs), nc
            );
        }
    }
}

/// @notice Frame loop shared by every scene: bake the backdrop once, then per frame copy it, draw, and append to the GIF.
abstract contract SceneBase {
    error InvalidEpoch();
    error InvalidFrame();
    error FrameCallFailed();

    function _validateEpoch(bytes memory e) private pure {
        if (e.length != 3520) revert InvalidEpoch();
    }

    /// @notice A frame-local paint entry point. Fresh EVM memory bounds temporary drawing allocations.
    /// @dev The animation loop encodes the backdrop/prepared data once and reuses it for all 90 STATICCALLs.
    function paint(bytes memory e, bytes memory backdrop, uint256[] memory st, uint256 f)
        external
        pure
        returns (bytes memory)
    {
        _validateEpoch(e);
        if (f > SceneKit.FRAMES) revert InvalidFrame();
        if (backdrop.length != Raster.PIXELS) revert InvalidEpoch();
        uint256 p;
        assembly ("memory-safe") { p := add(backdrop, 32) }
        _draw(p, e, st, f);
        InPlace.ret(backdrop);
    }

    function _payload(bytes memory e) private view returns (bytes memory) {
        bytes memory backdrop = new bytes(Raster.PIXELS);
        uint256 p;
        assembly ("memory-safe") { p := add(backdrop, 32) }
        _backdrop(p, e);
        return abi.encodeCall(this.paint, (e, backdrop, _prepare(e), uint256(0)));
    }

    function _paint(bytes memory payload, uint256 f, uint256 p) private view {
        assembly ("memory-safe") {
            // Fourth argument in the fixed ABI head, after the selector and three dynamic offsets.
            mstore(add(payload, 132), f)
            let ok := staticcall(gas(), address(), add(payload, 32), mload(payload), 0, 0)
            if iszero(ok) {
                let q := mload(0x40)
                returndatacopy(q, 0, returndatasize())
                revert(q, returndatasize())
            }
            // Own paint entry point returns ABI bytes of exactly one 128px raster.
            if iszero(eq(returndatasize(), 16448)) { revert(0, 0) }
            returndatacopy(p, 64, 16384)
        }
    }

    /// @notice Complete six-second GIF, including all rendering in this read-only call.
    function gif(bytes memory e) external view returns (bytes memory) {
        InPlace.ret(_render(e, false));
    }

    /// @notice Identical lossless artwork as a native AVI, without transcoding.
    function avi(bytes memory e) external view returns (bytes memory) {
        InPlace.ret(_render(e, true));
    }

    function _render(bytes memory e, bool asAvi) private view returns (bytes memory out) {
        _validateEpoch(e);
        uint256 pos;
        if (asAvi) out = AviWriter.start(_palette(e));
        else (out, pos) = GifWriter.start(SceneKit.FRAMES, _palette(e));
        bytes memory payload = _payload(e);
        bytes memory pixels = new bytes(Raster.PIXELS);
        bytes memory scratch = asAvi ? new bytes(0) : new bytes(GifWriter.LZW_BYTES + 32);
        uint256 p;
        assembly ("memory-safe") { p := add(pixels, 32) }
        for (uint256 f; f < SceneKit.FRAMES; ++f) {
            _paint(payload, f, p);
            if (asAvi) AviWriter.frame(out, f, p);
            else pos = GifWriter.frame(out, pos, p, f, scratch);
        }
        if (!asAvi) GifWriter.finish(out, pos);
    }

    /// @notice One raw frame for codec validation. Frame 90 exposes the loop boundary for testing.
    function frame(bytes memory e, uint256 f) external view returns (bytes memory buf, bytes memory pal) {
        _validateEpoch(e);
        if (f > SceneKit.FRAMES) revert InvalidFrame();
        bytes memory payload = _payload(e);
        buf = new bytes(Raster.PIXELS);
        uint256 p;
        assembly ("memory-safe") { p := add(buf, 32) }
        _paint(payload, f, p);
        pal = _palette(e);
    }
    function _palette(bytes memory e) internal pure virtual returns (bytes memory);
    function _backdrop(uint256 p, bytes memory e) internal pure virtual;

    function _prepare(bytes memory) internal pure virtual returns (uint256[] memory st) {
        return st;
    }
    function _draw(uint256 p, bytes memory e, uint256[] memory st, uint256 f) internal pure virtual;
}
