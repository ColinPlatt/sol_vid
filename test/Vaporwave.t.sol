// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BallsFrameHarness} from "./GhoulBalls.t.sol";

contract VaporwaveFrameTest {
    function _check(uint256 seed, uint256 scene) private {
        BallsFrameHarness harness = new BallsFrameHarness();
        (bytes memory first, bytes memory palette) = harness.frame(64, 0, 50, scene, seed);
        (bytes memory end,) = harness.frame(64, 50, 50, scene, seed);
        (bytes memory next,) = harness.frame(64, 12, 50, scene, seed);
        require(keccak256(first) == keccak256(end), "Motion loop is discontinuous");
        require(keccak256(first) != keccak256(next), "Motion is static");
        require(palette.length == 48, "Palette size differs");
        for (uint256 p; p < first.length; ++p) {
            require(uint8(first[p]) < 16, "Palette index overflow");
        }
    }

    function testRicochetLoop() public {
        _check(1, 8);
    }

    function testOrbitLoop() public {
        _check(2, 7);
    }

    function testFloatLoop() public {
        _check(99, 7);
    }

    function testFigureEightLoop() public {
        _check(6, 10);
    }
}
