// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Raster} from "../Raster.sol";
import {Epoch} from "../Epoch.sol";
import {Glyphs} from "../Glyphs.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";

/// @notice 地下 DESCENT: riding the front of a train down a deep subway tunnel. Each block is a tunnel segment: wall
///         lamps lit from its logs bloom, a lit sign with its word and number, a signal at its start; the track runs
///         underneath toward the glow at the end of the line. Level camera, no rotation.
/// @dev Port of concepts/neo-tokyo/descent.js. Milli-units; camera 1.05 above the track, 16 units per loop.
contract Descent is SceneBase {
    using Epoch for bytes;

    int256 private constant SP = 1600;
    int256 private constant L = 16000;
    int256 private constant FAR = 15200;
    int256 private constant W = 1700;
    int256 private constant CAM_Y = -1050;
    int256 private constant F16 = 1024; // focal 64 px
    int256 private constant C16 = 1024; // centre 64 px

    uint256 private constant WALL = 1;
    uint256 private constant ROOF = 2;
    uint256 private constant RIB = 3;
    uint256 private constant WALL_B = 4;
    uint256 private constant NEON = 5;
    uint256 private constant FLOOR = 11;
    uint256 private constant LAMP = 12;
    uint256 private constant WHITE = 13;
    uint256 private constant SLEEPER = 14;
    uint256 private constant DARK = 15;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return SceneKit.palette(
            [
                uint24(0),
                0x1a1426,
                0x14101e,
                0x2e2440,
                0x1f182e,
                0,
                0,
                0,
                0,
                0,
                0,
                0x0e0b14,
                0xffc878,
                0,
                0x2c2228,
                0x06040a
            ],
            0x280c38,
            0x785a46, // dark ramp ends at the third rail's rust
            hex"06030c0c041311061b1708221d0929220a31280c3844134d5f1a627a217796288cb93996dc49a0ff5aaaff8cc3ffbedc",
            ""
        );
    }

    /// @dev Darkness with the glow at the far end of the line, then everything that looks the same in every frame
    ///      (the camera only moves forward through a uniform tunnel): shell, rails and cable runs.
    function _backdrop(uint256 p, bytes memory e) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 16, 16, 64, 16, 64, 64, 58, 15);
            (int256[13] memory xs, int256[13] memory ys) = _profile();
            for (int256 dz = L - SP; dz >= 0; dz -= SP) {
                _shell_(p, e, 0, dz, xs, ys);
            }
            _rails(p, 5);
        }
    }

    function _profile() internal pure returns (int256[13] memory xs, int256[13] memory ys) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            xs = [int256(-1700), -1700, -1617, -1375, -999, -525, 0, 525, 999, 1375, 1617, 1700, 1700];
            ys = [int256(0), -1500, -1809, -2088, -2309, -2451, -2500, -2451, -2309, -2088, -1809, -1500, 0];
        }
    }

    function _sx(int256 x, int256 dz) internal pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return C16 + x * F16 / dz;
        }
    }

    function _sy(int256 y, int256 dz) internal pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return C16 + (y - CAM_Y) * F16 / dz;
        }
    }

    function _fogAt(int256 dz) internal pure returns (uint256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return SceneKit.fog(dz, 0, FAR);
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 camZ = int256(f % SceneKit.FRAMES) * L / int256(SceneKit.FRAMES);
            (int256[13] memory xs, int256[13] memory ys) = _profile();
            // Segments far to near: one per block.
            int256[10] memory dzs;
            uint256[10] memory order;
            for (uint256 i; i < 10; ++i) {
                int256 dz = SceneKit.wrap(int256(i) * SP - camZ, L);
                uint256 j = i;
                while (j > 0 && dzs[j - 1] < dz) {
                    dzs[j] = dzs[j - 1];
                    order[j] = order[j - 1];
                    --j;
                }
                dzs[j] = dz;
                order[j] = i;
            }
            _ribs_(p, camZ, xs, ys);
            _track_(p, camZ);
            _rails(p, 3);
            // A ring lit in each block's colour where its segment begins.
            for (uint256 k; k < 10; ++k) {
                if (dzs[k] < 200 || dzs[k] > FAR) continue;
                uint256 c = (NEON + e.neon(order[k])) * 16 + _fogAt(dzs[k]) * 7 / 10;
                int256 px = _sx(xs[0], dzs[k]) >> 4;
                int256 py = _sy(ys[0], dzs[k]) >> 4;
                for (uint256 j = 1; j < 13; ++j) {
                    int256 qx = _sx(xs[j], dzs[k]) >> 4;
                    int256 qy = _sy(ys[j], dzs[k]) >> 4;
                    Raster.line(p, px, py, qx, qy, c);
                    px = qx;
                    py = qy;
                }
            }
            for (uint256 k; k < 10; ++k) {
                _fixtures_(p, e, order[k], dzs[k]);
            }
            SceneKit.hologram(p, e, SceneKit.turn(f, 100), 64, 3);
        }
    }

    /// @dev The tunnel shell of one segment: walls, arched roof and floor, shaded per block.
    function _shell_(uint256 p, bytes memory e, uint256 i, int256 dz, int256[13] memory xs, int256[13] memory ys)
        internal
        pure
    {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 z0 = dz < 150 ? int256(150) : dz;
            int256 z1 = dz + SP;
            uint256 fog = _fogAt(dz);
            uint256 wall = WALL * 16 + fog;
            for (uint256 k; k < 12; ++k) {
                uint256 c = (ys[k] < -1500 || ys[k + 1] < -1500) ? ROOF * 16 + fog : wall;
                Raster.quad(
                    p,
                    [
                        _sx(xs[k], z1),
                        _sy(ys[k], z1),
                        _sx(xs[k + 1], z1),
                        _sy(ys[k + 1], z1),
                        _sx(xs[k + 1], z0),
                        _sy(ys[k + 1], z0),
                        _sx(xs[k], z0),
                        _sy(ys[k], z0)
                    ],
                    c
                );
            }
            Raster.quad(
                p,
                [_sx(-W, z1), _sy(0, z1), _sx(W, z1), _sy(0, z1), _sx(W, z0), _sy(0, z0), _sx(-W, z0), _sy(0, z0)],
                FLOOR * 16 + fog
            );
        }
    }

    /// @dev Ribs every 0.8 units: the arch outline, fogged with distance.
    function _ribs_(uint256 p, int256 camZ, int256[13] memory xs, int256[13] memory ys) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (int256 z = (camZ / 800 + 1) * 800; z < camZ + FAR; z += 800) {
                int256 dz = z - camZ;
                if (dz < 200) continue;
                uint256 c = RIB * 16 + _fogAt(dz);
                int256 px = _sx(xs[0], dz) >> 4;
                int256 py = _sy(ys[0], dz) >> 4;
                for (uint256 k = 1; k < 13; ++k) {
                    int256 qx = _sx(xs[k], dz) >> 4;
                    int256 qy = _sy(ys[k], dz) >> 4;
                    Raster.line(p, px, py, qx, qy, c);
                    px = qx;
                    py = qy;
                }
            }
        }
    }

    /// @dev Fifty sleepers per 16-unit loop: spacing divides L so the seam preserves their phase.
    function _track_(uint256 p, int256 camZ) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (int256 z = (camZ / 320 + 1) * 320; z < camZ + FAR; z += 320) {
                int256 dz = z - camZ;
                if (dz < 150) continue;
                Raster.quad(
                    p,
                    [
                        _sx(-550, dz),
                        _sy(0, dz),
                        _sx(550, dz),
                        _sy(0, dz),
                        _sx(550, dz + 100),
                        _sy(0, dz + 100),
                        _sx(-550, dz + 100),
                        _sy(0, dz + 100)
                    ],
                    SLEEPER * 16 + _fogAt(dz)
                );
            }
        }
    }

    /// @dev Two running rails, the third rail and a cable run on each wall, to the end of the line.
    function _rails(uint256 p, uint256 count) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256[5] memory rx = [int256(-360), 360, 900, -W + 20, W - 20];
            int256[5] memory ry = [int256(-40), -40, -40, -1150, -1150];
            for (uint256 r; r < count; ++r) {
                // Start where the line enters the frame: |x| or |y - camera height| in front of the camera.
                int256 dz = rx[r] < 0 ? -rx[r] : rx[r];
                int256 dy = ry[r] - CAM_Y < 0 ? CAM_Y - ry[r] : ry[r] - CAM_Y;
                if (dy > dz) dz = dy;
                int256 px = _sx(rx[r], dz) >> 4;
                int256 py = _sy(ry[r], dz) >> 4;
                while (dz < FAR) {
                    dz = dz * 112 / 100 + 20;
                    if (dz > FAR) dz = FAR;
                    int256 qx = _sx(rx[r], dz) >> 4;
                    int256 qy = _sy(ry[r], dz) >> 4;
                    uint256 fog = _fogAt(dz);
                    uint256 c = r < 2 ? WHITE * 16 + fog * 7 / 10 : r == 2 ? DARK * 16 + 15 - fog / 3 : DARK * 16 + 1;
                    Raster.line(p, px, py, qx, qy, c);
                    px = qx;
                    py = qy;
                }
            }
        }
    }

    /// @dev Per block: wall lamps from the bloom, a signal at the segment start, and the lit sign mid-segment.
    function _fixtures_(uint256 p, bytes memory e, uint256 i, int256 dz) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 fog = _fogAt(dz);
            for (uint256 k; k < 16; ++k) {
                if (!e.bloomBit(i, k * 7 + i) || !e.hashBit(i, k)) continue;
                int256 side = k % 2 == 1 ? int256(1) : -1;
                int256 z = dz + (int256(k / 2) * 2 + 1) * SP / 16;
                if (z < 200) continue;
                int256 x = _sx(side * (W - 30), z) >> 4;
                int256 y = _sy(-1350, z) >> 4;
                uint256 c = (e.stateByte(i, k) & 1 == 1 ? LAMP : NEON + 1) * 16 + fog * 7 / 10;
                int256 s = 50000 / z / 16;
                Raster.rect(p, x - s, y, x + s + 1, y + s / 2 + 1, c);
            }
            // Signal: green ahead, red once it is near.
            if (dz > 200) {
                int256 x = _sx(-W + 150, dz + 50) >> 4;
                int256 y = _sy(-1000, dz + 50) >> 4;
                int256 r = 2400 / (dz + 50);
                Raster.disc(p, x, y, r, (dz < SP * 3 / 2 ? NEON + 5 : NEON + 4) * 16 + fog * 6 / 10);
            }
            // The block's sign on the wall: the word vertically, its number below when close.
            int256 zs = dz + SP / 2;
            if (zs > 300) {
                int256 side = e.hashByte(i, 0) & 1 == 1 ? int256(1) : -1;
                int256 fs = 9600 / zs;
                if (fs < 1) fs = 1;
                int256 x = (_sx(side * (W - 50), zs) >> 4) - side * fs * 6 / 10;
                int256 y = _sy(-1750, zs) >> 4;
                SceneKit.verticalSign(p, e.word(i), x, y, fs, NEON + e.neon(i), _fogAt(zs) * 6 / 10);
                if (fs >= 8) {
                    (uint256 len,) = Glyphs.word(e.word(i));
                    Raster.number(p, x, y + fs * int256(len * 108 + 70) / 100, e.number(i), (NEON + e.neon(i)) * 16);
                }
            }
        }
    }
}
