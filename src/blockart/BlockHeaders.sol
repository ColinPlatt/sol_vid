// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Decodes RLP block headers and verifies a 10-block epoch against the chain's own block hashes.
/// @dev Field order is the Ethereum header layout Base uses: parentHash(0), sha3Uncles, miner, stateRoot(3),
///      transactionsRoot, receiptsRoot, logsBloom(6), difficulty, number(8), gasLimit(9), gasUsed(10), timestamp(11), ...
library BlockHeaders {
    uint256 internal constant EPOCH_BLOCKS = 10;
    /// @dev Packed block record: number u64 | gasUsed u64 | gasLimit u64 | timestamp u64 | hash | stateRoot | bloom.
    uint256 internal constant RECORD = 32 + 32 + 32 + 256;
    uint256 internal constant EPOCH_BYTES = EPOCH_BLOCKS * RECORD;

    error BadHeader();
    error BrokenChain(uint256 index);
    error WrongBlock(uint256 index);
    error UnknownBlockHash();

    struct Header {
        bytes32 hash;
        bytes32 parentHash;
        bytes32 stateRoot;
        uint256 number;
        uint256 gasLimit;
        uint256 gasUsed;
        uint256 timestamp;
        uint256 bloomOffset; // memory offset of the 256-byte logs bloom inside the header bytes
    }

    /// @dev Reads one RLP item at `p` (absolute memory pointer); returns payload start, payload length and next item.
    function _item(uint256 p, uint256 end) private pure returns (uint256 start, uint256 len, uint256 next) {
        if (p >= end) revert BadHeader();
        uint256 b;
        assembly ("memory-safe") {
            b := byte(0, mload(p))
        }
        if (b < 0x80) return (p, 1, p + 1);
        if (b < 0xb8) {
            len = b - 0x80;
            start = p + 1;
        } else if (b < 0xc0) {
            uint256 ll = b - 0xb7;
            assembly ("memory-safe") {
                len := shr(sub(256, mul(ll, 8)), mload(add(p, 1)))
            }
            start = p + 1 + ll;
        } else {
            revert BadHeader(); // headers hold no nested lists
        }
        next = start + len;
        if (next > end) revert BadHeader();
    }

    function _uint(uint256 start, uint256 len) private pure returns (uint256 v) {
        if (len > 32) revert BadHeader();
        if (len == 0) return 0;
        assembly ("memory-safe") {
            v := shr(sub(256, mul(len, 8)), mload(start))
        }
    }

    function _word(uint256 start, uint256 len) private pure returns (bytes32 v) {
        if (len != 32) revert BadHeader();
        assembly ("memory-safe") {
            v := mload(start)
        }
    }

    function decode(bytes memory raw) internal pure returns (Header memory h) {
        uint256 p;
        uint256 end;
        assembly ("memory-safe") {
            p := add(raw, 32)
            end := add(p, mload(raw))
        }
        // Outer list header.
        uint256 b;
        assembly ("memory-safe") {
            b := byte(0, mload(p))
        }
        if (b < 0xf8 || raw.length < 16) revert BadHeader();
        uint256 ll = b - 0xf7;
        uint256 total;
        assembly ("memory-safe") {
            total := shr(sub(256, mul(ll, 8)), mload(add(p, 1)))
        }
        p += 1 + ll;
        if (p + total != end) revert BadHeader();
        h.hash = keccak256(raw);
        for (uint256 field; field < 12; ++field) {
            (uint256 s, uint256 len, uint256 next) = _item(p, end);
            if (field == 0) {
                h.parentHash = _word(s, len);
            } else if (field == 3) {
                h.stateRoot = _word(s, len);
            } else if (field == 6) {
                if (len != 256) revert BadHeader();
                h.bloomOffset = s;
            } else if (field == 8) {
                h.number = _uint(s, len);
            } else if (field == 9) {
                h.gasLimit = _uint(s, len);
            } else if (field == 10) {
                h.gasUsed = _uint(s, len);
            } else if (field == 11) {
                h.timestamp = _uint(s, len);
            }
            p = next;
        }
    }

    /// @notice Verify the ten headers of `epoch` (blocks 10e..10e+9) against `blockhash` and pack them.
    /// @dev The newest header must hash to `blockhash(10e+9)`; every older one is pinned by its child's parentHash.
    function verifyEpoch(uint256 epoch, bytes[] memory headers) internal view returns (bytes memory packed) {
        if (headers.length != EPOCH_BLOCKS) revert BadHeader();
        packed = new bytes(EPOCH_BYTES);
        bytes32 expected = blockhash(epoch * EPOCH_BLOCKS + EPOCH_BLOCKS - 1);
        if (expected == 0) revert UnknownBlockHash();
        for (uint256 k = EPOCH_BLOCKS; k > 0;) {
            --k;
            Header memory h = decode(headers[k]);
            if (h.hash != expected) revert BrokenChain(k);
            if (h.number != epoch * EPOCH_BLOCKS + k) revert WrongBlock(k);
            expected = h.parentHash;
            uint256 dst;
            assembly ("memory-safe") {
                dst := add(add(packed, 32), mul(k, RECORD))
            }
            uint256 meta = h.number << 192 | h.gasUsed << 128 | h.gasLimit << 64 | h.timestamp;
            bytes32 hash = h.hash;
            bytes32 stateRoot = h.stateRoot;
            uint256 bloom = h.bloomOffset;
            assembly ("memory-safe") {
                mstore(dst, meta)
                mstore(add(dst, 32), hash)
                mstore(add(dst, 64), stateRoot)
                mcopy(add(dst, 96), bloom, 256)
            }
        }
    }
}
