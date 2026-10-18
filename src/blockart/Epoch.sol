// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Read-only accessors over a packed 10-block epoch record (see BlockHeaders.verifyEpoch).
/// @dev Record i starts at i * 352: meta word (number | gasUsed | gasLimit | timestamp, 64 bits each), block hash,
///      state root, 256-byte logs bloom. Mirrors `block()` in concepts/neo-tokyo/kit.js.
library Epoch {
    uint256 internal constant N = 10;
    uint256 internal constant RECORD = 352;

    function _word(bytes memory e, uint256 i, uint256 off) private pure returns (uint256 v) {
        assembly ("memory-safe") {
            v := mload(add(add(add(e, 32), mul(i, 352)), off))
        }
    }

    function number(bytes memory e, uint256 i) internal pure returns (uint256) {
        return _word(e, i, 0) >> 192;
    }

    /// @dev Gas used as a fraction of the gas limit, in 1/10000 (basis points).
    function gasBps(bytes memory e, uint256 i) internal pure returns (uint256) {
        uint256 m = _word(e, i, 0);
        uint256 limit = (m >> 64) & type(uint64).max;
        return limit == 0 ? 0 : ((m >> 128) & type(uint64).max) * 10000 / limit;
    }

    function hash(bytes memory e, uint256 i) internal pure returns (uint256) {
        return _word(e, i, 32);
    }

    function hashByte(bytes memory e, uint256 i, uint256 k) internal pure returns (uint256) {
        return (_word(e, i, 32) >> (8 * (31 - (k % 32)))) & 0xff;
    }

    function stateByte(bytes memory e, uint256 i, uint256 k) internal pure returns (uint256) {
        return (_word(e, i, 64) >> (8 * (31 - (k % 32)))) & 0xff;
    }

    /// @dev Bit `k` of the hash, counted from the most significant bit of byte 0 (kit.js `bit`).
    function hashBit(bytes memory e, uint256 i, uint256 k) internal pure returns (bool) {
        return (_word(e, i, 32) >> (255 - (k % 256))) & 1 == 1;
    }

    function bloomBit(bytes memory e, uint256 i, uint256 k) internal pure returns (bool r) {
        assembly ("memory-safe") {
            let b := byte(0, mload(add(add(add(e, 32), mul(i, 352)), add(96, mod(shr(3, k), 256)))))
            r := and(shr(sub(7, and(k, 7)), b), 1)
        }
    }

    /// @dev Neon colour (0..5) and sign word (0..14) of block i, as in the concepts.
    function neon(bytes memory e, uint256 i) internal pure returns (uint256) {
        return hashByte(e, i, 3) % 6;
    }

    function word(bytes memory e, uint256 i) internal pure returns (uint256) {
        return hashByte(e, i, 5) % 15;
    }

    /// @notice Which scene an epoch mints: rare SATOYAMA (7) on ~1/64 epochs, else one of the seven regular scenes.
    function scene(bytes memory e) internal pure returns (uint256) {
        uint256 h = hash(e, N - 1);
        if ((h >> 216) & 0xff < 4) return 7;
        return (h >> 224) % 7;
    }
}
