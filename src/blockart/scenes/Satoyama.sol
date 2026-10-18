// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {Glyphs} from "../Glyphs.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";
import {CityKit} from "../CityKit.sol";

/// @notice 里山 SATOYAMA: rare rural night, snow peak, maglev viaduct, torii, lanterns and drifting cherry petals.
contract Satoyama is SceneBase {
    using Epoch for bytes;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return CityKit.palette(2);
    }

    function _backdrop(uint256 p, bytes memory e) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 200, 68, 64, 103, 20, 32, 2);
            for (uint256 k; k < 45; ++k) {
                Raster.dot(p, int256(e.hashByte(k % 10, k) % 128), int256(e.hashByte(k % 10, k + 7) % 45), 211);
            }
            Raster.disc(p, 103, 20, 7, 208);
            Raster.disc(p, 101, 19, 1, 213);
            // Two-pixel columns preserve the concave silhouette without oversized quad temporaries.
            for (int256 k = -30; k < 30; ++k) {
                int256 a = k < 0 ? -k : k;
                int256 x = 66 + k * 2;
                int256 y = 26 + (60 * a - a * a) * 40 / 900;
                Raster.rect(p, x, y, x + 2, 69, 55);
                if (a < 10) Raster.rect(p, x, y, x + 2, 46 + int256(e.hashByte(uint256(a) % 10, uint256(a)) % 4), 211);
            }
            for (uint256 layer; layer < 2; ++layer) {
                for (uint256 k; k < 64; ++k) {
                    int256 y = 69 + int256(layer) * 7 - SceneKit.sin(int256(k) * 32 + int256(e.hashByte(layer, 0)) * 4)
                        * 5 / 1024;
                    Raster.rect(p, int256(k) * 2, y, int256(k) * 2 + 2, 128, 32 + layer * 16);
                }
            }
            // Viaduct and river.
            Raster.rect(p, 0, 76, 128, 78, 240);
            Raster.rect(p, 0, 78, 128, 79, 97);
            for (int256 x = 7; x < 128; x += 16) {
                Raster.rect(p, x, 77, x + 1, 85, 240);
            }
            Raster.rect(p, 0, 85, 128, 92, 34);
            Raster.rect(p, 0, 92, 128, 128, 240);
            for (uint256 k; k < 5; ++k) {
                Raster.rect(p, 0, 94 + int256(k) * 3, 128, 95 + int256(k) * 3, 198 + k);
            }
            // Cherry trunks and clusters; immutable backdrop keeps the per-frame cost small.
            for (uint256 side; side < 2; ++side) {
                int256 x = side == 0 ? int256(0) : int256(127);
                int256 dir = side == 0 ? int256(1) : int256(-1);
                Raster.line(p, x, 127, x + dir * 10, 87, 241);
                Raster.line(p, x + dir, 127, x + dir * 11, 87, 241);
                for (uint256 k; k < 14; ++k) {
                    int256 bx = x + dir * (5 + int256(e.hashByte(k % 10, k) % 28));
                    int256 by = 79 + int256(e.hashByte(k % 10, k + 9) % 22);
                    Raster.line(p, x + dir * 10, 93, bx, by, 241);
                    Raster.disc(p, bx, by, 3 + int256(k % 3), 192 + k % 7);
                }
            }
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 cur = SceneKit.turn(f, 0);
            if (f % 15 < 7) Raster.dot(p, 66, 21, 160);
            for (uint256 i; i < 10; ++i) {
                int256 x = SceneKit.wrap(64 + (int256(f) * 10 - int256(i) * 90) * 15 / 90 + 75, 150) - 75;
                Raster.rect(p, x, 72, x + 14, 75, 209);
                Raster.rect(p, x, 73, x + 14, 74, (5 + e.neon(i)) * 16);
                for (uint256 w; w < 5; ++w) {
                    if (e.bloomBit(i, w * 11 + i)) {
                        Raster.dot(p, x + 1 + int256(w) * 2, 72, e.stateByte(i, w) & 1 == 1 ? 176 : 96);
                    }
                }
                int256 lx = 15 + int256(i) * 10;
                Raster.rect(p, lx, 108, lx + 2, 111, 54);
                Raster.rect(p, lx - 1, 106, lx + 3, 108, 54);
                Raster.dot(p, lx, 107, i == cur ? (5 + e.neon(i)) * 16 : 180);
            }
            // Torii, upright ベース plaque and current epoch block number.
            uint256 nc = (5 + e.neon(cur)) * 16;
            Raster.rect(p, 62, 87, 64, 108, 160);
            Raster.rect(p, 75, 87, 77, 108, 160);
            Raster.rect(p, 60, 93, 79, 95, 160);
            Raster.rect(p, 58, 85, 81, 88, nc);
            bytes memory table = Glyphs.TABLE;
            for (uint256 k; k < 3; ++k) {
                Raster.glyphSized(p, 67, 88 + int256(k) * 3, Glyphs.bits(table, uint8(Glyphs.BASE_VERTICAL[k])), 3, 176);
            }
            Raster.number(p, 70, 116, e.number(cur), 208);
            for (uint256 k; k < CityKit.activity(e, cur, 30, 40); ++k) {
                int256 phase = int256(f) * (k % 2 == 0 ? int256(1024) : int256(2048)) / 90;
                int256 y = SceneKit.wrap(
                        int256(e.hashByte(k % 10, k + 12)) * 90 + int256(f) * (k % 2 == 0 ? int256(128) : int256(256)),
                        11520
                    ) * 128 / 11520;
                int256 x = SceneKit.wrap(
                    int256(e.hashByte(k % 10, k)) + SceneKit.sin(phase + int256(k) * 57) * 5 / 1024 + y / 4, 128
                );
                Raster.rect(p, x, y, x + 2, y + 1, 192 + k % 4);
            }
        }
    }
}
