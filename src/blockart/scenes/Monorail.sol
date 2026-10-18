// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Raster} from "../Raster.sol";
import {Glyphs} from "../Glyphs.sol";
import {Epoch} from "../Epoch.sol";
import {SceneBase, SceneKit} from "../SceneBase.sol";

/// @notice 高架 MONORAIL: riding an elevated monorail through the megacity canyon under a sodium-orange haze. The track
///         bends gently once per loop; each block is a pair of towers with its neon sign; every fifth block is a
///         station with its word and number; oncoming trains pass on the parallel beam; the cab console shows the
///         next station and the speed (from gas).
/// @dev Port of concepts/neo-tokyo/monorail.js. Milli-units, one unit per block, 10 units per loop.
contract Monorail is SceneBase {
    using Epoch for bytes;

    int256 private constant N = 10000; // loop length
    int256 private constant NEAR = 300;
    int256 private constant FAR = 9700;
    int256 private constant F16 = 864; // focal 54 px
    int256 private constant VX16 = 1024;
    int256 private constant VY16 = 942; // 0.46 * 128 px
    int256 private constant BEAM_TOP = 550;
    int256 private constant BEAM_BOTTOM = 1000;
    int256 private constant HALF = 200;
    int256 private constant ONCOMING = 1050;

    uint256 private constant TOWER = 1;
    uint256 private constant SIDE = 2;
    uint256 private constant TOP = 3;
    uint256 private constant PYLON = 4;
    uint256 private constant NEON = 5;
    uint256 private constant WARM = 11;
    uint256 private constant WHITE = 13;
    uint256 private constant RAIN = 14;
    uint256 private constant DARK = 15;

    function _palette(bytes memory) internal pure override returns (bytes memory) {
        return SceneKit.palette(
            [uint24(0), 0x0e0a1c, 0x161220, 0x4e4658, 0x1e1a28, 0, 0, 0, 0, 0, 0, 0xffc896, 0, 0, 0xc8d7ff, 0x06060c],
            0x241246,
            0x3c4050,
            hex"04061209081b0f0a23140c2c190e351f103d2412464a2046702e46963c46b95046dc6446ff7846ff9b5fffbe78ffe4be",
            hex"5a2828411d2128121a200f17180b151008120f08110e07100c060f0b060e0a060d09050c08040b06040a050409040308"
        );
    }

    /// @dev Sky with the sodium haze on the horizon, and the dark canyon floor below it.
    function _backdrop(uint256 p, bytes memory) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            SceneKit.sky(p, 0, 96, 59, 96, 64, 59, 54, 9);
            assembly ("memory-safe") {
                let bayer := 0x000802100c040e06030b01090f070d05
                for { let y := 60 } lt(y, 128) { y := add(y, 1) } {
                    // Floor ramp (12): shade 0 at the horizon, 2 by y 68, then on to 15 at the bottom (1/16 shades).
                    let v := div(mul(sub(y, 60), 32), 8)
                    if gt(y, 68) { v := add(32, div(mul(sub(y, 68), 208), 59)) }
                    for { let x := 0 } lt(x, 128) { x := add(x, 1) } {
                        let s := shr(4, add(v, byte(add(add(16, shl(2, and(y, 3))), and(x, 3)), bayer)))
                        if gt(s, 15) { s := 15 }
                        mstore8(add(add(p, shl(7, y)), x), add(192, s))
                    }
                }
            }
        }
    }

    /// @dev Per block: windows lit (bit r*4+q for the left tower, +52 for the right) and warm masks.
    function _prepare(bytes memory e) internal pure override returns (uint256[] memory st) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            st = new uint256[](20);
            for (uint256 i; i < 10; ++i) {
                uint256 lit;
                uint256 warm;
                for (uint256 s; s < 2; ++s) {
                    for (uint256 k; k < 52; ++k) {
                        uint256 kk = k + s * 200;
                        if (e.bloomBit(i, kk * 3 + i) && e.hashBit(i, kk)) lit |= 1 << (k + s * 52);
                        if (e.stateByte(i, kk % 32) & 1 == 1) warm |= 1 << (k + s * 52);
                    }
                }
                st[i * 2] = lit;
                st[i * 2 + 1] = warm;
            }
        }
    }

    function _px(int256 x, int256 dz) private pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return VX16 + x * F16 / dz;
        }
    }

    function _py(int256 y, int256 dz) private pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return VY16 + y * F16 / dz;
        }
    }

    /// @dev Lateral offset of the track at depth dz: one gentle bend per loop, zero at the camera.
    function _curve(int256 dz, int256 camZ) private pure returns (int256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return 300 * (SceneKit.sin((dz + camZ) * 1024 / N) - SceneKit.sin(camZ * 1024 / N)) / 1024;
        }
    }

    function _fogAt(int256 dz) private pure returns (uint256) {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            return SceneKit.fog(dz, NEAR, FAR);
        }
    }

    function _draw(uint256 p, bytes memory e, uint256[] memory st, uint256 f) internal pure override {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 camZ = int256(f) * N / int256(SceneKit.FRAMES);
            _street(p, f, camZ);
            int256[10] memory dzs;
            uint256[10] memory order;
            for (uint256 i; i < 10; ++i) {
                int256 dz = SceneKit.wrap(int256(i) * 1000 - camZ, N) + NEAR;
                uint256 j = i;
                while (j > 0 && dzs[j - 1] < dz) {
                    dzs[j] = dzs[j - 1];
                    order[j] = order[j - 1];
                    --j;
                }
                dzs[j] = dz;
                order[j] = i;
            }
            for (uint256 k; k < 10; ++k) {
                if (dzs[k] < FAR) _block(p, e, st, order[k], dzs[k], camZ, f);
            }
            // The stretch from the camera to the nearest block.
            _beam(p, 160, dzs[9], ONCOMING, camZ);
            _beam(p, 160, dzs[9], 0, camZ);
            _trains(p, f, camZ);
            SceneKit.hologram(p, e, SceneKit.turn(f, 300), 64, 6);
            _cab(p, e, f);
            SceneKit.rain(p, e, f, 50, -2, RAIN * 16 + 7);
        }
    }

    /// @dev The street far below: streams of traffic toward the haze.
    function _street(uint256 p, uint256 f, int256 camZ) private pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (uint256 k; k < 50; ++k) {
                int256 dir = k % 2 == 1 ? int256(1) : -1;
                int256 dz = SceneKit.wrap(
                    int256(k) * 530 + dir * int256(f) * (FAR - NEAR) / int256(SceneKit.FRAMES), FAR - NEAR
                ) + NEAR;
                int256 x = _curve(dz, camZ) + (int256(k % 6) * 2 - 5) * 175;
                Raster.dot(
                    p, _px(x, dz) >> 4, _py(4200, dz) >> 4, (dir > 0 ? NEON + 5 : WHITE) * 16 + _fogAt(dz) * 7 / 10
                );
            }
        }
    }

    function _block(uint256 p, bytes memory e, uint256[] memory st, uint256 i, int256 dz, int256 camZ, uint256 f)
        private
        pure
    {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 fog = _fogAt(dz);
            int256 cx = _curve(dz, camZ);
            int256 signSide = e.hashByte(i, 0) & 1 == 1 ? int256(1) : -1;
            int256 top =
                -2000 - int256(e.gasBps(i) * 2 > 6000 ? 6000 : e.gasBps(i) * 2) - int256(e.hashByte(i, 3)) * 2000 / 255;
            for (int256 s = -1; s <= 1; s += 2) {
                int256 x0 = cx + s * (1600 + int256(e.hashByte(i, s > 0 ? 2 : 1)) * 800 / 255);
                int256 ax = _px(x0, dz) >> 4;
                int256 ay = _py(top, dz) >> 4;
                int256 by = _py(4000, dz) >> 4;
                if (s > 0) Raster.rect(p, ax, ay, 128, by, TOWER * 16 + fog);
                else Raster.rect(p, 0, ay, ax, by, TOWER * 16 + fog);
                // Rooftop edge light against the haze.
                if (s > 0) {
                    Raster.rect(p, ax, ay, 128, ay + 1, (NEON + e.neon(i)) * 16 + (fog + 4 > 15 ? 15 : fog + 4));
                } else {
                    Raster.rect(p, 0, ay, ax, ay + 1, (NEON + e.neon(i)) * 16 + (fog + 4 > 15 ? 15 : fog + 4));
                }
                _windows(p, st[i * 2], st[i * 2 + 1], s, x0, top, dz, fog * 8 / 10);
                if (s == signSide) {
                    int256 fs = 16200 / dz;
                    SceneKit.verticalSign(
                        p,
                        e.word(i),
                        _px(x0 - s * 120, dz) >> 4,
                        _py(-1400, dz) >> 4,
                        fs < 1 ? int256(1) : fs,
                        NEON + e.neon(i),
                        fog * 6 / 10
                    );
                }
            }
            // T-shaped pylon under both guideways.
            {
                int256 lx = _px(cx - HALF, dz) >> 4;
                int256 rx = _px(cx + ONCOMING + HALF, dz) >> 4;
                int256 ty = _py(BEAM_BOTTOM, dz) >> 4;
                int256 th = F16 * 120 / dz / 16 + 1;
                Raster.rect(p, lx, ty, rx, ty + th, PYLON * 16 + fog);
                int256 mx = _px(cx + ONCOMING / 2, dz) >> 4;
                int256 pw = F16 * 110 / dz / 16 + 1;
                Raster.rect(
                    p, mx - pw, ty + th, mx + pw, _py(4200, dz) >> 4, PYLON * 16 + (fog + 1 > 15 ? 15 : fog + 1)
                );
            }
            _beam(p, dz, dz + 1000, ONCOMING, camZ);
            _beam(p, dz, dz + 1000, 0, camZ);
            if (i % 5 == 0) _station(p, e, i, dz, cx, fog);
            f;
        }
    }

    function _windows(uint256 p, uint256 lit, uint256 warm, int256 s, int256 x0, int256 top, int256 dz, uint256 wfog)
        private
        pure
    {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            uint256 base = s > 0 ? 52 : 0;
            int256 ww = F16 * 80 / dz / 16; // window width in px
            for (uint256 q; q < 4; ++q) {
                int256 wx = _px(x0 + s * (200 + int256(q) * 600), dz) >> 4;
                if (wx < 0 || wx >= 128) continue;
                for (uint256 r; r < 13; ++r) {
                    uint256 k = base + r * 4 + q;
                    if ((lit >> k) & 1 == 0) continue;
                    int256 wy = _py(top + (int256(r) * 2 + 1) * (4000 - top) / 26, dz) >> 4;
                    uint256 c = ((warm >> k) & 1 == 1 ? WARM : NEON + 1) * 16 + wfog;
                    Raster.rect(p, wx, wy, wx + ww + 1, wy + ww / 2 + 1, c);
                }
            }
        }
    }

    /// @dev A stretch of guideway from z0 to z1 in two steps: side face toward the view axis, then the top, then
    ///      reflective markers every quarter unit (fixed to the beam, so they stream past).
    function _beam(uint256 p, int256 z0, int256 z1, int256 offset, int256 camZ) private pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 zm = (z0 + z1) / 2;
            for (uint256 k; k < 2; ++k) {
                int256 za = k == 0 ? zm : z0;
                int256 zb = k == 0 ? z1 : zm;
                if (za > FAR) continue;
                uint256 fog = _fogAt(za);
                int256 ca = _curve(za, camZ) + offset;
                int256 cb = _curve(zb, camZ) + offset;
                int256 sd = ca > 0 ? -HALF : HALF;
                Raster.quad(
                    p,
                    [
                        _px(ca + sd, za),
                        _py(BEAM_TOP, za),
                        _px(cb + sd, zb),
                        _py(BEAM_TOP, zb),
                        _px(cb + sd, zb),
                        _py(BEAM_BOTTOM, zb),
                        _px(ca + sd, za),
                        _py(BEAM_BOTTOM, za)
                    ],
                    SIDE * 16 + fog
                );
                Raster.quad(
                    p,
                    [
                        _px(ca - HALF, za),
                        _py(BEAM_TOP, za),
                        _px(ca + HALF, za),
                        _py(BEAM_TOP, za),
                        _px(cb + HALF, zb),
                        _py(BEAM_TOP, zb),
                        _px(cb - HALF, zb),
                        _py(BEAM_TOP, zb)
                    ],
                    TOP * 16 + fog
                );
            }
            uint256 mc = offset == 0 ? WARM * 16 : (NEON + 5) * 16;
            for (int256 z = ((z0 + camZ) / 250 + 1) * 250 - camZ; z < z1 && z < FAR; z += 250) {
                Raster.dot(p, _px(_curve(z, camZ) + offset, z) >> 4, _py(BEAM_TOP, z) >> 4, mc + _fogAt(z) * 8 / 10);
            }
        }
    }

    /// @dev Station: platform and canopy across the line, and a white sign with "<word>駅" and the block number.
    function _station(uint256 p, bytes memory e, uint256 i, int256 dz, int256 cx, uint256 fog) private pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            int256 x0 = _px(cx - 1300, dz) >> 4;
            int256 x1 = _px(cx + 1300, dz) >> 4;
            int256 ps = F16 * 1000 / dz / 16; // px per unit
            int256 py = _py(350, dz) >> 4;
            int256 cy = _py(-900, dz) >> 4;
            Raster.rect(p, x0, py, x1, py + ps / 20 + 1, PYLON * 16 + (fog > 2 ? fog - 2 : 0));
            Raster.rect(p, x0, cy, x1, cy + ps / 16 + 1, DARK * 16 + 2);
            Raster.rect(p, x0, cy + ps / 16 + 1, x1, cy + ps / 16 + 2, WHITE * 16 + fog);
            if (ps < 24) return;
            // The sign: word + 駅 in 8 px glyphs on a white plate, the number below in the small font.
            (uint256 len, uint256 ix) = Glyphs.word(e.word(i));
            int256 mid = (x0 + x1) / 2;
            int256 w = int256(len + 1) * 8 + 4;
            Raster.rect(
                p,
                mid - 22 > mid - w / 2 ? mid - w / 2 : mid - 22,
                cy - 18,
                mid + 22 > mid + w / 2 ? mid + 22 : mid + w / 2,
                cy - 1,
                WHITE * 16
            );
            bytes memory table = Glyphs.TABLE;
            int256 gx = mid - int256(len + 1) * 4;
            for (uint256 k; k < len; ++k) {
                uint256 g = (ix >> (8 * k)) & 0xff;
                if (g == Glyphs.COUNT - 1) g = 25; // upright ー back to horizontal
                Raster.glyph(p, gx + int256(k) * 8, cy - 17, Glyphs.bits(table, g), 1, DARK * 16 + 1);
            }
            Raster.glyph(
                p, gx + int256(len) * 8, cy - 17, Glyphs.bits(table, uint8(Glyphs.STATION[0])), 1, DARK * 16 + 1
            );
            Raster.number(p, mid, cy - 8, e.number(i), DARK * 16 + 1);
        }
    }

    /// @dev Oncoming trains: eight cars each on the parallel beam; two pass per loop.
    function _trains(uint256 p, uint256 f, int256 camZ) private pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            for (uint256 t; t < 2; ++t) {
                uint256 life = (f * 2 + t * 45) % 90; // in 1/90 of a pass
                int256 front = (FAR - NEAR) * int256(90 - life) / 90 + NEAR;
                for (uint256 k = 8; k > 0; --k) {
                    int256 za = front + int256(k - 1) * 1500;
                    int256 zb = za + 1500;
                    if (za > FAR) continue;
                    uint256 fog = _fogAt(za);
                    int256 ca = _curve(za, camZ) + ONCOMING;
                    int256 cb = _curve(zb, camZ) + ONCOMING;
                    int256 sd = ca > 0 ? -220 : int256(220);
                    int256[8] memory body = [
                        _px(ca + sd, za),
                        _py(BEAM_TOP - 420, za),
                        _px(cb + sd, zb),
                        _py(BEAM_TOP - 420, zb),
                        _px(cb + sd, zb),
                        _py(BEAM_TOP, zb),
                        _px(ca + sd, za),
                        _py(BEAM_TOP, za)
                    ];
                    Raster.quad(p, body, WHITE * 16 + (fog + 1 > 15 ? 15 : fog + 1));
                    // Window band: 20%-45% of the body height.
                    body[1] = _py(BEAM_TOP - 336, za);
                    body[3] = _py(BEAM_TOP - 336, zb);
                    body[5] = _py(BEAM_TOP - 231, zb);
                    body[7] = _py(BEAM_TOP - 231, za);
                    Raster.quad(p, body, WARM * 16 + fog * 8 / 10);
                }
                if (front > FAR) continue;
                uint256 ff = _fogAt(front);
                int256 c = _curve(front, camZ) + ONCOMING;
                int256 x = _px(c - 220, front) >> 4;
                int256 x2 = _px(c + 220, front) >> 4;
                int256 y = _py(BEAM_TOP - 420, front) >> 4;
                int256 s = F16 * 1000 / front / 16;
                Raster.rect(p, x, y, x2 + 1, y + s * 42 / 100 + 1, WHITE * 16 + ff);
                Raster.rect(p, x, y + s / 5, x2 + 1, y + s / 5 + 1, (NEON + 1) * 16 + ff);
                int256 hy = y + s * 32 / 100;
                int256 r = s / 28;
                Raster.disc(p, x + (x2 - x) / 5, hy, r, WARM * 16 + ff / 2);
                Raster.disc(p, x2 - (x2 - x) / 5, hy, r, WARM * 16 + ff / 2);
            }
        }
    }

    /// @dev Cab: windscreen frame and the console (次の駅 #number; speed from gas, km/h).
    function _cab(uint256 p, bytes memory e, uint256 f) private pure {
        unchecked { // Frame, hash and geometry bounds are documented in SceneBase/scene constants.

            Raster.rect(p, 0, 110, 128, 128, DARK * 16);
            Raster.rect(p, 0, 0, 5, 110, DARK * 16);
            Raster.rect(p, 123, 0, 128, 110, DARK * 16);
            bytes memory table = Glyphs.TABLE;
            bytes memory next = Glyphs.NEXT_STATION;
            uint256 amber = (NEON + 3) * 16;
            for (uint256 k; k < 3; ++k) {
                Raster.glyph(p, 8 + int256(k) * 8, 115, Glyphs.bits(table, uint8(next[k])), 1, amber);
            }
            uint256 station = ((f / 9) / 5 * 5 + 5) % 10;
            Raster.number(p, 56, 117, e.number(station), amber);
            uint256 speed = 80 + e.gasBps(SceneKit.turn(f, 300)) * 4 / 100;
            int256 x = 102;
            for (uint256 d = 100; d > 0; d /= 10) {
                if (speed >= d || d == 1) Raster.small(p, x, 117, (speed / d) % 10, amber);
                x += 4;
            }
        }
    }
}
