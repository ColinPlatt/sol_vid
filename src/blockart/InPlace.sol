// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Zero-copy returns and calls for megabyte-sized byte strings.
/// @dev EVM memory cost is quadratic, so each extra copy of a 1.7 MB GIF or 3 MB URI costs tens of millions of gas.
///      `ret` ABI-encodes a bytes/string return in place by writing the head word just before it (the word before any
///      allocation belongs to an earlier object we no longer need, since this halts the call). `call` reads a
///      `bytes` result straight from returndata without the decoder's second copy.
library InPlace {
    function ret(bytes memory b) internal pure {
        assembly ("memory-safe") {
            let s := sub(b, 32)
            let len := mload(b)
            mstore(s, 0x20)
            mstore(add(add(b, 32), len), 0) // zero the padding
            return(s, add(64, and(add(len, 31), not(31))))
        }
    }

    /// @dev Static-call `target` with `data` and return its `bytes` result as a memory object pointing into the copied
    ///      returndata. Bubbles reverts.
    function call(address target, bytes memory data) internal view returns (bytes memory result) {
        assembly ("memory-safe") {
            let ok := staticcall(gas(), target, add(data, 32), mload(data), 0, 0)
            let size := returndatasize()
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            if iszero(ok) { revert(ptr, size) }
            // Layout: [offset 0x20][length][data]; the bytes object is the length word onward.
            result := add(ptr, mload(ptr))
            mstore(0x40, add(ptr, and(add(size, 31), not(31))))
        }
    }

    /// @dev Forward a static call's raw returndata (or revert) as this call's own result.
    function forward(address target, bytes memory data) internal view {
        assembly ("memory-safe") {
            let ok := staticcall(gas(), target, add(data, 32), mload(data), 0, 0)
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize())
            if iszero(ok) { revert(ptr, returndatasize()) }
            return(ptr, returndatasize())
        }
    }
}
