// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Actual EVM-visible information from one mint block. No caller-supplied fields or previous-block data.
library SingleBlockData {
    struct Info {
        uint256 number;
        uint256 timestamp;
        uint256 gasLimit;
        uint256 baseFee;
        uint256 prevrandao;
        address beneficiary;
        uint256 chainId;
    }

    function capture() internal view returns (Info memory) {
        return Info(
            block.number,
            block.timestamp,
            block.gaslimit,
            block.basefee,
            block.prevrandao,
            block.coinbase,
            block.chainid
        );
    }

    function seed(Info memory info) internal pure returns (bytes32) {
        return keccak256(abi.encode("BLOCKS_SINGLE_V1", info));
    }

    /// @dev Adapts a single seed to the existing scene renderer's ten visual channels. These channels are
    ///      derived visual parameters, NOT ten block headers, measured gas usage, state roots or log blooms.
    ///      Every displayed block number is the one real mint block. The public metadata exposes only real fields.
    function artwork(Info memory info) internal pure returns (bytes memory data) {
        bytes32 entropy = seed(info);
        data = new bytes(3520);
        for (uint256 i; i < 10; ++i) {
            bytes32 channel = i == 9 ? entropy : keccak256(abi.encode(entropy, i));
            uint256 intensity = uint256(keccak256(abi.encode(channel, "intensity"))) % 3001;
            uint256 meta = uint256(uint64(info.number)) << 192 | intensity << 128 | uint256(10000) << 64
                | uint256(uint64(info.timestamp));
            bytes32 tint = keccak256(abi.encode(channel, "tint"));
            uint256 dst;
            assembly ("memory-safe") {
                dst := add(add(data, 32), mul(i, 352))
                mstore(dst, meta)
                mstore(add(dst, 32), channel)
                mstore(add(dst, 64), tint)
            }
            for (uint256 j; j < 8; ++j) {
                bytes32 lights = keccak256(abi.encode(channel, "lights", j));
                assembly ("memory-safe") { mstore(add(add(dst, 96), mul(j, 32)), lights) }
            }
        }
    }
}
