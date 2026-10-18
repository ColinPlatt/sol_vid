// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {SceneKit} from "./SceneBase.sol";
import {Raster} from "./Raster.sol";
import {Epoch} from "./Epoch.sol";

/// @notice Integer perspective and palette tools for the 128px Neo-Tokyo translations.
library CityKit {
    using Epoch for bytes;

    struct Camera {
        int256 x;
        int256 y;
        int256 sy;
        int256 cy;
        int256 sp;
        int256 cp;
        int256 focal;
        int256 horizon;
    }

    function camera(int256 x, int256 y, int256 yaw, int256 pitch, int256 focal, int256 horizon)
        internal
        pure
        returns (Camera memory)
    {
        return Camera(
            x,
            y,
            SceneKit.sin(yaw),
            SceneKit.sin(yaw + 256),
            SceneKit.sin(pitch),
            SceneKit.sin(pitch + 256),
            focal,
            horizon
        );
    }

    struct Point {
        int256 x;
        int256 y;
        int256 z;
    }

    function palette(uint256 kind) internal pure returns (bytes memory) {
        uint24 fog = kind == 1 ? 0x142846 : kind == 2 ? 0x342052 : 0x461a60;
        uint24[16] memory ramps = [
            uint24(0),
            0x120c28,
            0x0b081a,
            0x24203a,
            0x1b142b,
            0,
            0,
            0,
            0,
            0,
            0,
            0xffbe6e,
            0xffaad0,
            0,
            0xc8d7ff,
            0x07060e
        ];
        bytes memory sky = new bytes(48);
        for (uint256 i; i < 16; ++i) {
            uint24 top = kind == 1 ? 0x030810 : 0x050310;
            uint24 end = kind == 1 ? 0x507090 : kind == 2 ? 0xf5a096 : 0xff70c0;
            for (uint256 c; c < 3; ++c) {
                uint256 shift = 16 - 8 * c;
                sky[3 * i + c] = bytes1(uint8((((top >> shift) & 255) * (15 - i) + ((end >> shift) & 255) * i) / 15));
            }
        }
        return SceneKit.palette(ramps, fog, 0x3c3450, sky, "");
    }

    /// @dev World coordinates in milli-units; y down, yaw/pitch in 1/1024 turns.
    /// @dev Scene positions are bounded milli-units (absolute value < 1,000,000), focal <= 128.
    ///      Trig coefficients are precomputed once per camera; fixed-point intermediates fit comfortably in int256.
    function project(Camera memory cam, int256 x, int256 y, int256 z) internal pure returns (Point memory p) {
        p = Point(0, 0, 0);
        assembly ("memory-safe") {
            let dx := sub(x, mload(cam))
            let dy := sub(y, mload(add(cam, 32)))
            let sy := mload(add(cam, 64))
            let cy := mload(add(cam, 96))
            let sp := mload(add(cam, 128))
            let cp := mload(add(cam, 160))
            let rx := sdiv(sub(mul(dx, cy), mul(z, sy)), 1024)
            let rz := sdiv(add(mul(dx, sy), mul(z, cy)), 1024)
            let ry := sdiv(sub(mul(dy, cp), mul(rz, sp)), 1024)
            let depth := sdiv(add(mul(dy, sp), mul(rz, cp)), 1024)
            mstore(add(p, 64), depth)
            if sgt(depth, 180) {
                let focal := mload(add(cam, 192))
                mstore(p, add(64, sdiv(mul(rx, focal), depth)))
                mstore(add(p, 32), add(mload(add(cam, 224)), sdiv(mul(ry, focal), depth)))
            }
        }
    }

    function quad(uint256 p, Point memory a, Point memory b, Point memory c, Point memory d, uint256 colour)
        internal
        pure
    {
        if (a.z <= 180 || b.z <= 180 || c.z <= 180 || d.z <= 180) return;
        Raster.quadPixels(p, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y], colour);
    }

    /// @dev Two visible box faces and roof; windows are verified bloom/hash bits, never an RPC transaction count.
    function tower(
        uint256 p,
        bytes memory e,
        uint256 i,
        Camera memory cam,
        int256 x,
        int256 z,
        int256 half,
        int256 top,
        int256 bottom,
        uint256 fog,
        uint256 rows
    ) internal pure returns (Point memory roof) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            Point memory a = project(cam, x - half, top, z - half);
            Point memory b = project(cam, x + half, top, z - half);
            Point memory c = project(cam, x + half, bottom, z - half);
            Point memory d = project(cam, x - half, bottom, z - half);
            quad(p, a, b, c, d, 16 + fog);
            bool right = x < cam.x;
            Point memory s = project(cam, right ? x + half : x - half, top, z + half);
            Point memory t = project(cam, right ? x + half : x - half, bottom, z + half);
            quad(p, right ? b : a, s, t, right ? c : d, 32 + fog);
            Point memory far = project(cam, right ? x - half : x + half, top, z + half);
            quad(p, a, b, right ? s : far, right ? far : s, 48 + fog);
            uint256 neon = (5 + e.neon(i)) * 16 + fog / 2;
            if (a.z > 180 && b.z > 180) Raster.line(p, a.x, a.y, b.x, b.y, neon);
            if (s.z > 180 && a.z > 180 && b.z > 180) {
                Raster.line(p, right ? b.x : a.x, right ? b.y : a.y, s.x, s.y, neon);
            }
            if (a.z > 180 && b.z > 180 && a.x < 128 && b.x >= 0) {
                for (uint256 r; r < rows; ++r) {
                    for (uint256 q; q < 4; ++q) {
                        uint256 bit = r * 4 + q;
                        if (!e.bloomBit(i, bit * 3 + i) || !e.hashBit(i, bit)) continue;
                        int256 wx = a.x + (b.x - a.x) * int256(2 * q + 1) / 8;
                        int256 wy = a.y + (d.y - a.y) * int256(2 * r + 1) / int256(2 * rows);
                        Raster.rect(p, wx, wy, wx + 1, wy + 1, (e.stateByte(i, bit) & 1 == 1 ? 176 : 208) + fog);
                    }
                }
            }
            roof = project(cam, x, top, z);
        }
    }

    function activity(bytes memory e, uint256 i, uint256 base, uint256 extra) internal pure returns (uint256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 used = e.gasBps(i);
            if (used > 10000) used = 10000;
            return base + used * extra / 10000;
        }
    }

    function traffic(uint256 p, bytes memory e, uint256 f, uint256 count, int256 horizon) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (uint256 k; k < count; ++k) {
                int256 x = SceneKit.wrap(
                    int256(e.hashByte(k % 10, k)) + int256(f) * 148 * (k % 2 == 0 ? int256(1) : int256(-1)) / 90, 148
                ) - 10;
                int256 y = horizon + 8 + int256(e.hashByte(k % 10, k + 7) % 22);
                Raster.line(p, x, y, x + 3, y, k % 2 == 0 ? 208 : 160);
            }
        }
    }
}
