// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Extra block context `BLOCKS_VIDEO_V4` captures at mint for display only; it never feeds the seed.
/// @dev A contract cannot read its own block's hash, so the parent hash is the latest one available. On OP Stack
///      chains such as Base, the L1Block predeploy exposes the Ethereum block the L2 block is anchored to.
library BlockExtras {
    address internal constant L1_BLOCK = 0x4200000000000000000000000000000000000015;

    struct Extras {
        bytes32 parentHash;
        uint256 blobBaseFee; // the L1 blob base fee on OP Stack chains, otherwise this chain's own
        uint256 l1Number; // zero when there is no L1Block predeploy
        bytes32 l1Hash;
        uint256 l1BaseFee;
    }

    function _read(bytes4 selector) private view returns (bool ok, uint256 value) {
        bytes memory result;
        (ok, result) = L1_BLOCK.staticcall{gas: 20000}(abi.encodeWithSelector(selector));
        ok = ok && result.length == 32;
        if (ok) value = abi.decode(result, (uint256));
    }

    function capture() internal view returns (Extras memory x) {
        x.parentHash = blockhash(block.number - 1);
        x.blobBaseFee = block.blobbasefee;
        if (L1_BLOCK.code.length == 0) return x;
        (bool ok, uint256 number) = _read(0x8381f58a); // number()
        if (!ok) return x;
        (bool okHash, uint256 hash) = _read(0x09bd5a60); // hash()
        (bool okFee, uint256 fee) = _read(0x5cf24969); // basefee()
        (bool okBlob, uint256 blob) = _read(0xf8206140); // blobBaseFee()
        x.l1Number = number;
        if (okHash) x.l1Hash = bytes32(hash);
        if (okFee) x.l1BaseFee = fee;
        if (okBlob) x.blobBaseFee = blob;
    }
}
