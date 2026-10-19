// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoRecipeV3} from "./VideoRecipeV3.sol";
import {VideoRecipe} from "./VideoRecipe.sol";
import {AviVariation} from "./AviVariation.sol";
import {AviVariationV3} from "./AviVariationV3.sol";
import {BlocksHud} from "./BlocksHud.sol";

/// @notice BLOCKS_VIDEO_V4: V3's seed, recipe, palettes and scene geometry, framed without mirroring or crop resampling
///         so lettering stays readable, with block-data bands drawn over the top and bottom of every frame.
library AviVariationV4 {
    /// @dev The single reference frame path (poster tests and audits), matching `remix` for frame `f`.
    function frame(
        bytes memory raw,
        bytes memory pal,
        VideoRecipeV3.Recipe memory r,
        uint256 scene,
        BlocksHud.Bands memory b,
        uint256 f
    ) internal pure returns (bytes memory, bytes memory) {
        require(raw.length == 16384, "Frame length");
        // As in V2 and V3, the scenes' synthetic gas labels become decorative chips.
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
        uint256 p;
        assembly ("memory-safe") { p := add(raw, 32) }
        BlocksHud.paintTopDown(p, b, f);
        return (raw, AviVariationV3.palette(pal, r));
    }

    function remix(bytes memory movie, VideoRecipeV3.Recipe memory r, uint256 scene, BlocksHud.Bands memory b)
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
        bytes memory pal = AviVariationV3.palette(source, r);
        for (uint256 i; i < 256; ++i) {
            uint256 p = 212 + i * 4;
            movie[p + 2] = pal[i * 3];
            movie[p + 1] = pal[i * 3 + 1];
            movie[p] = pal[i * 3 + 2];
        }
        BlocksHud.paintMovie(movie, b);
        return movie;
    }
}
