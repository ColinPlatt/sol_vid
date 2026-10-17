// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SolVideo} from "./SolVideo.sol";
import {GenerativeTraits} from "./GenerativeTraits.sol";
import {MpegVideo} from "./MpegVideo.sol";

/// @notice A stable seed describes one artwork, independently of its output codec.
contract GenerativeVideo is SolVideo, MpegVideo, GenerativeTraits {
    function gifFromSeed(uint256 size, uint256 fps, uint256 seed) external pure returns (bytes memory) {
        return gif(size, fps, sceneForSeed(seed), seed);
    }

    function aviFromSeed(uint256 size, uint256 fps, uint256 seed) external pure returns (bytes memory) {
        return avi(size, fps, sceneForSeed(seed), seed);
    }

    function mpegFromSeed(uint256 size, uint256 seed) external pure returns (bytes memory) {
        return mpeg(size, sceneForSeed(seed), seed);
    }

    function mpgFromSeed(uint256 size, uint256 seed) external pure returns (bytes memory) {
        return mpg(size, sceneForSeed(seed), seed);
    }
}
