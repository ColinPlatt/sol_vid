// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Builds `data:application/json;base64,` + base64(pre + base64(gif) + post) in one allocation.
/// @dev The token JSON embeds the GIF as base64 and is itself base64-encoded, so the GIF is encoded twice. Holding the
///      inner encoding, the JSON and the final URI as separate strings would keep ~4x the GIF size alive, and EVM
///      memory cost is quadratic. Instead the JSON stream is produced into a small window and outer-encoded as it
///      fills: live memory is just the GIF and the final URI.
///      Base64 is word-parallel: 24 input bytes -> 32 characters per step. Five masked shifts spread the 6-bit fields
///      into byte lanes; lane-wise compares (add, test the high bit) pick each lane's ASCII offset with no table.
library DataURI {
    uint256 private constant WINDOW = 3072; // 128 x 24 input bytes per flush

    function jsonWithGif(bytes memory pre, bytes memory gif, bytes memory post)
        internal
        pure
        returns (string memory out)
    {
        uint256 total = pre.length + 4 * ((gif.length + 2) / 3) + post.length;
        bytes memory head = "data:application/json;base64,";
        out = new string(head.length + 4 * ((total + 2) / 3));
        bytes memory window = new bytes(WINDOW + 64);
        assembly ("memory-safe") {
            // 24 bytes at the top of v -> 32 base64 characters.
            function b64(v) -> r {
                v := shr(2, and(v, 0xffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000))
                v := or(
                    and(v, 0x3fffffffffffffffffffffffc000000000000000000000000000000000000000),
                    shr(32, and(v, 0x3fffffffffffffffffffffffc000000000000000))
                )
                v := or(
                    and(v, 0x3fffffffffffc00000000000000000003fffffffffffc0000000000000000000),
                    shr(16, and(v, 0x3fffffffffffc00000000000000000003fffffffffffc0000000))
                )
                v := or(
                    and(v, 0x3fffffc0000000003fffffc0000000003fffffc0000000003fffffc000000000),
                    shr(8, and(v, 0x3fffffc0000000003fffffc0000000003fffffc0000000003fffffc000))
                )
                v := or(
                    and(v, 0x3ffc00003ffc00003ffc00003ffc00003ffc00003ffc00003ffc00003ffc0000),
                    shr(4, and(v, 0x3ffc00003ffc00003ffc00003ffc00003ffc00003ffc00003ffc00003ffc0))
                )
                v := or(
                    and(v, 0x3f003f003f003f003f003f003f003f003f003f003f003f003f003f003f003f00),
                    shr(2, and(v, 0xfc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc00fc))
                )
                let h := 0x8080808080808080808080808080808080808080808080808080808080808080
                let ge26 := shr(7, and(add(v, 0x6666666666666666666666666666666666666666666666666666666666666666), h))
                let ge52 := shr(7, and(add(v, 0x4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c), h))
                let ge62 := shr(7, and(add(v, 0x4242424242424242424242424242424242424242424242424242424242424242), h))
                let ge63 := shr(7, and(add(v, 0x4141414141414141414141414141414141414141414141414141414141414141), h))
                // 'A'+v, 'a'-26+v, '0'-52+v, '+', '/': base 65, +6, -75, -15, +3, with no lane carries or borrows.
                r := sub(
                    add(
                        add(add(v, 0x4141414141414141414141414141414141414141414141414141414141414141), mul(ge26, 6)),
                        mul(ge63, 3)
                    ),
                    add(mul(ge52, 75), mul(ge62, 15))
                )
            }
            // Encode len bytes at src to dst, '=' padded; returns the advanced dst.
            function encode(src, len, dst) -> d {
                let end := add(src, sub(len, mod(len, 24)))
                for {} lt(src, end) {} {
                    mstore(dst, b64(mload(src)))
                    src := add(src, 24)
                    dst := add(dst, 32)
                }
                let r := mod(len, 24)
                d := dst
                if r {
                    mstore(dst, b64(and(mload(src), not(shr(shl(3, r), not(0))))))
                    let chars := mul(4, div(add(r, 2), 3))
                    d := add(dst, chars)
                    switch mod(r, 3)
                    case 1 {
                        mstore8(sub(d, 2), 0x3d)
                        mstore8(sub(d, 1), 0x3d)
                    }
                    case 2 { mstore8(sub(d, 1), 0x3d) }
                }
            }
            // Append raw bytes to the window, flushing full windows to dst.
            function append(src, len, win, pending, dst) -> p, d {
                p := pending
                d := dst
                for {} len {} {
                    let take := sub(3072, p)
                    if lt(len, take) { take := len }
                    mcopy(add(win, p), src, take)
                    p := add(p, take)
                    src := add(src, take)
                    len := sub(len, take)
                    if eq(p, 3072) {
                        d := encode(win, 3072, d)
                        p := 0
                    }
                }
            }

            let fmp := mload(0x40)
            mcopy(add(out, 32), add(head, 32), mload(head))
            let o := add(add(out, 32), mload(head))
            let w := add(window, 32)
            let n := 0

            n, o := append(add(pre, 32), mload(pre), w, n, o)
            // Inner encoding: 24 GIF bytes -> 32 characters straight into the window.
            {
                let src := add(gif, 32)
                let len := mload(gif)
                let end := add(src, sub(len, mod(len, 24)))
                for {} lt(src, end) {} {
                    mstore(add(w, n), b64(mload(src)))
                    src := add(src, 24)
                    n := add(n, 32)
                    if iszero(lt(n, 3072)) {
                        o := encode(w, 3072, o)
                        n := sub(n, 3072)
                        mstore(w, mload(add(w, 3072))) // carry the overrun
                    }
                }
                let r := mod(len, 24)
                if r {
                    let t := fmp // scratch beyond all allocations
                    let e := encode(src, r, t)
                    n, o := append(t, sub(e, t), w, n, o)
                }
            }
            n, o := append(add(post, 32), mload(post), w, n, o)
            o := encode(w, n, o)
        }
    }
}
