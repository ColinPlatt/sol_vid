// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoRecipeV3} from "../../src/blockart/VideoRecipeV3.sol";
import {AviVariationV3} from "../../src/blockart/AviVariationV3.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
import {DescentV3} from "../../src/blockart/scenes/DescentV3.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";

contract VideoDiversityTest {
    using Epoch for bytes;

    function testSceneRarityAndRecipeBoundsAcrossEntropy() public pure {
        SingleBlockData.Info memory b =
            SingleBlockData.Info(13000000, 1800000000, 60000000, 20, 0, address(0xBEEF), 11155111);
        uint256 densities;
        uint256 layouts;
        uint256 heights;
        uint256 crops;
        uint256 mirrors;
        for (uint256 i; i < 256; ++i) {
            b.prevrandao = i + 1;
            VideoRecipeV3.Recipe memory r = VideoRecipeV3.recipe(b);
            require(
                r.hue < 360 && r.saturation >= 65 && r.saturation <= 95 && r.heightBand < 8 && r.density < 4
                    && r.layout < 4 && r.crop < 4 && r.pan < 9 && r.phase < 90
            );
            uint256 h = uint256(VideoRecipeV3.seed(b));
            require(
                VideoRecipeV3.artwork(b).scene() == (((h >> 216) & 255) < 4 ? 7 : (h >> 224) % 7),
                "Layout changed scene rarity"
            );
            densities |= 1 << r.density;
            layouts |= 1 << r.layout;
            heights |= 1 << r.heightBand;
            crops |= 1 << r.crop;
            mirrors |= r.mirror ? 2 : 1;
        }
        require(
            densities == 15 && layouts == 15 && heights == 255 && crops == 15 && mirrors == 3, "Missing visual channels"
        );
    }

    function testCompositionEdgesAndMirrorAcrossAllViews() public pure {
        bytes memory original = new bytes(16384);
        bytes memory pal = new bytes(768);
        for (uint256 y; y < 128; ++y) {
            for (uint256 x; x < 128; ++x) {
                original[y * 128 + x] = bytes1(uint8((x + 3 * y) % 256));
            }
        }
        for (uint256 crop; crop < 4; ++crop) {
            for (uint256 mirror; mirror < 2; ++mirror) {
                for (uint256 pan; pan < 9; ++pan) {
                    bytes memory raw = new bytes(16384);
                    assembly ("memory-safe") { mcopy(add(raw, 32), add(original, 32), 16384) }
                    VideoRecipeV3.Recipe memory r;
                    r.crop = crop;
                    r.pan = pan;
                    r.mirror = mirror == 1;
                    r.saturation = 80;
                    (bytes memory transformed,) = AviVariationV3.frame(raw, pal, r, 7);
                    for (uint256 p; p < 3; ++p) {
                        uint256 y = p == 0 ? 0 : p == 1 ? 64 : 127;
                        uint256 sourceY = crop * 4 + y * (128 - crop * 8) / 128 + pan;
                        sourceY = sourceY < 4 ? 0 : sourceY - 4;
                        if (sourceY > 127) sourceY = 127;
                        for (uint256 q; q < 3; ++q) {
                            uint256 x = q == 0 ? 0 : q == 1 ? 64 : 127;
                            uint256 sourceX = mirror == 1 ? 127 - x : x;
                            require(
                                transformed[y * 128 + x] == original[sourceY * 128 + sourceX], "Incorrect composed edge"
                            );
                        }
                    }
                }
            }
        }
    }

    function testTunnelProfilesTrackGaugeAndLoopBoundary() public {
        DescentV3 tunnel = new DescentV3();
        require(address(tunnel).code.length <= 24576);
        SingleBlockData.Info memory info =
            SingleBlockData.Info(13000000, 1800000000, 60000000, 20, 1, address(0xBEEF), 11155111);
        bytes memory e = VideoRecipeV3.artwork(info);
        bytes32[4] memory hashes;
        for (uint256 shape; shape < 4; ++shape) {
            e[9 * 352 + 32 + 20] = bytes1(uint8(shape));
            (bytes memory first, bytes memory pal) = tunnel.frame(e, 0);
            (bytes memory end, bytes memory endPal) = tunnel.frame(e, 90);
            require(
                keccak256(first) == keccak256(end) && keccak256(pal) == keccak256(endPal),
                "Tunnel loop boundary differs"
            );
            hashes[shape] = keccak256(first);
            for (uint256 prior; prior < shape; ++prior) {
                require(hashes[prior] != hashes[shape], "Tunnel section has no visible effect");
            }
        }
        e[9 * 352 + 32 + 22] = 0;
        (bytes memory narrow,) = tunnel.frame(e, 0);
        e[9 * 352 + 32 + 22] = bytes1(uint8(255));
        (bytes memory wide,) = tunnel.frame(e, 0);
        require(keccak256(narrow) != keccak256(wide), "Track gauge has no visible effect");
    }
}
