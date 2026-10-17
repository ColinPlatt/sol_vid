// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Version-two artwork, isolated from the original scene experiments.
abstract contract Vaporwave {
    function _vaporKey(uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("GHOULBALLS_VAPOR_V2", seed)));
    }

    function _vaporPalette(uint256 seed) internal pure returns (bytes memory palette) {
        uint256 key = _vaporKey(seed);
        uint256 theme = (key >> 8) % 4;
        bytes memory sky = bytes(
            theme == 0
                ? hex"08081915102e29134552245c7a3ab0ea5cb4ffbf9ba8fff0"
                : theme == 1
                    ? hex"050e210b183818295a3e3d70327ab0d559c7ffcaad94fff0"
                    : theme == 2
                        ? hex"13091f29113546184176264f9250bcf26d9bffd18cd5b9ff"
                        : hex"160b262c153b55214e9039587e55adff8eb8ffe3a39ef5ed"
        );
        bytes memory neon = hex"65f5e8ff78cf9b8affffc49162b9ffe4a5ff";
        palette = new bytes(48);
        for (uint256 i; i < 24; ++i) {
            palette[i] = sky[i];
        }
        uint256 rotation = (key >> 24) % 6;
        for (uint256 i; i < 18; ++i) {
            palette[24 + i] = neon[(i + rotation * 3) % 18];
        }
        palette[42] = 0x4a;
        palette[43] = 0x37;
        palette[44] = 0x6f;
        palette[45] = 0xf5;
        palette[46] = 0xff;
        palette[47] = 0xf3;
    }

    function _vaporBackdrop(uint256 size, uint256 seed) internal pure returns (bytes memory pixels) {
        uint256 key = _vaporKey(seed);
        pixels = new bytes(size * size);
        assembly ("memory-safe") {
            let shift := and(key, 63)
            let sunX := add(19, mod(shr(32, key), 27))
            let dst := add(pixels, 32)
            for { let yy := 0 } lt(yy, size) { yy := add(yy, 1) } {
                let y := div(mul(yy, 64), size)
                for { let xx := 0 } lt(xx, size) { xx := add(xx, 1) } {
                    let x := div(mul(xx, 64), size)
                    let c := add(1, div(y, 14))
                    let dx := sub(x, sunX)
                    let dy := sub(y, 22)
                    if lt(add(mul(dx, dx), mul(dy, dy)), 100) {
                        c := 6
                        if and(gt(y, 22), lt(mod(y, 4), 2)) { c := 3 }
                    }
                    if and(lt(y, 29), iszero(mod(add(add(mul(x, 73), mul(y, 37)), shift), 211))) { c := 7 }
                    // Low silhouetted mountains against the horizon.
                    let ridge := mod(add(x, shift), 32)
                    if gt(ridge, 16) { ridge := sub(32, ridge) }
                    if and(gt(y, sub(39, div(ridge, 3))), lt(y, 41)) { c := 0 }
                    if gt(y, 40) {
                        c := 0
                        let depth := sub(y, 40)
                        let distance := sub(x, 32)
                        if lt(x, 32) { distance := sub(32, x) }
                        if lt(mod(mul(distance, 16), add(depth, 4)), 2) { c := 4 }
                    }
                    mstore8(add(dst, add(mul(yy, size), xx)), c)
                }
            }
        }
    }

    function _drawVapor(
        bytes memory pixels,
        uint256 size,
        uint256 f,
        uint256 frames,
        uint256 scene,
        uint256 seed,
        bytes memory background
    ) internal pure {
        uint256 key = _vaporKey(seed);
        assembly ("memory-safe") {
            function bounce(start, offset, span) -> value {
                let p := mod(add(start, offset), mul(span, 2))
                value := p
                if gt(p, span) { value := sub(mul(span, 2), p) }
            }
            // Signed smooth periodic curve, +/-1024. Integer parabolic sine approximation.
            function wave(t) -> value {
                t := mod(t, 128)
                let p := mod(t, 64)
                value := mul(p, sub(64, p))
                if gt(t, 63) { value := sub(0, value) }
            }
            let phase := mod(div(mul(f, 128), frames), 128)
            let scroll := div(phase, 2)
            let dst := add(pixels, 32)
            mcopy(dst, add(background, 32), mload(pixels))
            // Only the floor's travelling scanlines change behind the balls.
            for { let yy := 0 } lt(yy, size) { yy := add(yy, 1) } {
                let y := div(mul(yy, 64), size)
                if gt(y, 40) {
                    let depth := sub(y, 40)
                    if lt(mod(add(mul(depth, depth), mul(scroll, 4)), 64), 4) {
                        let row := add(dst, mul(yy, size))
                        for { let xx := 0 } lt(xx, size) { xx := add(xx, 1) } { mstore8(add(row, xx), 5) }
                    }
                }
            }
            let count := 1
            switch scene
            case 8 { count := 2 }
            case 9 { count := 4 }
            case 10 { count := 6 }
            let style := mod(shr(16, key), 4)
            for { let ball := 0 } lt(ball, count) { ball := add(ball, 1) } {
                mstore(0, seed)
                mstore(32, ball)
                let hash := keccak256(0, 64)
                let radius := add(5, mod(shr(24, hash), 6))
                let span := sub(63, mul(radius, 2))
                let period := mul(span, 2)
                let startX := mod(shr(40, hash), period)
                let startY := mod(shr(72, hash), period)
                let offset := div(mul(period, mod(f, frames)), frames)
                let cx := add(radius, bounce(startX, offset, span))
                let cy := add(radius, bounce(startY, offset, span))
                let t := add(phase, mod(shr(104, hash), 128))
                switch style
                case 1 {
                    cx := add(32, sdiv(mul(wave(t), sub(25, radius)), 1024))
                    cy := add(30, sdiv(mul(wave(add(t, 32)), sub(23, radius)), 1024))
                }
                case 2 { cy := add(30, sdiv(mul(wave(t), sub(17, radius)), 1024)) }
                case 3 {
                    cx := add(32, sdiv(mul(wave(t), sub(25, radius)), 1024))
                    cy := add(31, sdiv(mul(wave(add(mul(t, 2), startY)), sub(23, radius)), 1024))
                }
                let x0 := div(add(mul(sub(cx, radius), size), 63), 64)
                let x1 := div(add(mul(add(add(cx, radius), 1), size), 63), 64)
                let y0 := div(add(mul(sub(cy, radius), size), 63), 64)
                let y1 := div(add(mul(add(add(cy, radius), 1), size), 63), 64)
                let rr := mul(radius, radius)
                for { let yy := y0 } lt(yy, y1) { yy := add(yy, 1) } {
                    let dy := sub(div(mul(yy, 64), size), cy)
                    let row := add(dst, mul(yy, size))
                    for { let xx := x0 } lt(xx, x1) { xx := add(xx, 1) } {
                        let dx := sub(div(mul(xx, 64), size), cx)
                        if iszero(gt(add(mul(dx, dx), mul(dy, dy)), rr)) {
                            let c := add(8, ball)
                            if and(sgt(dy, div(radius, 3)), sgt(dx, 0)) { c := 14 }
                            let hx := add(dx, div(radius, 3))
                            let hy := add(dy, div(radius, 3))
                            if lt(add(mul(hx, hx), mul(hy, hy)), div(rr, 9)) { c := 15 }
                            mstore8(add(row, xx), c)
                        }
                    }
                }
            }
        }
    }
}
