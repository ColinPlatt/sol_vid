// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoRecipeV3} from "./VideoRecipeV3.sol";
import {VideoRecipe} from "./VideoRecipe.sol";
import {AviVariation} from "./AviVariation.sol";

/// @notice Seeded semantic palette ramps and pixel-exact composition, shared by movie and reference frame paths.
library AviVariationV3 {
    function _rgb(uint256 hue, uint256 saturation, uint256 value)
        private
        pure
        returns (uint256 r, uint256 g, uint256 b)
    {
        uint256 low = value * (100 - saturation) / 100;
        uint256 rising = low + (value - low) * (hue % 60) / 60;
        uint256 falling = value - (value - low) * (hue % 60) / 60;
        uint256 sector = hue / 60;
        if (sector == 0) return (value, rising, low);
        if (sector == 1) return (falling, value, low);
        if (sector == 2) return (low, value, rising);
        if (sector == 3) return (low, falling, value);
        if (sector == 4) return (rising, low, value);
        return (value, low, falling);
    }

    function palette(bytes memory source, VideoRecipeV3.Recipe memory r) internal pure returns (bytes memory out) {
        require(source.length == 768, "Palette length");
        out = new bytes(768);
        for (uint256 i; i < 256; ++i) {
            uint256 p = i * 3;
            uint256 value = uint8(source[p]);
            if (uint8(source[p + 1]) > value) value = uint8(source[p + 1]);
            if (uint8(source[p + 2]) > value) value = uint8(source[p + 2]);
            uint256 ramp = i / 16;
            uint256 hue = (r.hue + uint256(uint8(r.tint[ramp])) * 360 / 256) % 360;
            uint256 saturation = ramp == 13 ? 15 : r.saturation;
            (uint256 a, uint256 b, uint256 c) = _rgb(hue, saturation, value);
            out[p] = bytes1(uint8(a));
            out[p + 1] = bytes1(uint8(b));
            out[p + 2] = bytes1(uint8(c));
        }
    }

    function _compose(
        bytes memory data,
        uint256 offset,
        bool bottomUp,
        VideoRecipeV3.Recipe memory r,
        bytes memory scratch
    ) private pure {
        uint256 margin = r.crop * 4;
        uint256 pan = r.pan;
        bool mirror = r.mirror;
        assembly ("memory-safe") {
            function reverse(v) -> w {
                v := or(
                    shl(8, and(v, 0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff)),
                    and(shr(8, v), 0x00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff)
                )
                v := or(
                    shl(16, and(v, 0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff)),
                    and(shr(16, v), 0x0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff)
                )
                v := or(
                    shl(32, and(v, 0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffff)),
                    and(shr(32, v), 0x00000000ffffffff00000000ffffffff00000000ffffffff00000000ffffffff)
                )
                v := or(
                    shl(64, and(v, 0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffff)),
                    and(shr(64, v), 0x0000000000000000ffffffffffffffff0000000000000000ffffffffffffffff)
                )
                w := or(shl(128, v), shr(128, v))
            }
            let start := add(add(data, 32), offset)
            let temp := add(scratch, 32)
            mcopy(temp, start, 16384)
            for { let y := 0 } lt(y, 128) { y := add(y, 1) } {
                let sy := add(add(margin, div(mul(y, sub(128, mul(margin, 2))), 128)), pan)
                sy := sub(sy, 4)
                if slt(sy, 0) { sy := 0 }
                if gt(sy, 127) { sy := 127 }
                let dy := y
                if bottomUp {
                    sy := sub(127, sy)
                    dy := sub(127, y)
                }
                let src := add(temp, mul(sy, 128))
                let dst := add(start, mul(dy, 128))
                switch mirror
                case 0 { mcopy(dst, src, 128) }
                default {
                    mstore(dst, reverse(mload(add(src, 96))))
                    mstore(add(dst, 32), reverse(mload(add(src, 64))))
                    mstore(add(dst, 64), reverse(mload(add(src, 32))))
                    mstore(add(dst, 96), reverse(mload(src)))
                }
            }
        }
    }

    function frame(bytes memory raw, bytes memory pal, VideoRecipeV3.Recipe memory r, uint256 scene)
        internal
        pure
        returns (bytes memory, bytes memory)
    {
        require(raw.length == 16384, "Frame length");
        // Same replacement of synthetic gas labels as V2, before composing the view.
        if (scene < 6) {
            uint256 top = scene == 2 ? 22 : 19;
            for (uint256 y = top; y < top + 11; ++y) {
                for (uint256 x = 39; x < 89; ++x) {
                    raw[y * 128 + x] = bytes1(uint8(240));
                }
            }
            for (uint256 chip; chip < 6; ++chip) {
                for (uint256 y = top + 4; y < top + 7; ++y) {
                    for (uint256 x = 42 + chip * 7; x < 46 + chip * 7; ++x) {
                        raw[y * 128 + x] = bytes1(uint8((5 + chip) * 16));
                    }
                }
            }
        }
        _compose(raw, 0, false, r, new bytes(16384));
        return (raw, palette(pal, r));
    }

    function remix(bytes memory movie, VideoRecipeV3.Recipe memory r, uint256 scene)
        internal
        pure
        returns (bytes memory)
    {
        movie = AviVariation.remix(movie, VideoRecipe.Recipe(0, 0, r.reverse, r.phase), scene);
        bytes memory source = new bytes(768);
        for (uint256 i; i < 256; ++i) {
            uint256 p = 212 + i * 4;
            source[i * 3] = movie[p + 2];
            source[i * 3 + 1] = movie[p + 1];
            source[i * 3 + 2] = movie[p];
        }
        bytes memory pal = palette(source, r);
        for (uint256 i; i < 256; ++i) {
            uint256 p = 212 + i * 4;
            movie[p + 2] = pal[i * 3];
            movie[p + 1] = pal[i * 3 + 1];
            movie[p] = pal[i * 3 + 2];
        }
        bytes memory scratch = new bytes(16384);
        for (uint256 f; f < 90; ++f) {
            _compose(movie, 1256 + f * 16392, true, r, scratch);
        }
        return movie;
    }
}
