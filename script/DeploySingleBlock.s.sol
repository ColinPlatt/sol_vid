// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {SingleBlockNFT} from "../src/blockart/SingleBlockNFT.sol";
import {BlockArtRenderer} from "../src/blockart/BlockArtRenderer.sol";

interface SingleBlockDeployVm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function addr(uint256) external pure returns (address);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}

contract DeploySingleBlockSepolia {
    SingleBlockDeployVm constant vm = SingleBlockDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    // Reuse the exact-source-verified, immutable eight-scene router from the epoch prototype.
    address public constant RENDERER = 0xEdF6937B047c1ad9d2fE4c7203b5C54F4EAdAD46;

    function run() external returns (SingleBlockNFT collection) {
        require(block.chainid == 11155111, "Ethereum Sepolia only");
        require(RENDERER.code.length != 0, "Renderer missing");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(vm.addr(key) == vm.envAddress("DEPLOYER_ADDRESS"), "Wrong signer");
        vm.startBroadcast(key);
        collection = new SingleBlockNFT(BlockArtRenderer(RENDERER));
        collection.mint();
        vm.stopBroadcast();
        require(collection.totalSupply() == 1, "First mint missing");
    }
}
