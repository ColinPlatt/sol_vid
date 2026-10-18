// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../../src/blockart/Raster.sol";

/// @notice Scalar, Solidity-only scan conversion reference for the optimized Yul quadrilateral rasterizer.
contract BlockArtRasterTest {
    function compare(int256[8] memory v) internal pure {
        bytes memory actual = new bytes(16384);
        uint256 p;
        assembly ("memory-safe") { p := add(actual, 32) }
        Raster.quad(p, v, 173);
        bytes memory expected = new bytes(16384);
        for (int256 y; y < 128; ++y) {
            int256 lo = type(int128).max;
            int256 hi = type(int128).min;
            int256 yc = y * 16 + 8;
            for (uint256 i; i < 4; ++i) {
                uint256 j = (i + 1) % 4;
                int256 ya = v[i * 2 + 1];
                int256 yb = v[j * 2 + 1];
                if ((ya > yc) != (yb > yc)) {
                    int256 x = v[i * 2] + (v[j * 2] - v[i * 2]) * (yc - ya) / (yb - ya);
                    if (x < lo) lo = x;
                    if (x > hi) hi = x;
                }
            }
            if (lo > hi) continue;
            int256 a = (lo + 8) >> 4;
            int256 b = (hi + 8) >> 4;
            if (a < 0) a = 0;
            if (b > 128) b = 128;
            for (int256 x = a; x < b; ++x) {
                expected[uint256(y * 128 + x)] = bytes1(uint8(173));
            }
        }
        require(keccak256(actual) == keccak256(expected), "Quad differs from scalar reference");
    }

    function testQuadClippingAndWinding() public pure {
        compare([int256(160), 320, 480, 320, 480, 960, 160, 960]);
        compare([int256(160), 960, 480, 960, 480, 320, 160, 320]);
        compare([int256(-320), -160, 2400, 80, 2080, 960, 80, 2240]);
        compare([int256(16), 16, 16, 16, 16, 16, 16, 16]);
        compare([int256(-1600), -1600, -16, -1600, -16, -16, -1600, -16]);
    }
}
