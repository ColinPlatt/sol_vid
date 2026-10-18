// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SingleBlockData} from "./SingleBlockData.sol";

/// @notice Versioned block-only variation. Visual channels are drawing parameters, not extra historical blocks.
library VideoRecipe {
    string internal constant VERSION = "BLOCKS_VIDEO_V2";

    struct Recipe {
        uint256 colourway;
        uint256 light;
        bool reverse;
        uint256 phase;
    }

    function seed(SingleBlockData.Info memory info) internal pure returns (bytes32) {
        return keccak256(abi.encode(VERSION, info));
    }

    function recipe(SingleBlockData.Info memory info) internal pure returns (Recipe memory r) {
        uint256 h = uint256(keccak256(abi.encode(seed(info), "look")));
        r = Recipe(h % 6, (h >> 16) % 3, (h >> 32) & 1 == 1, (h >> 48) % 90);
    }

    function artwork(SingleBlockData.Info memory info) internal pure returns (bytes memory data) {
        bytes32 entropy = seed(info);
        data = new bytes(3520);
        for (uint256 i; i < 10; ++i) {
            bytes32 channel = i == 9 ? entropy : keccak256(abi.encode(entropy, i));
            uint256 intensity = uint256(keccak256(abi.encode(channel, "intensity"))) % 3001;
            uint256 meta = uint256(uint64(info.number)) << 192 | intensity << 128 | uint256(10000) << 64
                | uint256(uint64(info.timestamp));
            bytes32 tint = keccak256(abi.encode(channel, "tint"));
            uint256 dst;
            assembly ("memory-safe") {
                dst := add(add(data, 32), mul(i, 352))
                mstore(dst, meta)
                mstore(add(dst, 32), channel)
                mstore(add(dst, 64), tint)
            }
            for (uint256 j; j < 8; ++j) {
                bytes32 lights = keccak256(abi.encode(channel, "lights", j));
                assembly ("memory-safe") { mstore(add(add(dst, 96), mul(j, 32)), lights) }
            }
        }
    }

    function colourwayName(uint256 n) internal pure returns (string memory) {
        return ["Neon", "Glacier", "Infrared", "Acid", "Ultraviolet", "Ember"][n];
    }

    function lightName(uint256 n) internal pure returns (string memory) {
        return ["Midnight", "Afterglow", "Daybreak"][n];
    }
}
