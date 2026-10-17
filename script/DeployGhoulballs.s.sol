// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {GenerativeVideo} from "../src/GenerativeVideo.sol";
import {SolVideoNFT} from "../src/SolVideoNFT.sol";

interface VmDeploy {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Shared deployment; network-specific entry points strictly guard the chain ID.
abstract contract DeployGhoulballs {
    error WrongChain(uint256 chainId);

    VmDeploy constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function targetChainId() public pure virtual returns (uint256);

    function run() external returns (GenerativeVideo renderer, SolVideoNFT collection) {
        if (block.chainid != targetChainId()) revert WrongChain(block.chainid);
        vm.startBroadcast();
        renderer = new GenerativeVideo();
        collection = new SolVideoNFT(renderer);
        vm.stopBroadcast();
        require(address(collection.renderer()) == address(renderer), "Renderer mismatch");
        require(collection.MAX_SUPPLY() == 6667, "Unexpected supply cap");
        require(collection.totalSupply() == 0, "Unexpected initial supply");
        require(keccak256(bytes(collection.name())) == keccak256("ghoulballs"), "Unexpected name");
        require(keccak256(bytes(collection.symbol())) == keccak256("ghoulballs"), "Unexpected symbol");
        require(
            collection.supportsInterface(0x80ac58cd) && collection.supportsInterface(0x5b5e139f),
            "Missing ERC721 metadata"
        );
    }
}
