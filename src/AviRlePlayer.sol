// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AviRleVideo} from "./AviRleVideo.sol";
import {AviPlayer} from "./AviPlayer.sol";
import {Base64} from "../vendor/openzeppelin/Flattened.sol";

/// @notice Standalone onchain player; split from the renderer to respect EIP-170.
contract AviRlePlayer {
    AviRleVideo public immutable renderer;

    constructor(AviRleVideo renderer_) {
        renderer = renderer_;
    }

    /// @notice Includes rendering, base64 and the complete embedded decoder in one read.
    function playerURI(uint256 size, uint256 seed) external view returns (string memory) {
        return string.concat(
            "data:text/html,", AviPlayer.HEAD, Base64.encode(renderer.aviFromSeed(size, seed)), AviPlayer.TAIL
        );
    }
}
