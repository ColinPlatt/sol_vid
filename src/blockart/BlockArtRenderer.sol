// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Epoch} from "./Epoch.sol";
import {InPlace} from "./InPlace.sol";

interface IBlockScene {
    /// @notice The whole 6-second loop as a 128x128 GIF, from a packed 10-block epoch.
    function gif(bytes memory epoch) external view returns (bytes memory);
    function avi(bytes memory epoch) external view returns (bytes memory);
}

/// @notice Routes an epoch to its scene. Each scene is its own contract (rasteriser, glyphs and GIF writer inlined),
///         so every one fits the contract size limit. Scene choice is fixed by the epoch's last block hash.
contract BlockArtRenderer {
    using Epoch for bytes;

    error InvalidScene();

    // CANYON, DESCENT, MONORAIL, SPIRE, SKYLINE, ALLEY, NIGHT TRAIN, and the rare SATOYAMA.
    address public immutable scene0;
    address public immutable scene1;
    address public immutable scene2;
    address public immutable scene3;
    address public immutable scene4;
    address public immutable scene5;
    address public immutable scene6;
    address public immutable scene7;

    constructor(address[8] memory scenes) {
        for (uint256 i; i < 8; ++i) {
            if (scenes[i].code.length == 0) revert InvalidScene();
        }
        (scene0, scene1, scene2, scene3) = (scenes[0], scenes[1], scenes[2], scenes[3]);
        (scene4, scene5, scene6, scene7) = (scenes[4], scenes[5], scenes[6], scenes[7]);
    }

    function sceneAddress(uint256 s) public view returns (address) {
        if (s == 0) return scene0;
        if (s == 1) return scene1;
        if (s == 2) return scene2;
        if (s == 3) return scene3;
        if (s == 4) return scene4;
        if (s == 5) return scene5;
        if (s == 6) return scene6;
        if (s == 7) return scene7;
        revert InvalidScene();
    }

    function sceneOf(bytes memory epoch) public pure returns (uint256) {
        if (epoch.length != 3520) revert InvalidScene();
        return epoch.scene();
    }

    function sceneName(uint256 s) public pure returns (string memory) {
        if (s == 0) return unicode"峡谷 CANYON";
        if (s == 1) return unicode"地下 DESCENT";
        if (s == 2) return unicode"高架 MONORAIL";
        if (s == 3) return unicode"摩天楼 SPIRE";
        if (s == 4) return unicode"夜景 SKYLINE";
        if (s == 5) return unicode"路地 ALLEY";
        if (s == 6) return unicode"夜行 NIGHT TRAIN";
        if (s == 7) return unicode"里山 SATOYAMA";
        revert InvalidScene();
    }

    function avi(bytes memory epoch) external view returns (bytes memory) {
        InPlace.forward(sceneAddress(sceneOf(epoch)), abi.encodeCall(IBlockScene.avi, (epoch)));
    }

    /// @dev Forwards the scene's returndata untouched: no second copy of the GIF.
    function gif(bytes memory epoch) external view returns (bytes memory) {
        InPlace.forward(sceneAddress(sceneOf(epoch)), abi.encodeCall(IBlockScene.gif, (epoch)));
    }
}
