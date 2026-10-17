// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SolVideo} from "./SolVideo.sol";
import {MpegVideo} from "./MpegVideo.sol";

/// @notice A stable seed describes one artwork, independently of its output codec.
contract GenerativeVideo is SolVideo, MpegVideo {
    struct Ball {
        uint256 radius;
        uint256 xPhase;
        uint256 yPhase;
        bytes3 colour;
    }

    struct Recipe {
        uint256 seed;
        uint256 scene;
        uint256 ballCount;
        bytes palette;
        Ball[] balls;
    }

    /// @notice Versioned deterministic selection; four equally sized hash buckets.
    /// @dev This is artwork variation, not an unpredictable randomness source.
    function sceneForSeed(uint256 seed) public pure returns (uint256) {
        return 3 + uint256(keccak256(abi.encode("SOL_VIDEO_BALLS_V1", seed))) % 4;
    }

    /// @notice Inspectable traits for metadata or reproducing the animation.
    /// @dev Phase is a starting point on a reflected path of length 2*(63-2*radius).
    function recipe(uint256 seed) external pure returns (Recipe memory r) {
        r.seed = seed;
        r.scene = sceneForSeed(seed);
        r.ballCount = r.scene == 3 ? 1 : r.scene == 4 ? 2 : r.scene == 5 ? 4 : 6;
        r.palette = _palette(r.scene, seed);
        r.balls = new Ball[](r.ballCount);
        for (uint256 i; i < r.ballCount; ++i) {
            uint256 hash = uint256(keccak256(abi.encode(seed, i)));
            uint256 radius = 9 + (hash >> 24) % 7;
            uint256 period = 2 * (63 - 2 * radius);
            uint256 p = 3 * (i + 1);
            bytes3 colour = bytes3(r.palette[p]) | (bytes3(r.palette[p + 1]) >> 8) | (bytes3(r.palette[p + 2]) >> 16);
            r.balls[i] = Ball(radius, (hash >> 40) % period, (hash >> 72) % period, colour);
        }
    }

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
