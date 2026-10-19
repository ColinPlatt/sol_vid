// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {SingleBlockData} from "./SingleBlockData.sol";

/// @notice Independent, visible composition channels. No mint serial or playback phase is credited as diversity.
library VideoRecipeV3 {
    string internal constant VERSION = "BLOCKS_VIDEO_V3";

    struct Recipe {
        uint256 hue;
        uint256 saturation;
        uint256 heightBand;
        uint256 density;
        uint256 layout;
        uint256 crop;
        uint256 pan;
        bool mirror;
        bool reverse;
        uint256 phase;
        bytes32 tint;
    }

    function seed(SingleBlockData.Info memory info) internal pure returns (bytes32) {
        return keccak256(abi.encode(VERSION, info));
    }

    function recipe(SingleBlockData.Info memory info) internal pure returns (Recipe memory r) {
        uint256 h = uint256(keccak256(abi.encode(seed(info), "composition")));
        r = Recipe(
            h % 360,
            65 + (h >> 16) % 31,
            (h >> 24) % 8,
            (h >> 32) % 4,
            (h >> 40) % 4,
            (h >> 48) % 4,
            (h >> 56) % 9,
            (h >> 64) & 1 == 1,
            (h >> 72) & 1 == 1,
            (h >> 80) % 90,
            keccak256(abi.encode(seed(info), "palette"))
        );
    }

    function artwork(SingleBlockData.Info memory info) internal pure returns (bytes memory data) {
        bytes32 entropy = seed(info);
        Recipe memory r = recipe(info);
        data = new bytes(3520);
        for (uint256 i; i < 10; ++i) {
            uint256 channel = uint256(i == 9 ? entropy : keccak256(abi.encode(entropy, i)));
            // Scene selection uses high bytes of channel 9; only its low-level side bit is changed.
            uint256 side = r.layout == 1 ? i % 2 : r.layout == 2 ? (i < 7 ? 0 : 1) : (i < 7 ? 1 : 0);
            if (r.layout != 0 && i != 9) channel = (channel & ~(uint256(1) << 248)) | side << 248;
            uint256 intensity = 100 + r.heightBand * 300 + uint256(keccak256(abi.encode(channel, "height"))) % 701;
            uint256 meta = uint256(uint64(info.number)) << 192 | intensity << 128 | uint256(10000) << 64
                | uint256(uint64(info.timestamp));
            bytes32 tint = keccak256(abi.encode(channel, "windows"));
            uint256 dst;
            assembly ("memory-safe") {
                dst := add(add(data, 32), mul(i, 352))
                mstore(dst, meta)
                mstore(add(dst, 32), channel)
                mstore(add(dst, 64), tint)
            }
            for (uint256 j; j < 8; ++j) {
                uint256 lights = uint256(keccak256(abi.encode(channel, "lights", j)));
                uint256 mask = uint256(keccak256(abi.encode(channel, "occupancy", j)));
                if (r.density == 0) lights &= mask & (mask >> 1);
                else if (r.density == 1) lights &= mask;
                else if (r.density == 3) lights |= mask;
                assembly ("memory-safe") { mstore(add(add(dst, 96), mul(j, 32)), lights) }
            }
        }
    }
}
