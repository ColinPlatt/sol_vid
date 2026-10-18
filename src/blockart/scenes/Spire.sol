// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";
import {CityKit} from "../CityKit.sol";

/// @notice 摩天楼 SPIRE: one orbit around an octagonal megatower, rising through ten hash-shaped segments.
contract Spire is SceneBase {
    using Epoch for bytes;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return CityKit.palette(1);
    }

    function _backdrop(uint256 p, bytes memory e) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 96, 76, 128, 64, 70, 64, 3);
            for (uint256 k; k < 40; ++k) {
                int256 x = int256(k) * 4 - 12;
                int256 h = 3 + int256(e.hashByte(k % 10, k) % 22);
                Raster.rect(p, x, 111 - h, x + 3, 128, 25);
                Raster.dot(p, x + 1, 113 - h, 182);
            }
        }
    }

    function _vertex(CityKit.Camera memory cam, int256 angle, int256 radius, int256 y)
        private
        pure
        returns (CityKit.Point memory)
    {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return CityKit.project(
                cam, SceneKit.sin(angle) * radius / 1024, -y, 7500 + SceneKit.sin(angle + 256) * radius / 1024
            );
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            CityKit.Camera memory cam = CityKit.camera(0, 0, 0, 0, 115, 67);
            int256 yaw = int256(f) * 1024 / 90;
            int256 rise = int256(f) * 14000 / 90;
            for (uint256 i; i < 10; ++i) {
                int256 y = SceneKit.wrap(int256(i) * 1400 - rise + 6000, 14000) - 6000;
                int256 r = 1100 + int256(e.hashByte(i, 1)) * 500 / 255 + int256(e.gasBps(i) > 3000 ? 3000 : e.gasBps(i))
                    * 400 / 3000;
                for (uint256 side; side < 8; ++side) {
                    int256 angle = int256(side) * 128 + yaw;
                    if (SceneKit.sin(angle + 64 + 256) > 0) continue;
                    CityKit.Point memory a = _vertex(cam, angle, r, y);
                    CityKit.Point memory b = _vertex(cam, angle + 128, r, y);
                    CityKit.Point memory c = _vertex(cam, angle + 128, r, y + 1250);
                    CityKit.Point memory d = _vertex(cam, angle, r, y + 1250);
                    if (a.y < 0 && d.y < 0 || a.y > 127 && d.y > 127) continue;
                    CityKit.quad(p, a, b, c, d, 16 + (side % 2) * 16 + 2);
                    for (uint256 row; row < 6; ++row) {
                        for (uint256 q; q < 3; ++q) {
                            uint256 bit = side * 18 + row * 3 + q;
                            if (!e.bloomBit(i, bit * 3 + i) || !e.hashBit(i, bit)) continue;
                            int256 x = a.x + (b.x - a.x) * int256(2 * q + 1) / 6;
                            int256 yy = a.y + (d.y - a.y) * int256(2 * row + 1) / 12;
                            Raster.dot(p, x, yy, e.stateByte(i, bit) & 1 == 1 ? 176 : 208);
                        }
                    }
                    Raster.line(p, d.x, d.y, c.x, c.y, (5 + e.neon(i)) * 16);
                }
                int256 sa = int256(e.hashByte(i, 4)) * 1024 / 256 + yaw;
                if (SceneKit.sin(sa + 256) < -100) {
                    CityKit.Point memory s = _vertex(cam, sa, r + 150, y + 1100);
                    SceneKit.verticalSign(p, e.word(i), s.x, s.y, 5, 5 + e.neon(i), 1);
                }
            }
            CityKit.traffic(p, e, f, CityKit.activity(e, SceneKit.turn(f, 100), 14, 14), 70);
            SceneKit.hologram(p, e, SceneKit.turn(f, 100), 64, 3);
            SceneKit.rain(p, e, f, 30, 1, 231);
        }
    }
}
