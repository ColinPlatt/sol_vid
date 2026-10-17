// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Scene} from "./Scene.sol";

/// @notice Minimal MPEG-1 video encoder: all I pictures, DC-only 8x8 blocks, 4:2:0.
/// @dev A restricted, deliberately pixelated encoder, not a general-purpose compressor.
///      Returns an MPEG-1 elementary stream (.m1v), without audio or a system mux.
contract MpegVideo is Scene {
    struct Bits {
        bytes data;
        uint256 position;
    }

    struct Colours {
        uint256[] y;
        uint256[] u;
        uint256[] v;
    }

    /// @notice Two seconds at 25fps. Each 8x8 output block is one solid-colour sample.
    function mpeg(uint256 size, uint256 scene, uint256 seed) public pure returns (bytes memory out) {
        if ((size != 128 && size != 256 && size != 512 && size != 1024) || scene > 10) revert InvalidSettings();
        // Settings bound all arithmetic and output offsets below 2**32.
        unchecked {
            uint256 cols = size / 16;
            uint256 cells = size / 8;
            // <=16 bytes per macroblock, plus byte-aligned picture/slice headers and slack.
            Bits memory b = Bits(new bytes(64 + 50 * (8 + cols * (5 + cols * 16))), 0);
            _put(b, 0x000001b3, 32);
            _put(b, size, 12);
            _put(b, size, 12);
            _put(b, 1, 4);
            _put(b, 3, 4); // square pixels, 25fps
            _put(b, 0x3ffff, 18);
            _put(b, 1, 1); // VBR sentinel, marker
            _put(b, 112, 10);
            _put(b, 0, 3); // VBV, unconstrained, default matrices

            Colours memory colours = _colours(scene, seed);
            bytes memory pixels = new bytes(cells * cells);
            bytes memory background = _background(cells, scene, seed);
            for (uint256 f; f < 50; ++f) {
                _draw(pixels, cells, f, 50, scene, seed, background);
                _put(b, 0x00000100, 32);
                _put(b, f, 10);
                _put(b, 1, 3);
                _put(b, 0xffff, 16);
                _put(b, 0, 1);
                _align(b);
                for (uint256 row; row < cols; ++row) {
                    _put(b, 0x00000101 + row, 32); // one slice per macroblock row
                    _put(b, 8, 5);
                    _put(b, 0, 1);
                    int256 py = 128;
                    int256 pu = 128;
                    int256 pv = 128;
                    for (uint256 col; col < cols; ++col) {
                        _put(b, 3, 2); // address increment 1; I-picture macroblock_type intra
                        uint256 u;
                        uint256 v;
                        for (uint256 blockIndex; blockIndex < 4; ++blockIndex) {
                            uint256 pixelRow = row * 2 + blockIndex / 2;
                            uint256 pixelCol = col * 2 + blockIndex % 2;
                            uint256 index = uint8(pixels[pixelRow * cells + pixelCol]);
                            int256 y = int256(colours.y[index]);
                            _dc(b, y - py, false);
                            py = y;
                            u += colours.u[index];
                            v += colours.v[index];
                        }
                        int256 cu = int256((u + 2) / 4);
                        int256 cv = int256((v + 2) / 4);
                        _dc(b, cu - pu, true);
                        _dc(b, cv - pv, true);
                        pu = cu;
                        pv = cv;
                    }
                    _align(b);
                }
            }
            _put(b, 0x000001b7, 32);
            uint256 length = b.position / 8;
            out = b.data;
            assert(length <= out.length);
            assembly ("memory-safe") {
                mstore(out, length)
            }
        }
    }

    /// @notice The same MPEG-1 video in an MPEG-1 system stream (.mpg), with PTS.
    /// @dev Explicit 90kHz timestamps avoid elementary-stream duration estimates.
    function mpg(uint256 size, uint256 scene, uint256 seed) public pure returns (bytes memory out) {
        bytes memory raw = mpeg(size, scene, seed);
        uint256[] memory starts = new uint256[](51);
        uint256 found;
        assembly ("memory-safe") {
            let src := add(raw, 32)
            for { let i := 12 } lt(i, sub(mload(raw), 3)) { i := add(i, 1) } {
                if eq(shr(224, mload(add(src, i))), 0x100) {
                    if lt(found, 50) { mstore(add(add(starts, 32), mul(found, 32)), i) }
                    found := add(found, 1)
                }
            }
        }
        assert(found == 50);
        starts[50] = raw.length;
        Bits memory b = Bits(new bytes(raw.length + 50 * 23 + 36), 0);
        for (uint256 f; f < 50; ++f) {
            uint256 timestamp = f * 3600;
            _put(b, 0x000001ba, 32);
            _timestamp(b, timestamp); // MPEG-1 pack SCR uses the same 0010 prefix
            _put(b, 1, 1);
            _put(b, 10000, 22);
            _put(b, 1, 1);
            uint256 start = f == 0 ? 0 : starts[f];
            uint256 count = starts[f + 1] - start;
            assert(count + 5 <= 65535);
            _put(b, 0x000001e0, 32);
            _put(b, count + 5, 16);
            _timestamp(b, timestamp);
            uint256 p = b.position / 8;
            out = b.data;
            assembly ("memory-safe") {
                mcopy(add(add(out, 32), p), add(add(raw, 32), start), count)
            }
            b.position += count * 8;
        }
        _put(b, 0x000001b9, 32);
        out = b.data;
        uint256 length = b.position / 8;
        assert(length <= out.length);
        assembly ("memory-safe") {
            mstore(out, length)
        }
    }

    function _timestamp(Bits memory b, uint256 timestamp) private pure {
        _put(b, 2, 4);
        _put(b, (timestamp >> 30) & 7, 3);
        _put(b, 1, 1);
        _put(b, (timestamp >> 15) & 32767, 15);
        _put(b, 1, 1);
        _put(b, timestamp & 32767, 15);
        _put(b, 1, 1);
    }

    function _colours(uint256 scene, uint256 seed) private pure returns (Colours memory colours) {
        colours.y = new uint256[](16);
        colours.u = new uint256[](16);
        colours.v = new uint256[](16);
        bytes memory palette = _palette(scene, seed);
        for (uint256 i; i < 16; ++i) {
            int256 r = int256(uint256(uint8(palette[i * 3])));
            int256 g = int256(uint256(uint8(palette[i * 3 + 1])));
            int256 blue = int256(uint256(uint8(palette[i * 3 + 2])));
            int256 ySum = int256(66) * r + int256(129) * g + int256(25) * blue;
            int256 uSum = int256(-38) * r - int256(74) * g + int256(112) * blue;
            int256 vSum = int256(112) * r - int256(94) * g - int256(18) * blue;
            colours.y[i] = uint256(int256(16) + ((ySum + 128) >> 8));
            colours.u[i] = uint256(int256(128) + ((uSum + 128) >> 8));
            colours.v[i] = uint256(int256(128) + ((vSum + 128) >> 8));
        }
    }

    /// @dev MPEG-1 DC differential category VLC followed by amplitude and EOB=10.
    function _dc(Bits memory b, int256 delta, bool chroma) private pure {
        // DC predictors are byte values: the differential is in -255..255.
        unchecked {
            uint256 magnitude = uint256(delta < 0 ? -delta : delta);
            uint256 size;
            for (uint256 m = magnitude; m != 0; m >>= 1) {
                ++size;
            }
            uint256 code;
            uint256 count;
            if (chroma) {
                if (size < 3) {
                    code = size;
                    count = 2;
                } else {
                    count = size;
                    code = (1 << size) - 2;
                }
            } else {
                if (size == 0) {
                    code = 4;
                    count = 3;
                } else if (size < 3) {
                    code = size - 1;
                    count = 2;
                } else if (size < 5) {
                    code = size + 2;
                    count = 3;
                } else {
                    count = size - 1;
                    code = (1 << count) - 2;
                }
            }
            uint256 amplitude = delta < 0 ? ((1 << size) - 1) - magnitude : magnitude;
            // One write for the VLC, amplitude and EOB together.
            _put(b, (code << (size + 2)) | (amplitude << 2) | 2, count + size + 2);
        }
    }

    function _align(Bits memory b) private pure {
        b.position = (b.position + 7) & ~uint256(7);
    }

    function _put(Bits memory b, uint256 value, uint256 count) private pure {
        assembly ("memory-safe") {
            let position := mload(add(b, 32))
            let p := add(add(mload(b), 32), shr(3, position))
            mstore(p, or(mload(p), shl(sub(sub(256, count), and(position, 7)), value)))
            mstore(add(b, 32), add(position, count))
        }
    }
}
