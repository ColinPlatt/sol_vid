// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Shared RIFF/AVI headers and keyframe index for indexed RGB and RLE8.
library AviContainer {
    function header(
        bytes memory out,
        uint256 size,
        uint256 fps,
        uint256 frames,
        uint256 movieSize,
        uint256 largest,
        bytes memory palette,
        uint256 compression
    ) internal pure {
        copy(out, 0, bytes("RIFF"));
        le(out, 4, 288 + movieSize + 8 + 16 * frames - 8, 4);
        copy(out, 8, bytes("AVI LIST"));
        le(out, 16, 256, 4);
        copy(out, 20, bytes("hdrlavih"));
        le(out, 28, 56, 4);
        le(out, 32, 1_000_000 / fps, 4);
        le(out, 36, (largest + 8) * fps, 4);
        le(out, 44, 16, 4); // AVIF_HASINDEX
        le(out, 48, frames, 4);
        le(out, 56, 1, 4); // one stream
        le(out, 60, largest, 4);
        le(out, 64, size, 4);
        le(out, 68, size, 4);
        copy(out, 88, bytes("LIST"));
        le(out, 92, 180, 4);
        copy(out, 96, bytes("strlstrh"));
        le(out, 104, 56, 4);
        copy(out, 108, compression == 0 ? bytes("vidsDIB ") : bytes("vidsmrle"));
        le(out, 128, 1, 4); // scale
        le(out, 132, fps, 4); // rate
        le(out, 140, frames, 4);
        le(out, 144, largest, 4);
        le(out, 148, 0xffffffff, 4); // default quality
        le(out, 160, size, 2);
        le(out, 162, size, 2);
        copy(out, 164, bytes("strf"));
        le(out, 168, 104, 4); // BITMAPINFOHEADER + 16 RGBQUADs
        le(out, 172, 40, 4);
        le(out, 176, size, 4);
        le(out, 180, size, 4);
        le(out, 184, 1, 2); // planes
        le(out, 186, 8, 2);
        le(out, 188, compression, 4);
        le(out, 192, largest, 4);
        le(out, 204, 16, 4);
        le(out, 208, 16, 4);
        for (uint256 i; i < 16; ++i) {
            out[212 + 4 * i] = palette[3 * i + 2];
            out[213 + 4 * i] = palette[3 * i + 1];
            out[214 + 4 * i] = palette[3 * i];
        }
        copy(out, 276, bytes("LIST"));
        le(out, 280, 4 + movieSize, 4);
        copy(out, 284, bytes("movi"));
    }

    function index(bytes memory out, uint256 p, bytes4 tag, uint256[] memory sizes) internal pure {
        copy(out, p, bytes("idx1"));
        le(out, p + 4, sizes.length * 16, 4);
        p += 8;
        uint256 offset = 4;
        for (uint256 i; i < sizes.length; ++i) {
            copy(out, p, abi.encodePacked(tag));
            le(out, p + 4, 16, 4);
            le(out, p + 8, offset, 4);
            le(out, p + 12, sizes[i], 4);
            offset += 8 + sizes[i];
            p += 16;
        }
        assert(p == out.length);
    }

    function copy(bytes memory out, uint256 p, bytes memory value) internal pure {
        assembly ("memory-safe") { mcopy(add(add(out, 32), p), add(value, 32), mload(value)) }
    }

    function le(bytes memory out, uint256 p, uint256 value, uint256 count) internal pure {
        for (uint256 i; i < count; ++i) {
            out[p + i] = bytes1(uint8(value >> (8 * i)));
        }
    }
}
