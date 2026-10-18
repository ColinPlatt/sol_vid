// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Raster} from "../Raster.sol";
import {Glyphs} from "../Glyphs.sol";
import {Epoch} from "../Epoch.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";

/// @notice 峡谷 CANYON: the camera glides down a megacity street canyon; each block of the epoch is a building it passes
///         (vertical neon sign with its word, windows from its logs bloom, a skybridge every fourth block). The block
///         just ahead floats as a ベース・ブロック hologram. 128x128, 90 frames at 15fps, one seamless 6-second loop.
/// @dev Port of concepts/neo-tokyo/canyon.js. World units are milli-units; the camera moves 16 units (10 blocks x 1.6)
///      per loop. Palette: 16 ramps x 16 shades; shade = distance fog toward FOG.
contract Canyon is SceneBase {
    using Epoch for bytes;

    uint256 private constant FRAMES = SceneKit.FRAMES;
    int256 private constant NEAR = 320;
    int256 private constant FAR = 14000;
    int256 private constant SP = 1600;
    int256 private constant D = 16000;
    int256 private constant STREET = 3200;
    int256 private constant CANYON = 1250;
    int256 private constant DEPTH = 1312; // 0.82 * SP
    int256 private constant VX16 = 1024; // 64 px
    int256 private constant VY16 = 819; // 0.4 * 128 px
    int256 private constant F16 = 832; // focal length 52 px, in 1/16 px

    // Ramps.
    uint256 private constant SKY = 0;
    uint256 private constant WALL = 1;
    uint256 private constant FRONT = 2;
    uint256 private constant WARM = 3;
    uint256 private constant COOL = 4;
    uint256 private constant NEON = 5; // 5..10
    uint256 private constant BRIDGE = 11;
    uint256 private constant LAMP = 12;
    uint256 private constant WHITE = 13;
    uint256 private constant RAIN = 14;
    uint256 private constant DARK = 15;

    struct Building {
        int256 side;
        int256 x0;
        int256 top;
        uint256 neon;
        uint256 word;
        uint256 lit; // bit k (k = row * 5 + column): window lit, from the logs bloom and hash
        uint256 warm; // bit k: warm (amber) rather than cool, from the state root
    }

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        // Sky: dark zenith -> fog -> the pink glow at the vanishing point.
        return SceneKit.palette(
            [
                uint24(0),
                0x100a20, // wall
                0x0a0616, // front
                0xffbe6e, // warm window
                0x78dcff, // cool window
                0,
                0,
                0,
                0,
                0,
                0,
                0x140e28, // bridge
                0xffd28c, // lamp
                0,
                0xbed2ff, // rain
                0x020104 // dark
            ],
            0x46165c,
            0xff5ab4,
            hex"0603120e061d1708281f0b32280d3d3010483b135246165c671f6f892783aa3096c640a2e350aeff60baff88cfffafe4",
            ""
        );
    }

    /// @dev Static sky: vertical gradient plus a radial glow at the vanishing point.
    function _backdrop(uint256 p, bytes memory) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 112, 51, 48, 64, 51, 58, 9);
        }
    }

    /// @dev Per building, 7 words: side, x0, top, neon, word, lit mask, warm mask.
    function _prepare(bytes memory e) internal pure override returns (uint256[] memory st) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            st = new uint256[](70);
            for (uint256 i; i < 10; ++i) {
                int256 side = e.hashByte(i, 0) & 1 == 1 ? int256(1) : -1;
                uint256 g = e.gasBps(i) * 7 / 3; // min(1, gas / 0.3) * 7000
                if (g > 7000) g = 7000;
                uint256 lit;
                uint256 warm;
                for (uint256 k; k < 150; ++k) {
                    if (e.bloomBit(i, k * 3 + i) && e.hashBit(i, k)) lit |= 1 << k;
                    if (e.stateByte(i, k % 32) & 1 == 1) warm |= 1 << k;
                }
                st[i * 7] = uint256(side);
                st[i * 7 + 1] = uint256(side * (CANYON + int256(e.hashByte(i, 1)) * 350 / 255));
                st[i * 7 + 2] = uint256(-2400 - int256(g) - int256(e.hashByte(i, 2)) * 2000 / 255);
                st[i * 7 + 3] = e.neon(i);
                st[i * 7 + 4] = e.word(i);
                st[i * 7 + 5] = lit;
                st[i * 7 + 6] = warm;
            }
        }
    }

    function _b(uint256[] memory st, uint256 i) internal pure returns (Building memory b) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            b.side = int256(st[i * 7]);
            b.x0 = int256(st[i * 7 + 1]);
            b.top = int256(st[i * 7 + 2]);
            b.neon = st[i * 7 + 3];
            b.word = st[i * 7 + 4];
            b.lit = st[i * 7 + 5];
            b.warm = st[i * 7 + 6];
        }
    }

    function _fog(int256 dz) internal pure returns (uint256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return SceneKit.fog(dz, NEAR, FAR);
        }
    }

    /// @dev World point -> screen, in 1/16 px.
    function _px(int256 x, int256 dz) internal pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return VX16 + x * F16 / dz;
        }
    }

    function _py(int256 y, int256 dz) internal pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return VY16 + y * F16 / dz;
        }
    }

    function _wrap(int256 x, int256 m) internal pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return SceneKit.wrap(x, m);
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory st, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 camZ = int256(f) * D / int256(FRAMES);
            _street(p, f);
            // Buildings, far to near.
            int256[10] memory dzs;
            uint256[10] memory order;
            uint256 count;
            for (uint256 i; i < 10; ++i) {
                int256 dz = _wrap(int256(i) * SP - camZ, D);
                if (dz < NEAR) dz += D;
                if (dz > FAR) continue;
                uint256 j = count++;
                while (j > 0 && dzs[j - 1] < dz) {
                    dzs[j] = dzs[j - 1];
                    order[j] = order[j - 1];
                    --j;
                }
                dzs[j] = dz;
                order[j] = i;
            }
            for (uint256 k; k < count; ++k) {
                _building(p, e, _b(st, order[k]), order[k], dzs[k], f);
            }
            _traffic(p, e, f);
            SceneKit.hologram(p, e, SceneKit.turn(f, 400), 64, 3);
            SceneKit.rain(p, e, f, 60, 1, RAIN * 16 + 6);
            _ledge(p, f);
        }
    }

    /// @dev Rivers of tail lights and headlights on the street far below, flowing toward the vanishing point.
    function _street(uint256 p, uint256 f) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (uint256 k; k < 60; ++k) {
                int256 lane = (int256(k % 4) * 2 - 3) * 140;
                int256 dir = k % 2 == 1 ? int256(1) : -1;
                int256 z =
                    _wrap(int256(k) * 370 + dir * int256(f) * FAR * int256(1 + k % 3) / int256(FRAMES), FAR) + NEAR;
                uint256 fog = _fog(z) * 8 / 10;
                Raster.dot(p, _px(lane, z) >> 4, _py(STREET, z) >> 4, (dir > 0 ? NEON + 5 : WHITE) * 16 + fog);
            }
        }
    }

    function _building(uint256 p, bytes memory e, Building memory b, uint256 i, int256 dz, uint256 f) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 fog = _fog(dz);
            // Canyon-facing wall from dz to dz + DEPTH.
            int256 ax = _px(b.x0, dz);
            int256 cx = _px(b.x0, dz + DEPTH);
            Raster.quad(
                p,
                [ax, _py(b.top, dz), cx, _py(b.top, dz + DEPTH), cx, _py(STREET, dz + DEPTH), ax, _py(STREET, dz)],
                WALL * 16 + fog
            );
            // Front face, out to the frame edge.
            {
                int256 y0 = _py(b.top, dz) >> 4;
                int256 y1 = _py(STREET, dz) >> 4;
                if (b.side > 0) Raster.rect(p, ax >> 4, y0, 128, y1, FRONT * 16 + fog);
                else Raster.rect(p, 0, y0, ax >> 4, y1, FRONT * 16 + fog);
            }
            // Windows: lit where the bloom and hash agree; warm or cool from the state root. 30 rows x 5 columns.
            _windows(p, b, dz, fog * 85 / 100);
            _sign(p, e, b, i, dz, fog, f);
            // A horizontal number sign on the front face, legible only close up.
            if (dz < 1300) {
                int256 hx = _px(b.x0 + b.side * 900, dz) >> 4;
                int256 hy = _py(900 + int256(e.hashByte(i, 8)) * 900 / 255, dz) >> 4;
                Raster.number(p, hx, hy, e.number(i), (NEON + b.neon) * 16 + fog * 6 / 10);
            }
            // Every fourth block: a skybridge across the canyon with lights; a monorail crosses some of them.
            if (i % 4 == 0) {
                int256 y = -600 - int256(e.hashByte(i, 9)) * 800 / 255;
                int256 z = dz + 400;
                int256 lx = _px(-CANYON - 300, z) >> 4;
                int256 rx = _px(CANYON + 300, z) >> 4;
                int256 ly = _py(y, z) >> 4;
                int256 th = F16 * 70 / z / 16 + 1; // 0.07 units thick
                Raster.rect(p, lx, ly, rx, ly + th, BRIDGE * 16 + fog);
                for (int256 k; k < 18; ++k) {
                    Raster.dot(p, lx + (rx - lx) * k / 18, ly + th / 3, LAMP * 16 + fog);
                }
                if (e.hashByte(i, 10) & 1 == 1) {
                    int256 run = int256((f * 3 * 255 + uint256(e.hashByte(i, 11)) * FRAMES) % (FRAMES * 255));
                    int256 x = lx + (rx - lx) * (run * 18 / int256(FRAMES * 255) - 4) / 10;
                    int256 w = (rx - lx) * 45 / 100;
                    int256 h = th * 7 / 10 + 1;
                    Raster.rect(p, x, ly - h, x + w, ly, WHITE * 16 + fog);
                    Raster.rect(p, x, ly - h / 3 - 1, x + w, ly - h / 3, (NEON + 1) * 16 + fog);
                }
            }
            // Cables strung across the canyon, sagging.
            if (e.hashByte(i, 12) % 3 == 0) {
                int256 z = dz + 500;
                int256 ax2 = _px(-CANYON, z) >> 4;
                int256 ay = _py(-2000 + int256(e.hashByte(i, 13)) * 1000 / 128, z) >> 4;
                int256 bx = _px(CANYON, z) >> 4;
                int256 by = _py(-2000 + int256(e.hashByte(i, 14)) * 1000 / 128, z) >> 4;
                int256 sag = (ay > by ? ay : by) + 6000 / z;
                int256 px0 = ax2;
                int256 py0 = ay;
                for (int256 s = 1; s <= 6; ++s) {
                    // Quadratic Bezier through the sagging midpoint control.
                    int256 x1 = (ax2 * (6 - s) * (6 - s) + 2 * ((ax2 + bx) / 2) * s * (6 - s) + bx * s * s) / 36;
                    int256 y1 = (ay * (6 - s) * (6 - s) + 2 * sag * s * (6 - s) + by * s * s) / 36;
                    Raster.line(p, px0, py0, x1, y1, BRIDGE * 16 + fog / 2);
                    px0 = x1;
                    py0 = y1;
                }
            }
        }
    }

    function _windows(uint256 p, Building memory b, int256 dz, uint256 wfog) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 lit = b.lit;
            uint256 warm = b.warm;
            int256 x0 = b.x0;
            int256 top = b.top;
            uint256 cw = WARM * 16 + wfog;
            uint256 cc = COOL * 16 + wfog;
            uint256 tall = dz < 1500 ? 1 : 0;
            assembly ("memory-safe") {
                for { let q := 0 } lt(q, 5) { q := add(q, 1) } {
                    let z := add(dz, sdiv(mul(add(mul(q, 10), 3), DEPTH), 50))
                    let wx := sar(4, add(VX16, sdiv(mul(x0, F16), z)))
                    if lt(wx, 128) {
                        let k := q
                        for { let r := 0 } lt(r, 30) { r := add(r, 1) } {
                            if and(shr(k, lit), 1) {
                                let y := add(top, sdiv(mul(add(shl(1, r), 1), sub(STREET, top)), 60))
                                let wy := sar(4, add(VY16, sdiv(mul(y, F16), z)))
                                if lt(wy, 127) {
                                    let c := cc
                                    if and(shr(k, warm), 1) { c := cw }
                                    let a := add(add(p, shl(7, wy)), wx)
                                    mstore8(a, c)
                                    if tall { mstore8(add(a, 128), c) }
                                }
                            }
                            k := add(k, 5)
                        }
                    }
                }
            }
        }
    }

    /// @dev The block's vertical neon sign hanging into the canyon. Close signs draw their glyphs; far ones are a glow.
    function _sign(uint256 p, bytes memory e, Building memory b, uint256 i, int256 dz, uint256 fog, uint256 f)
        internal
        pure
    {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            // Flicker: off for a moment in some signs, from the hash.
            if (
                ((f * 7 * 256 + e.hashByte(i, 6) * FRAMES) % (FRAMES * 256)) * 100
                    < 4 * (e.hashByte(i, 7) % 3) * FRAMES * 256
            ) {
                return;
            }
            int256 z = dz + 80;
            int256 px = _px(b.x0 - b.side * 220, z) >> 4;
            int256 py = _py(-1600 + int256(e.hashByte(i, 4)) * 800 / 255, z) >> 4;
            int256 fs = 15600 / z; // glyph size in px (0.3 units)
            if (fs < 1) fs = 1;
            SceneKit.verticalSign(p, b.word, px, py, fs, NEON + b.neon, fog * 7 / 10);
        }
    }

    /// @dev Flying traffic: streaks along the canyon at several heights; more with fuller blocks.
    function _traffic(uint256 p, bytes memory e, uint256 f) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 cur = (f / 9 + 4) % 10;
            uint256 count = 10 + e.gasBps(cur) / 250;
            for (uint256 k; k < count; ++k) {
                uint256 b = k % 10;
                int256 lane = (int256(e.hashByte(b, k)) - 128) * 1600 / 255;
                int256 alt = -2200 + int256(e.hashByte(b, k + 5)) * 2600 / 255;
                int256 dir = k % 3 == 0 ? -1 : int256(1);
                int256 z = _wrap(int256(e.hashByte(b, k + 9)) * FAR / 255 - dir * int256(f) * FAR / int256(FRAMES), FAR)
                    + NEAR;
                int256 z2 = z + 450 * dir;
                if (z2 < NEAR) z2 = NEAR;
                uint256 c = (dir > 0 ? NEON + 5 : WHITE) * 16 + _fog(z) * 7 / 10;
                Raster.line(p, _px(lane, z) >> 4, _py(alt, z) >> 4, _px(lane, z2) >> 4, _py(alt, z2) >> 4, c);
            }
        }
    }

    /// @dev Foreground: a rooftop ledge and a lone figure looking down the canyon, rim-lit by the haze.
    function _ledge(uint256 p, uint256 f) internal pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            Raster.quad(p, [int256(0), 1597, 860, 1761, 860, 2048, 0, 2048], DARK * 16);
            Raster.line(p, 0, 99, 53, 110, DARK * 16 + 9);
            int256 sway = (f % 45) < 22 ? int256(0) : int256(1);
            // Head, coat lifted by the wind, rim light down the right side.
            Raster.disc(p, 35, 93, 1, DARK * 16);
            Raster.quad(p, [int256(534), 1515, 590, 1515, 626 + sway * 16, 1710, 520 + sway * 16, 1710], DARK * 16);
            Raster.line(p, 36, 92, 37, 95, DARK * 16 + 8);
            Raster.line(p, 37, 95, 39 + sway, 106, DARK * 16 + 8);
        }
    }
}
