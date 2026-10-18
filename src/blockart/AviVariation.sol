// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {VideoRecipe} from "./VideoRecipe.sol";

/// @notice Lossless index frames with a versioned palette and cyclic forward/reverse playback.
library AviVariation {
    uint256 internal constant START = 1256;
    uint256 internal constant STRIDE = 16392;

    function remix(bytes memory avi, VideoRecipe.Recipe memory r, uint256 scene) internal pure returns (bytes memory) {
        require(avi.length == 1477976, "Unexpected AVI layout");
        for (uint256 i; i < 256; ++i) {
            uint256 p = 212 + i * 4;
            uint256 red = uint8(avi[p + 2]);
            uint256 green = uint8(avi[p + 1]);
            uint256 blue = uint8(avi[p]);
            // Six channel permutations retain individual channel detail and every palette index.
            uint256 a;
            uint256 b;
            uint256 c;
            if (r.colourway == 0) (a, b, c) = (red, green, blue);
            else if (r.colourway == 1) (a, b, c) = (blue, red, green);
            else if (r.colourway == 2) (a, b, c) = (green, blue, red);
            else if (r.colourway == 3) (a, b, c) = (green, red, blue);
            else if (r.colourway == 4) (a, b, c) = (blue, green, red);
            else (a, b, c) = (red, blue, green);
            if (r.light == 1) {
                a = a * 7 / 8;
                b = b * 7 / 8;
                c = c * 7 / 8;
            }
            if (r.light == 2) {
                a = 18 + a * 237 / 255;
                b = 18 + b * 237 / 255;
                c = 18 + c * 237 / 255;
            }
            avi[p + 2] = bytes1(uint8(a));
            avi[p + 1] = bytes1(uint8(b));
            avi[p] = bytes1(uint8(c));
        }
        // Permute in place by cycles, keeping only one 16 KiB frame alive instead of a second entire movie.
        bytes memory scratch = new bytes(16384);
        uint256 visited;
        for (uint256 first; first < 90; ++first) {
            if ((visited >> first) & 1 == 1) continue;
            assembly ("memory-safe") {
                mcopy(add(scratch, 32), add(add(avi, 32), add(1256, mul(first, 16392))), 16384)
            }
            uint256 current = first;
            while (true) {
                visited |= 1 << current;
                uint256 next = (r.phase + (r.reverse ? 90 - current : current)) % 90;
                if (next == first) {
                    assembly ("memory-safe") {
                        mcopy(add(add(avi, 32), add(1256, mul(current, 16392))), add(scratch, 32), 16384)
                    }
                    break;
                }
                assembly ("memory-safe") {
                    mcopy(
                        add(add(avi, 32), add(1256, mul(current, 16392))),
                        add(add(avi, 32), add(1256, mul(next, 16392))),
                        16384
                    )
                }
                current = next;
            }
        }
        // Legacy templates label synthetic drawing intensity as gas %. Replace that row with decorative
        // colour chips; only genuine captured block fields are presented as measurements in V2 metadata.
        if (scene < 6) {
            uint256 top = scene == 2 ? 22 : 19;
            assembly ("memory-safe") {
                for { let f := 0 } lt(f, 90) { f := add(f, 1) } {
                    let frame := add(add(avi, 32), add(1256, mul(f, 16392)))
                    for { let y := top } lt(y, add(top, 11)) { y := add(y, 1) } {
                        let row := add(frame, mul(sub(127, y), 128))
                        for { let x := 39 } lt(x, 89) { x := add(x, 1) } { mstore8(add(row, x), 240) }
                    }
                }
            }
            for (uint256 f; f < 90; ++f) {
                for (uint256 chip; chip < 6; ++chip) {
                    uint256 colour = (5 + (r.colourway + chip) % 6) * 16 + r.light * 3;
                    for (uint256 y = top + 4; y < top + 7; ++y) {
                        uint256 offset = 1256 + f * 16392 + (127 - y) * 128 + 42 + chip * 7;
                        assembly ("memory-safe") {
                            let p := add(add(avi, 32), offset)
                            mstore8(p, colour)
                            mstore8(add(p, 1), colour)
                            mstore8(add(p, 2), colour)
                            mstore8(add(p, 3), colour)
                        }
                    }
                }
            }
        }
        return avi;
    }
}
