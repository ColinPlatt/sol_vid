// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Uncompressed, indexed 128px AVI; 90 frames at 15fps, preserving all 256 palette entries.
library AviWriter {
    uint256 internal constant WIDTH = 128;
    uint256 internal constant PIXELS = 16384;
    uint256 internal constant FRAMES = 90;
    uint256 internal constant START = 1248;
    uint256 internal constant STRIDE = 8 + PIXELS;
    uint256 internal constant LENGTH = START + FRAMES * STRIDE + 8 + FRAMES * 16;

    function le(bytes memory out, uint256 p, uint256 n, uint256 count) private pure {
        for (uint256 i; i < count; ++i) {
            out[p + i] = bytes1(uint8(n >> (8 * i)));
        }
    }

    function tag(bytes memory out, uint256 p, bytes4 value) private pure {
        assembly ("memory-safe") { mstore(add(add(out, 32), p), value) }
    }

    function start(bytes memory palette) internal pure returns (bytes memory out) {
        require(palette.length == 768, "Palette");
        out = new bytes(LENGTH);
        tag(out, 0, "RIFF");
        le(out, 4, LENGTH - 8, 4);
        tag(out, 8, "AVI ");
        tag(out, 12, "LIST");
        le(out, 16, 1216, 4);
        tag(out, 20, "hdrl");
        tag(out, 24, "avih");
        le(out, 28, 56, 4);
        le(out, 32, 66667, 4);
        le(out, 36, STRIDE * 15, 4);
        le(out, 44, 16, 4);
        le(out, 48, FRAMES, 4);
        le(out, 56, 1, 4);
        le(out, 60, PIXELS, 4);
        le(out, 64, 128, 4);
        le(out, 68, 128, 4);
        tag(out, 88, "LIST");
        le(out, 92, 1140, 4);
        tag(out, 96, "strl");
        tag(out, 100, "strh");
        le(out, 104, 56, 4);
        tag(out, 108, "vids");
        tag(out, 112, "DIB ");
        le(out, 128, 1, 4);
        le(out, 132, 15, 4);
        le(out, 140, FRAMES, 4);
        le(out, 144, PIXELS, 4);
        le(out, 148, 0xffffffff, 4);
        le(out, 160, 128, 2);
        le(out, 162, 128, 2);
        tag(out, 164, "strf");
        le(out, 168, 1064, 4);
        le(out, 172, 40, 4);
        le(out, 176, 128, 4);
        le(out, 180, 128, 4);
        le(out, 184, 1, 2);
        le(out, 186, 8, 2);
        le(out, 192, PIXELS, 4);
        le(out, 204, 256, 4);
        le(out, 208, 256, 4);
        for (uint256 i; i < 256; ++i) {
            out[212 + 4 * i] = palette[3 * i + 2];
            out[213 + 4 * i] = palette[3 * i + 1];
            out[214 + 4 * i] = palette[3 * i];
        }
        tag(out, 1236, "LIST");
        le(out, 1240, 4 + FRAMES * STRIDE, 4);
        tag(out, 1244, "movi");
        uint256 index = START + FRAMES * STRIDE;
        tag(out, index, "idx1");
        le(out, index + 4, FRAMES * 16, 4);
        for (uint256 f; f < FRAMES; ++f) {
            uint256 pos = START + f * STRIDE;
            tag(out, pos, "00db");
            le(out, pos + 4, PIXELS, 4);
            uint256 ix = index + 8 + f * 16;
            tag(out, ix, "00db");
            le(out, ix + 4, 16, 4);
            le(out, ix + 8, 4 + f * STRIDE, 4);
            le(out, ix + 12, PIXELS, 4);
        }
    }

    function frame(bytes memory out, uint256 f, uint256 pixels) internal pure {
        uint256 pos = START + f * STRIDE + 8;
        assembly ("memory-safe") {
            let dst := add(add(out, 32), pos)
            for { let y := 0 } lt(y, 128) { y := add(y, 1) } {
                mcopy(add(dst, mul(y, 128)), add(pixels, mul(sub(127, y), 128)), 128)
            }
        }
    }
}
