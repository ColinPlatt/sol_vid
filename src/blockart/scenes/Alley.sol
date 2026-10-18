// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";
import {CityKit} from "../CityKit.sol";

/// @notice 路地 ALLEY: wet corridor, hash-selected neon signs, bloom windows, paper lanterns and a hash vending machine.
contract Alley is SceneBase {
    using Epoch for bytes;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return CityKit.palette(0);
    }

    function _backdrop(uint256 p, bytes memory) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 160, 56, 16, 64, 56, 48, 6);
            Raster.quadPixels(p, [-int256(30), -300, int256(59), 31, int256(59), 62, -30, 180], 17);
            Raster.quadPixels(p, [int256(69), 31, int256(158), -300, int256(158), 180, int256(69), 62], 33);
            Raster.quadPixels(p, [int256(59), 62, int256(69), 62, int256(128), 128, int256(0), 128], 242);
        }
    }

    function _x(int256 side, int256 z) private pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return 64 + side * 41000 / z;
        }
    }

    function _y(int256 y, int256 z) private pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return 56 + y * 41 / z;
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 cam = int256(f) * 10000 / 90;
            uint256 first = uint256(cam / 1000);
            for (uint256 k = 10; k > 0; --k) {
                uint256 i = (first + k) % 10;
                int256 z = SceneKit.wrap(int256(i) * 1000 - cam, 10000) + 450;
                if (z > 9700) continue;
                uint256 fog = SceneKit.fog(z, 450, 9700);
                for (int256 side = -1; side <= 1; side += 2) {
                    int256 sx = _x(side, z);
                    Raster.line(p, sx, _y(-6000, z), sx, _y(1250, z), 240 + fog / 2);
                    for (uint256 r; r < 10; ++r) {
                        for (uint256 q; q < 3; ++q) {
                            uint256 bit = r * 3 + q + (side > 0 ? 64 : 0);
                            if (!e.bloomBit(i, bit * 5 + i) || !e.hashBit(i, bit)) continue;
                            int256 zz = z + int256(q) * 280 + 85;
                            int256 x = _x(side, zz);
                            int256 y = _y(-5600 + int256(r) * 420, zz);
                            Raster.rect(p, x, y, x + 1, y + 2, (e.stateByte(i, bit) & 1 == 1 ? 176 : 208) + fog);
                        }
                    }
                }
                int256 s = e.hashByte(i, 2) & 1 == 1 ? int256(1) : int256(-1);
                int256 fs = 12300 / (z + 150);
                if (fs < 3) fs = 3;
                if (fs > 11) fs = 11;
                int256 sx = 64 + s * 32000 / (z + 150);
                int256 sy = _y(-2600 + int256(e.hashByte(i, 4)) * 1200 / 255, z + 150);
                SceneKit.verticalSign(p, e.word(i), sx, sy, fs, 5 + e.neon(i), fog / 2);
                // Short, dithered reflections in the wet floor, in this block's own neon colour.
                int256 reflection = 64 + s * 22000 / (z + 500);
                for (uint256 r; r < 3; ++r) {
                    Raster.rect(
                        p,
                        reflection - 1,
                        _y(1250, z) + int256(r) * 3,
                        reflection + 2,
                        _y(1250, z) + int256(r) * 3 + 1,
                        (5 + e.neon(i)) * 16 + 8 + r
                    );
                }
                if (e.hashByte(i, 9) % 2 == 0) {
                    int256 zz = z + 500;
                    int256 yy = _y(-1600, zz);
                    Raster.line(p, _x(-1, zz), yy, 64, yy + 3, 240 + fog / 2);
                    Raster.line(p, 64, yy + 3, _x(1, zz), yy, 240 + fog / 2);
                    int256 radius = 2800 / zz;
                    if (radius < 1) radius = 1;
                    for (int256 q = -1; q <= 1; ++q) {
                        Raster.disc(p, 64 + q * 18000 / zz, yy + 5, radius, 160 + fog / 2);
                    }
                }
            }
            uint256 cur = SceneKit.turn(f, 300);
            SceneKit.hologram(p, e, cur, 64, 3);
            // Vending machine's 8x8 hash panel and state-root buttons.
            Raster.rect(p, 5, 65, 25, 108, 33);
            Raster.rect(p, 7, 68, 23, 91, 98);
            for (uint256 r; r < 8; ++r) {
                for (uint256 q; q < 8; ++q) {
                    if (e.hashBit(cur, r * 8 + q)) Raster.dot(p, 8 + int256(q) * 2, 70 + int256(r) * 2, 209);
                }
            }
            for (uint256 k; k < 8; ++k) {
                Raster.rect(
                    p,
                    8 + int256(k % 4) * 4,
                    96 + int256(k / 4) * 4,
                    10 + int256(k % 4) * 4,
                    98 + int256(k / 4) * 4,
                    (5 + e.stateByte(cur, k) % 6) * 16
                );
            }
            SceneKit.rain(p, e, f, 45, 1, 232);
        }
    }
}
