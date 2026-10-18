// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Native SVG paths from exactly the AVI's first display frame. No embedded GIF, bitmap or assets.
library AviPoster {
    function svg(bytes memory avi) internal pure returns (bytes memory out) {
        require(avi.length == 1477976, "Unexpected AVI layout");
        bytes memory head =
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='1024' height='1024' shape-rendering='crispEdges' stroke-width='1'>";
        uint256 runs;
        assembly ("memory-safe") {
            let movie := add(avi, 32)
            for { let y := 0 } lt(y, 128) { y := add(y, 1) } {
                let row := add(movie, add(1256, mul(y, 128)))
                runs := add(runs, 1)
                for { let x := 1 } lt(x, 128) { x := add(x, 1) } {
                    if iszero(eq(byte(0, mload(add(row, x))), byte(0, mload(add(row, sub(x, 1)))))) {
                        runs := add(runs, 1)
                    }
                }
            }
        }
        // One short subpath per run, plus at most 256 colour headers.
        out = new bytes(head.length + 16 * runs + 64 * 256 + 6);
        bytes memory nodes = new bytes((runs + 1) * 32);
        uint256[256] memory heads;
        assembly ("memory-safe") {
            function decimal(p, n) -> q {
                q := p
                if gt(n, 99) {
                    mstore8(q, add(48, div(n, 100)))
                    q := add(q, 1)
                }
                if gt(n, 9) {
                    mstore8(q, add(48, mod(div(n, 10), 10)))
                    q := add(q, 1)
                }
                mstore8(q, add(48, mod(n, 10)))
                q := add(q, 1)
            }
            let start := add(out, 32)
            mcopy(start, add(head, 32), mload(head))
            let p := add(start, mload(head))
            let movie := add(avi, 32)
            let hexes := "0123456789abcdef"
            let count := 0
            // Bucket row runs by palette index. Non-overlapping strokes can share one SVG path per colour.
            for { let y := 0 } lt(y, 128) { y := add(y, 1) } {
                let row := add(movie, add(1256, mul(sub(127, y), 128)))
                for { let x := 0 } lt(x, 128) {} {
                    let colour := byte(0, mload(add(row, x)))
                    let end := add(x, 1)
                    for {} and(lt(end, 128), eq(byte(0, mload(add(row, end))), colour)) {} { end := add(end, 1) }
                    count := add(count, 1)
                    let h := add(heads, mul(colour, 32))
                    let node := or(shl(24, mload(h)), or(shl(16, x), or(shl(8, y), sub(end, x))))
                    mstore(add(add(nodes, 32), mul(count, 32)), node)
                    mstore(h, count)
                    x := end
                }
            }
            for { let colour := 0 } lt(colour, 256) { colour := add(colour, 1) } {
                let index := mload(add(heads, mul(colour, 32)))
                if index {
                    mstore(p, "<path stroke='#")
                    p := add(p, 15)
                    let pal := add(movie, add(212, mul(colour, 4)))
                    for { let k := 0 } lt(k, 3) { k := add(k, 1) } {
                        let v := byte(0, mload(add(pal, sub(2, k))))
                        mstore8(p, byte(shr(4, v), hexes))
                        mstore8(add(p, 1), byte(and(v, 15), hexes))
                        p := add(p, 2)
                    }
                    mstore(p, "' d='")
                    p := add(p, 5)
                    for {} index {} {
                        let node := mload(add(add(nodes, 32), mul(index, 32)))
                        mstore8(p, 77)
                        p := decimal(add(p, 1), and(shr(16, node), 255))
                        mstore8(p, 32)
                        p := decimal(add(p, 1), and(shr(8, node), 255))
                        mstore(p, ".5h")
                        p := decimal(add(p, 3), and(node, 255))
                        index := shr(24, node)
                    }
                    mstore(p, "'/>")
                    p := add(p, 3)
                }
            }
            mstore(p, "</svg>")
            p := add(p, 6)
            mstore(out, sub(p, start))
        }
    }
}
