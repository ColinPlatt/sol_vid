// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Scene} from "./Scene.sol";

/// @notice Entire two-second media files generated inside one pure EVM call.
/// @dev No stored frames, external assets, JavaScript, or offchain encoding.
///      Experimental encoders: literal GIF LZW and indexed, uncompressed AVI.
contract SolVideo is Scene {
    function _check(uint256 size, uint256 fps, uint256 scene) private pure {
        if (
            (size != 32 && size != 64 && size != 128 && size != 256) || (fps != 10 && fps != 20 && fps != 25)
                || scene > 6
        ) revert InvalidSettings();
    }

    /// @notice Looping GIF89a, exactly 2 seconds, with 20, 40 or 50 frames.
    function gif(uint256 size, uint256 fps, uint256 scene, uint256 seed) public pure returns (bytes memory out) {
        _check(size, fps, scene);
        uint256 frames = 2 * fps;
        uint256 n = size * size;
        uint256 packedSize = ((n + (n + 13) / 14 + 1) * 5 + 7) / 8;
        uint256 frameSize = 20 + packedSize + (packedSize + 254) / 255;
        out = new bytes(81 + frames * frameSize);
        _copy(out, 0, bytes("GIF89a"));
        _le(out, 6, size, 2);
        _le(out, 8, size, 2);
        out[10] = 0xf3; // global 16-entry palette, 8-bit colour resolution
        _copy(out, 13, _palette(scene, seed));
        _copy(out, 61, hex"21ff0b4e45545343415045322e300301000000");
        bytes memory pixels = new bytes(n);
        bytes memory packedPixels = new bytes(packedSize);
        uint256 p = 80;
        for (uint256 f; f < frames; ++f) {
            _draw(pixels, size, f, frames, scene, seed);
            _lzw(pixels, packedPixels);
            _copy(out, p, hex"21f90404000000002c00000000000000000004");
            _le(out, p + 4, 100 / fps, 2);
            _le(out, p + 13, size, 2);
            _le(out, p + 15, size, 2);
            p += 19;
            for (uint256 i; i < packedSize;) {
                uint256 count = packedSize - i;
                if (count > 255) count = 255;
                out[p++] = bytes1(uint8(count));
                assembly ("memory-safe") {
                    mcopy(add(add(out, 32), p), add(add(packedPixels, 32), i), count)
                }
                p += count;
                i += count;
            }
            out[p++] = 0; // image data terminator
        }
        assert(p == out.length - 1);
        out[p] = 0x3b;
    }

    /// @notice Actual RIFF AVI video: 8-bit indexed DIB, fixed 2 seconds, no audio.
    /// @dev Widths are multiples of 4, satisfying DIB scanline alignment.
    function avi(uint256 size, uint256 fps, uint256 scene, uint256 seed) public pure returns (bytes memory out) {
        _check(size, fps, scene);
        uint256 frames = fps * 2;
        uint256 n = size * size;
        uint256 movieSize = frames * (8 + n);
        out = new bytes(296 + movieSize + 16 * frames);
        _copy(out, 0, bytes("RIFF"));
        _le(out, 4, out.length - 8, 4);
        _copy(out, 8, bytes("AVI LIST"));
        _le(out, 16, 256, 4);
        _copy(out, 20, bytes("hdrlavih"));
        _le(out, 28, 56, 4);
        _le(out, 32, 1_000_000 / fps, 4);
        _le(out, 36, (n + 8) * fps, 4);
        _le(out, 44, 16, 4); // AVIF_HASINDEX
        _le(out, 48, frames, 4);
        _le(out, 56, 1, 4); // one stream
        _le(out, 60, n, 4);
        _le(out, 64, size, 4);
        _le(out, 68, size, 4);
        _copy(out, 88, bytes("LIST"));
        _le(out, 92, 180, 4);
        _copy(out, 96, bytes("strlstrh"));
        _le(out, 104, 56, 4);
        _copy(out, 108, bytes("vidsDIB "));
        _le(out, 128, 1, 4); // scale
        _le(out, 132, fps, 4); // rate
        _le(out, 140, frames, 4);
        _le(out, 144, n, 4);
        _le(out, 148, 0xffffffff, 4); // default quality
        _le(out, 160, size, 2);
        _le(out, 162, size, 2);
        _copy(out, 164, bytes("strf"));
        _le(out, 168, 104, 4); // BITMAPINFOHEADER + 16 RGBQUADs
        _le(out, 172, 40, 4);
        _le(out, 176, size, 4);
        _le(out, 180, size, 4);
        _le(out, 184, 1, 2); // planes
        _le(out, 186, 8, 2); // bits per pixel; BI_RGB = 0
        _le(out, 192, n, 4);
        _le(out, 204, 16, 4);
        _le(out, 208, 16, 4);
        bytes memory palette = _palette(scene, seed);
        for (uint256 i; i < 16; ++i) {
            out[212 + 4 * i] = palette[3 * i + 2];
            out[213 + 4 * i] = palette[3 * i + 1];
            out[214 + 4 * i] = palette[3 * i];
        }
        _copy(out, 276, bytes("LIST"));
        _le(out, 280, 4 + movieSize, 4);
        _copy(out, 284, bytes("movi"));
        bytes memory pixels = new bytes(n);
        uint256 p = 288;
        for (uint256 f; f < frames; ++f) {
            _draw(pixels, size, f, frames, scene, seed);
            _copy(out, p, bytes("00db"));
            _le(out, p + 4, n, 4);
            p += 8;
            // DIB scanlines are bottom-up; GIF scanlines are top-down.
            assembly ("memory-safe") {
                for { let y := 0 } lt(y, size) { y := add(y, 1) } {
                    mcopy(
                        add(add(out, 32), add(p, mul(y, size))),
                        add(add(pixels, 32), mul(sub(sub(size, 1), y), size)),
                        size
                    )
                }
            }
            p += n;
        }
        _copy(out, p, bytes("idx1"));
        _le(out, p + 4, 16 * frames, 4);
        p += 8;
        for (uint256 f; f < frames; ++f) {
            _copy(out, p, bytes("00db"));
            _le(out, p + 4, 16, 4); // every frame is a keyframe
            _le(out, p + 8, 4 + f * (8 + n), 4);
            _le(out, p + 12, n, 4);
            p += 16;
        }
        assert(p == out.length);
    }

    /// @dev Clear the dictionary every 14 literals: all codes stay 5 bits.
    /// This deliberately trades compression for simple, bounded EVM work.
    function _lzw(bytes memory pixels, bytes memory packedPixels) private pure {
        assembly ("memory-safe") {
            function emitCode(dst, bitPos, code) -> next {
                let p := add(dst, shr(3, bitPos))
                let offset := and(bitPos, 7)
                let v := shl(offset, code)
                // At a byte boundary, replace the previous frame's scratch byte.
                let old := 0
                if offset { old := byte(0, mload(p)) }
                mstore8(p, or(old, and(v, 255)))
                // A fresh following byte also clears any stale bits.
                mstore8(add(p, 1), shr(8, v))
                next := add(bitPos, 5)
            }
            let dst := add(packedPixels, 32)
            let src := add(pixels, 32)
            let n := mload(pixels)
            let bitPos := 0
            for { let i := 0 } lt(i, n) {} {
                bitPos := emitCode(dst, bitPos, 16)
                let end := add(i, 14)
                if gt(end, n) { end := n }
                for {} lt(i, end) { i := add(i, 1) } { bitPos := emitCode(dst, bitPos, byte(0, mload(add(src, i)))) }
            }
            pop(emitCode(dst, bitPos, 17))
        }
    }

    function _le(bytes memory out, uint256 p, uint256 value, uint256 count) private pure {
        for (uint256 i; i < count; ++i) {
            out[p + i] = bytes1(uint8(value >> (8 * i)));
        }
    }

    function _copy(bytes memory out, uint256 p, bytes memory value) private pure {
        assembly ("memory-safe") {
            mcopy(add(add(out, 32), p), add(value, 32), mload(value))
        }
    }
}
