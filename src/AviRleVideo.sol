// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Scene} from "./Scene.sol";
import {Strings} from "../vendor/openzeppelin/Flattened.sol";

/// @notice Lossless RIFF/BI_RLE8 generated on read. Artwork is GHOULBALLS_VAPOR_V3.
contract AviRleVideo is Scene {
    using Strings for uint256;

    struct Ball {
        uint256 radius;
        uint256 xPhase;
        uint256 yPhase;
        bytes3 colour;
    }

    struct Recipe {
        uint256 seed;
        uint256 scene;
        uint256 ballCount;
        bytes palette;
        Ball[] balls;
        uint256 theme;
        uint256 motion;
    }

    /// @notice Versioned deterministic selection; four equally sized hash buckets.
    /// @dev This is artwork variation, not an unpredictable randomness source.
    function sceneForSeed(uint256 seed) public pure returns (uint256) {
        return 7 + _vaporKey(seed) % 4;
    }

    function themeName(uint256 theme) public pure returns (string memory) {
        if (theme == 0) return "Midnight";
        if (theme == 1) return "Lagoon";
        if (theme == 2) return "Ultraviolet";
        if (theme == 3) return "Sunset";
        revert InvalidSettings();
    }

    function motionName(uint256 motion) public pure returns (string memory) {
        if (motion == 0) return "Ricochet";
        if (motion == 1) return "Orbit";
        if (motion == 2) return "Float";
        if (motion == 3) return "Figure Eight";
        revert InvalidSettings();
    }

    /// @notice Inspectable traits for metadata or reproducing the animation.
    /// @dev xPhase/yPhase parameterize reflected motion; curved styles use the same ball hash.
    ///      The versioned recipe, seed and motion identify the complete path.
    function recipe(uint256 seed) external pure returns (Recipe memory r) {
        r.seed = seed;
        r.scene = sceneForSeed(seed);
        r.ballCount = r.scene == 7 ? 1 : r.scene == 8 ? 2 : r.scene == 9 ? 4 : 6;
        r.theme = (_vaporKey(seed) >> 8) % 4;
        r.motion = (_vaporKey(seed) >> 16) % 4;
        r.palette = _palette(r.scene, seed);
        r.balls = new Ball[](r.ballCount);
        for (uint256 i; i < r.ballCount; ++i) {
            uint256 hash = uint256(keccak256(abi.encode(seed, i)));
            uint256 radius = 5 + (hash >> 24) % 6;
            uint256 period = 2 * (63 - 2 * radius);
            uint256 p = 3 * (8 + i);
            bytes3 colour = bytes3(r.palette[p]) | (bytes3(r.palette[p + 1]) >> 8) | (bytes3(r.palette[p + 2]) >> 16);
            r.balls[i] = Ball(radius, (hash >> 40) % period, (hash >> 72) % period, colour);
        }
    }

    /// @notice Two seconds, 50 frames. Upscale runs, never the rasterization work.
    function aviFromSeed(uint256 size, uint256 seed) external pure returns (bytes memory out) {
        if (size != 256 && size != 512) revert InvalidSettings();
        uint256 frames = 50;
        uint256 fps = 25;
        uint256 n = size * size;
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
        _copy(out, 0, bytes("RIFF"));
        _le(out, 4, 0, 4);
        _copy(out, 8, bytes("AVI LIST"));
        _le(out, 16, 256, 4);
        _copy(out, 20, bytes("hdrlavih"));
        _le(out, 28, 56, 4);
        _le(out, 32, 1_000_000 / fps, 4);
        _le(out, 36, (n + 8) * fps, 4);
        _le(out, 44, 16, 4); // AVIF_HASINDEX
        _le(out, 48, frames, 4);
        _le(out, 56, 1, 4); // one stream
        _le(out, 60, n, 4);
        _le(out, 64, size, 4);
        _le(out, 68, size, 4);
        _copy(out, 88, bytes("LIST"));
        _le(out, 92, 180, 4);
        _copy(out, 96, bytes("strlstrh"));
        _le(out, 104, 56, 4);
        _copy(out, 108, bytes("vidsmrle"));
        _le(out, 128, 1, 4); // scale
        _le(out, 132, fps, 4); // rate
        _le(out, 140, frames, 4);
        _le(out, 144, n, 4);
        _le(out, 148, 0xffffffff, 4); // default quality
        _le(out, 160, size, 2);
        _le(out, 162, size, 2);
        _copy(out, 164, bytes("strf"));
        _le(out, 168, 104, 4); // BITMAPINFOHEADER + 16 RGBQUADs
        _le(out, 172, 40, 4);
        _le(out, 176, size, 4);
        _le(out, 180, size, 4);
        _le(out, 184, 1, 2); // planes
        _le(out, 186, 8, 2);
        _le(out, 188, 1, 4); // BI_RLE8
        _le(out, 192, n, 4);
        _le(out, 204, 16, 4);
        _le(out, 208, 16, 4);
        bytes memory palette = _palette(sceneForSeed(seed), seed);
        for (uint256 i; i < 16; ++i) {
            out[212 + 4 * i] = palette[3 * i + 2];
            out[213 + 4 * i] = palette[3 * i + 1];
            out[214 + 4 * i] = palette[3 * i];
        }
        _copy(out, 276, bytes("LIST"));
        _le(out, 280, 0, 4);
        _copy(out, 284, bytes("movi"));

        _le(out, 4, out.length - 8, 4);
        _le(out, 36, (largest + 8) * fps, 4);
        _le(out, 60, largest, 4);
        _le(out, 144, largest, 4);
        _le(out, 192, largest, 4);
        _le(out, 280, movieSize + 4, 4);
        uint256 pos = 288;
        for (uint256 f; f < frames; ++f) {
            _copy(out, pos, bytes("00dc"));
            _le(out, pos + 4, chunks[f].length, 4);
            _copy(out, pos + 8, chunks[f]);
            pos += 8 + chunks[f].length;
        }
        _copy(out, pos, bytes("idx1"));
        _le(out, pos + 4, frames * 16, 4);
        pos += 8;
        uint256 offset = 4;
        for (uint256 f; f < frames; ++f) {
            _copy(out, pos, bytes("00dc"));
            _le(out, pos + 4, 16, 4);
            _le(out, pos + 8, offset, 4);
            _le(out, pos + 12, chunks[f].length, 4);
            offset += 8 + chunks[f].length;
            pos += 16;
        }
        assert(pos == out.length);
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

    function _copy(bytes memory dst, uint256 p, bytes memory src) private pure {
        assembly ("memory-safe") { mcopy(add(add(dst, 32), p), add(src, 32), mload(src)) }
    }

    function _le(bytes memory dst, uint256 p, uint256 value, uint256 count) private pure {
        for (uint256 i; i < count; ++i) {
            dst[p + i] = bytes1(uint8(value >> (8 * i)));
        }
    }
}
