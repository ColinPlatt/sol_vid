// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {GenerativeTraits} from "./GenerativeTraits.sol";
import {AviContainer} from "./AviContainer.sol";
import {Strings} from "../vendor/openzeppelin/Flattened.sol";

/// @notice Lossless RIFF/BI_RLE8 generated on read. Artwork is GHOULBALLS_VAPOR_V3.
contract AviRleVideo is GenerativeTraits {
    using Strings for uint256;

    /// @notice Two seconds, 50 frames. Upscale runs, never the rasterization work.
    function aviFromSeed(uint256 size, uint256 seed) public pure returns (bytes memory out) {
        if (size != 256 && size != 512) revert InvalidSettings();
        uint256 frames = 50;
        uint256 fps = 25;
        uint256 movieSize;
        uint256 scale = size / 64;
        bytes[] memory chunks = new bytes[](frames);
        bytes memory pixels = new bytes(4096);
        bytes memory background = _background(64, sceneForSeed(seed), seed);
        uint256 largest;
        for (uint256 f; f < frames; ++f) {
            _draw(pixels, 64, f, frames, sceneForSeed(seed), seed, background);
            bytes memory chunk = new bytes(size * 130 + 2);
            uint256 p;
            // Each logical row has at most 64 runs: <=128 encoded bytes + EOL.
            // A 512-pixel solid run needs three packets, still below that bound.
            assembly ("memory-safe") {
                let dst := add(chunk, 32)
                for { let yy := 0 } lt(yy, 64) { yy := add(yy, 1) } {
                    let row := add(add(pixels, 32), mul(sub(63, yy), 64))
                    let start := p
                    for { let x := 0 } lt(x, 64) {} {
                        let colour := byte(0, mload(add(row, x)))
                        let end := add(x, 1)
                        for {} and(lt(end, 64), eq(byte(0, mload(add(row, end))), colour)) { end := add(end, 1) } {}
                        let count := mul(sub(end, x), scale)
                        for {} count {} {
                            let run := count
                            if gt(run, 255) { run := 255 }
                            mstore8(add(dst, p), run)
                            mstore8(add(add(dst, p), 1), colour)
                            p := add(p, 2)
                            count := sub(count, run)
                        }
                        x := end
                    }
                    mstore8(add(dst, p), 0)
                    mstore8(add(add(dst, p), 1), 0)
                    p := add(p, 2)
                    let rowBytes := sub(p, start)
                    for { let repeat := 1 } lt(repeat, scale) { repeat := add(repeat, 1) } {
                        mcopy(add(dst, p), add(dst, start), rowBytes)
                        p := add(p, rowBytes)
                    }
                }
                mstore8(add(dst, p), 0)
                mstore8(add(add(dst, p), 1), 1)
                p := add(p, 2)
                mstore(chunk, p)
                // No allocation occurs between chunk creation and here; reclaim its unused capacity.
                mstore(0x40, and(add(add(chunk, p), 63), not(31)))
            }
            chunks[f] = chunk;
            movieSize += 8 + p;
            if (p > largest) largest = p;
        }
        out = new bytes(296 + movieSize + frames * 16);
        AviContainer.header(out, size, fps, frames, movieSize, largest, _palette(sceneForSeed(seed), seed), 1);
        uint256 pos = 288;
        for (uint256 f; f < frames; ++f) {
            _copy(out, pos, bytes("00dc"));
            _le(out, pos + 4, chunks[f].length, 4);
            _copy(out, pos + 8, chunks[f]);
            pos += 8 + chunks[f].length;
        }
        uint256[] memory sizes = new uint256[](frames);
        for (uint256 f; f < frames; ++f) {
            sizes[f] = chunks[f].length;
        }
        AviContainer.index(out, pos, bytes4("00dc"), sizes);
    }

    /// @notice Static, crisp poster from frame zero. No GIF or external assets.
    function posterFromSeed(uint256 seed) external pure returns (string memory) {
        bytes memory pixels = new bytes(4096);
        uint256 scene = sceneForSeed(seed);
        _draw(pixels, 64, 0, 50, scene, seed);
        bytes memory palette = _palette(scene, seed);
        bytes memory output = new bytes(400000);
        uint256 p;
        bytes memory head = bytes(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512" shape-rendering="crispEdges">'
        );
        _copy(output, p, head);
        p += head.length;
        for (uint256 y; y < 64; ++y) {
            for (uint256 x; x < 64;) {
                uint256 c = uint8(pixels[y * 64 + x]);
                uint256 end = x + 1;
                while (end < 64 && uint8(pixels[y * 64 + end]) == c) ++end;
                uint256 colour = uint24(
                    bytes3(palette[3 * c]) | (bytes3(palette[3 * c + 1]) >> 8) | (bytes3(palette[3 * c + 2]) >> 16)
                );
                bytes memory rect = bytes(
                    string.concat(
                        '<path fill="#',
                        _hexColour(colour),
                        '" d="M',
                        x.toString(),
                        " ",
                        y.toString(),
                        "h",
                        (end - x).toString(),
                        "v1H",
                        x.toString(),
                        'z"/>'
                    )
                );
                _copy(output, p, rect);
                p += rect.length;
                x = end;
            }
        }
        _copy(output, p, bytes("</svg>"));
        p += 6;
        assembly ("memory-safe") { mstore(output, p) }
        return string(output);
    }

    function _hexColour(uint256 c) private pure returns (string memory) {
        bytes memory out = new bytes(6);
        bytes memory alphabet = "0123456789abcdef";
        for (uint256 i; i < 6; ++i) {
            out[5 - i] = alphabet[(c >> (i * 4)) & 15];
        }
        return string(out);
    }

    function _copy(bytes memory out, uint256 p, bytes memory value) private pure {
        AviContainer.copy(out, p, value);
    }

    function _le(bytes memory out, uint256 p, uint256 value, uint256 count) private pure {
        AviContainer.le(out, p, value, count);
    }
}
