// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {Glyphs} from "../Glyphs.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";
import {CityKit} from "../CityKit.sol";

/// @notice 夜行 NIGHT TRAIN: angled window onto passing towers, rails and catenary; amber next-block display.
contract NightTrain is SceneBase {
    using Epoch for bytes;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return CityKit.palette(0);
    }

    function _backdrop(uint256 p, bytes memory) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 150, 63, 32, 16, 63, 64, 4);
            Raster.rect(p, 0, 68, 128, 128, 241);
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 zcam = int256(f) * 16000 / 90;
            CityKit.Camera memory cam = CityKit.camera(0, -900, 101, 6, 70, 64);
            uint256 first = uint256(zcam / 1600);
            for (uint256 k = 10; k > 0; --k) {
                uint256 i = (first + k) % 10;
                int256 dz = SceneKit.wrap(int256(i) * 1600 - zcam, 16000);
                if (dz < 500) continue;
                uint256 fog = SceneKit.fog(dz, 500, 16000);
                int256 x = 3200 + int256(e.hashByte(i, 1)) * 2400 / 255;
                int256 top = -1800 - int256(e.gasBps(i) > 3000 ? 3000 : e.gasBps(i)) * 4500 / 3000;
                CityKit.tower(p, e, i, cam, x, dz, 600, top, 300, fog, 10);
                CityKit.Point memory sign = CityKit.project(cam, x - 650, top / 2, dz - 600);
                if (sign.z > 300 && sign.x > -12 && sign.x < 140) {
                    SceneKit.verticalSign(p, e.word(i), sign.x, sign.y, 5, 5 + e.neon(i), fog / 2);
                }
            }
            for (uint256 k; k < 20; ++k) {
                int256 z = SceneKit.wrap(int256(k) * 800 - zcam, 16000) + 200;
                CityKit.Point memory a = CityKit.project(cam, 750, -1600, z);
                CityKit.Point memory b = CityKit.project(cam, 750, 300, z);
                CityKit.Point memory c = CityKit.project(cam, 100, -1550, z);
                if (a.z > 180 && b.z > 180 && c.z > 180) {
                    Raster.line(p, a.x, a.y, b.x, b.y, 240);
                    Raster.line(p, a.x, a.y, c.x, c.y, 240);
                }
            }
            for (uint256 r; r < 2; ++r) {
                CityKit.Point memory a = CityKit.project(cam, 1000 + int256(r) * 600, 300, 1200);
                CityKit.Point memory b = CityKit.project(cam, 1000 + int256(r) * 600, 300, 20000);
                if (a.z > 180 && b.z > 180) Raster.line(p, a.x, a.y, b.x, b.y, 215);
            }
            SceneKit.rain(p, e, f, 32, -8, 230);
            Raster.rect(p, 0, 0, 128, 17, 240);
            Raster.rect(p, 0, 105, 128, 128, 240);
            Raster.rect(p, 0, 0, 5, 128, 240);
            Raster.rect(p, 123, 0, 128, 128, 240);
            for (uint256 k; k < 5; ++k) {
                int256 x = 15 + int256(k) * 24;
                int256 swing = SceneKit.sin(int256(f) * 3072 / 90 + int256(k) * 114) / 700;
                Raster.line(p, x, 17, x + swing, 26, 243);
                Raster.disc(p, x + swing, 28, 2, 208);
                Raster.dot(p, x + swing, 28, 240);
            }
            uint256 i = SceneKit.turn(f, 100);
            bytes memory table = Glyphs.TABLE;
            Raster.glyph(p, 25, 4, Glyphs.bits(table, uint8(Glyphs.NEXT[0])), 1, 128);
            Raster.glyph(p, 33, 4, Glyphs.bits(table, uint8(Glyphs.NEXT[1])), 1, 128);
            Raster.number(p, 75, 6, e.number(i), 128);
            Raster.number(p, 64, 115, e.number(i), 179);
        }
    }
}
