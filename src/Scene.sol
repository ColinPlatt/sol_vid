// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

abstract contract Scene {
    error InvalidSettings();

    // Default sixteen RGB colours. All formats share a palette; every rendered index is <16.
    bytes internal constant PALETTE =
        hex"0b081814102b24183d382052573369845078bd629fff82c6ffe6ab69f5e2" hex"32b9c56576c22c4979402957b7bed8ffffff";

    /// @dev Scenes 3..6 are Ghoul Balls with 1, 2, 4 and 6 circles respectively.
    function _palette(uint256 scene, uint256 seed) internal pure returns (bytes memory palette) {
        if (scene < 3) return PALETTE;
        palette = new bytes(48); // index zero is opaque black
        for (uint256 i; i < 6; ++i) {
            uint256 hash = uint256(keccak256(abi.encode(seed, i)));
            for (uint256 channel; channel < 3; ++channel) {
                palette[3 * (i + 1) + channel] = bytes1(uint8(64 + ((hash >> (8 * channel)) % 192)));
            }
        }
    }

    /// @dev All animation is integer math on a logical 64x64 canvas.
    /// Scenes 0..2: road, orb, interference. Scenes 3..6: 1, 2, 4 or 6 Ghoul Balls.
    function _draw(bytes memory pixels, uint256 size, uint256 f, uint256 frames, uint256 scene, uint256 seed)
        internal
        pure
    {
        if (scene >= 3) {
            _drawBalls(pixels, size, f, frames, scene, seed);
            return;
        }
        assembly ("memory-safe") {
            let phase := div(mul(f, 64), frames)
            let shift := and(seed, 63)
            let cx := add(12, div(mul(phase, 40), 64))
            let bounce := mod(mul(phase, 2), 64)
            if gt(bounce, 32) { bounce := sub(64, bounce) }
            let cy := sub(45, div(mul(bounce, sub(64, bounce)), 48))
            let dst := add(pixels, 32)
            for { let yy := 0 } lt(yy, size) { yy := add(yy, 1) } {
                let y := div(mul(yy, 64), size)
                for { let xx := 0 } lt(xx, size) { xx := add(xx, 1) } {
                    let x := div(mul(xx, 64), size)
                    let c := 0
                    switch scene
                    case 0 {
                        c := add(1, div(y, 12))
                        let dx := sub(x, 32)
                        let dy := sub(y, 22)
                        if lt(add(mul(dx, dx), mul(dy, dy)), 121) {
                            c := 8
                            if and(gt(y, 22), lt(mod(y, 4), 2)) { c := 3 }
                        }
                        // Deterministic sparse stars, drifting one complete period per loop.
                        if and(lt(y, 25), iszero(mod(add(add(mul(x, 73), mul(y, 37)), shift), 211))) {
                            c := add(9, mod(add(phase, x), 3))
                        }
                        if gt(y, 34) {
                            c := 0
                            let depth := sub(y, 34)
                            if lt(mod(add(mul(depth, depth), mul(phase, 4)), 64), 5) { c := 6 }
                            let distance := sub(x, 32)
                            if lt(x, 32) { distance := sub(32, x) }
                            if iszero(mod(mul(distance, 12), add(depth, 4))) { c := 5 }
                            if and(lt(distance, 1), lt(mod(add(y, phase), 16), 8)) { c := 9 }
                        }
                    }
                    case 1 {
                        c := 1
                        if gt(y, 51) {
                            c := 2
                            if or(iszero(mod(x, 8)), iszero(mod(y, 4))) { c := 4 }
                        }
                        if and(lt(y, 49), iszero(mod(add(add(mul(x, 31), mul(y, 71)), shift), 197))) { c := 14 }
                        let dx := sub(x, cx)
                        let dy := sub(y, cy)
                        if lt(add(mul(dx, dx), mul(dy, dy)), 81) {
                            c := 10
                            if lt(x, cx) { c := 9 }
                            if gt(y, cy) { c := 11 }
                            let hx := sub(x, sub(cx, 3))
                            let hy := sub(y, sub(cy, 3))
                            if lt(add(mul(hx, hx), mul(hy, hy)), 7) { c := 15 }
                        }
                    }
                    default { c := and(shr(2, xor(add(x, phase), add(y, shift))), 15) }
                    mstore8(dst, c)
                    dst := add(dst, 1)
                }
            }
        }
    }

    function _drawBalls(bytes memory pixels, uint256 size, uint256 f, uint256 frames, uint256 scene, uint256 seed)
        private
        pure
    {
        assembly ("memory-safe") {
            function bounce(start, offset, span) -> value {
                let phase := mod(add(start, offset), mul(span, 2))
                if gt(phase, span) { phase := sub(mul(span, 2), phase) }
                value := phase
            }
            let dst := add(pixels, 32)
            // Reuse the frame allocation while clearing the previous frame.
            for { let p := 0 } lt(p, mload(pixels)) { p := add(p, 32) } { mstore(add(dst, p), 0) }
            let count := 1
            switch scene
            case 4 { count := 2 }
            case 5 { count := 4 }
            case 6 { count := 6 }
            for { let ball := 0 } lt(ball, count) { ball := add(ball, 1) } {
                mstore(0, seed)
                mstore(32, ball)
                let hash := keccak256(0, 64)
                let radius := add(9, mod(shr(24, hash), 7))
                let span := sub(63, mul(radius, 2))
                let offset := div(mul(mul(span, 2), f), frames)
                let cx := add(radius, bounce(mod(shr(40, hash), mul(span, 2)), offset, span))
                let cy := add(radius, bounce(mod(shr(72, hash), mul(span, 2)), offset, span))
                let x0 := div(add(mul(sub(cx, radius), size), 63), 64)
                let x1 := div(add(mul(add(add(cx, radius), 1), size), 63), 64)
                let y0 := div(add(mul(sub(cy, radius), size), 63), 64)
                let y1 := div(add(mul(add(add(cy, radius), 1), size), 63), 64)
                let rr := mul(radius, radius)
                for { let yy := y0 } lt(yy, y1) { yy := add(yy, 1) } {
                    let dy := sub(div(mul(yy, 64), size), cy)
                    let dy2 := mul(dy, dy)
                    let row := add(dst, mul(yy, size))
                    for { let xx := x0 } lt(xx, x1) { xx := add(xx, 1) } {
                        let dx := sub(div(mul(xx, 64), size), cx)
                        if iszero(gt(add(mul(dx, dx), dy2), rr)) { mstore8(add(row, xx), add(ball, 1)) }
                    }
                }
            }
        }
    }
}
