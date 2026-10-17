// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {GenerativeVideo} from "../src/GenerativeVideo.sol";
import {SolVideoNFT} from "../src/SolVideoNFT.sol";

interface VmCollection {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envAddress(string calldata name) external view returns (address);
}

/// @notice Deploy a new collection against the existing, unchanged Sepolia renderer (`RENDERER_ADDRESS`).
contract DeploySepoliaCollection {
    error WrongChain(uint256 chainId);

    VmCollection constant vm = VmCollection(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SolVideoNFT collection) {
        if (block.chainid != 11155111) revert WrongChain(block.chainid);
        GenerativeVideo renderer = GenerativeVideo(vm.envAddress("RENDERER_ADDRESS"));
        require(address(renderer).code.length > 0, "Missing renderer");
        vm.startBroadcast();
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
