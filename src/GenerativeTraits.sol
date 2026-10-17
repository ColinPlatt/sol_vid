// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Scene} from "./Scene.sol";

/// @notice Shared deterministic GHOULBALLS_VAPOR_V3 recipe and public trait ABI.
abstract contract GenerativeTraits is Scene {
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
        uint256 theme;
        uint256 motion;
    }

    /// @notice Versioned deterministic selection; four equally sized hash buckets.
    /// @dev This is artwork variation, not an unpredictable randomness source.
    function sceneForSeed(uint256 seed) public pure returns (uint256) {
        return 7 + _vaporKey(seed) % 4;
    }

    function themeName(uint256 theme) public pure returns (string memory) {
        if (theme == 0) return "Midnight";
        if (theme == 1) return "Lagoon";
        if (theme == 2) return "Ultraviolet";
        if (theme == 3) return "Sunset";
        revert InvalidSettings();
    }

    function motionName(uint256 motion) public pure returns (string memory) {
        if (motion == 0) return "Ricochet";
        if (motion == 1) return "Orbit";
        if (motion == 2) return "Float";
        if (motion == 3) return "Figure Eight";
        revert InvalidSettings();
    }

    /// @notice Inspectable traits for metadata or reproducing the animation.
    /// @dev xPhase/yPhase parameterize reflected motion; curved styles use the same ball hash.
    ///      The versioned recipe, seed and motion identify the complete path.
    function recipe(uint256 seed) external pure returns (Recipe memory r) {
        r.seed = seed;
        r.scene = sceneForSeed(seed);
        r.ballCount = r.scene == 7 ? 1 : r.scene == 8 ? 2 : r.scene == 9 ? 4 : 6;
        r.theme = (_vaporKey(seed) >> 8) % 4;
        r.motion = (_vaporKey(seed) >> 16) % 4;
        r.palette = _palette(r.scene, seed);
        r.balls = new Ball[](r.ballCount);
        for (uint256 i; i < r.ballCount; ++i) {
            uint256 hash = uint256(keccak256(abi.encode(seed, i)));
            uint256 radius = 5 + (hash >> 24) % 6;
            uint256 period = 2 * (63 - 2 * radius);
            uint256 p = 3 * (8 + i);
            bytes3 colour = bytes3(r.palette[p]) | (bytes3(r.palette[p + 1]) >> 8) | (bytes3(r.palette[p + 2]) >> 16);
            r.balls[i] = Ball(radius, (hash >> 40) % period, (hash >> 72) % period, colour);
        }
    }
}
