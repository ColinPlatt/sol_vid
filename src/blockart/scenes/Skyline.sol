// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";
import {CityKit} from "../CityKit.sol";

/// @notice 夜景 SKYLINE: flyover above paired towers, gas-shaped roofs and a pink fog sea.
contract Skyline is SceneBase {
    using Epoch for bytes;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return CityKit.palette(0);
    }

    function _backdrop(uint256 p, bytes memory e) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 160, 42, 32, 64, 42, 65, 5);
            for (uint256 k; k < 64; ++k) {
                int256 x = int256(k * 2);
                int256 h = 2 + int256(e.hashByte(k % 10, k) % 7);
                Raster.rect(p, x, 42 - h, x + 2, 44, 25);
            }
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 zcam = int256(f) * 22000 / 90;
            CityKit.Camera memory cam =
                CityKit.camera(SceneKit.sin(int256(f) * 1024 / 90) * 350 / 1024, -3400, 0, 39, 79, 61);
            // Far-to-near traversal remains periodic at frame 90.
            uint256 first = uint256(zcam / 2200);
            for (uint256 k = 10; k > 0; --k) {
                uint256 i = (first + k) % 10;
                int256 dz = SceneKit.wrap(int256(i) * 2200 - zcam, 22000);
                if (dz < 400) continue;
                uint256 fog = SceneKit.fog(dz, 500, 22000);
                for (uint256 side; side < 2; ++side) {
                    int256 x = (side == 0 ? int256(-1) : int256(1))
                        * (2200 + int256(e.hashByte(i, 1 + side * 5)) * 1600 / 255);
                    bool own = (e.hashByte(i, 0) & 1) == side;
                    int256 top = own
                        ? -1200 - int256(e.gasBps(i) > 3000 ? 3000 : e.gasBps(i)) * 3600 / 3000
                        : -400 - int256(e.hashByte(i, 7)) * 1600 / 255;
                    CityKit.Point memory roof = CityKit.tower(
                        p, e, i, cam, x, dz, own ? int256(400) : int256(320), top, 3200, fog, own ? 6 : 3
                    );
                    if (own && roof.z > 500 && roof.x > -12 && roof.x < 140) {
                        SceneKit.verticalSign(p, e.word(i), roof.x, roof.y - 12, 4, (5 + e.neon(i)), fog / 2);
                    }
                }
            }
            CityKit.traffic(p, e, f, CityKit.activity(e, SceneKit.turn(f, 200), 12, 16), 44);
            SceneKit.hologram(p, e, SceneKit.turn(f, 200), 64, 3);
            SceneKit.rain(p, e, f, 40, 1, 230);
        }
    }
}
