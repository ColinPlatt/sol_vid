// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployGhoulballs} from "../script/DeployGhoulballs.s.sol";
import {DeploySepolia} from "../script/DeploySepolia.s.sol";
import {GenerativeVideo} from "../src/GenerativeVideo.sol";
import {SolVideoNFT} from "../src/SolVideoNFT.sol";

interface VmChain {
    function chainId(uint256 chainId) external;
    function expectRevert(bytes calldata) external;
}

contract DeploySepoliaTest {
    VmChain constant vm = VmChain(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRejectsWrongNetwork() public {
        DeploySepolia deploy = new DeploySepolia();
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(DeployGhoulballs.WrongChain.selector, 1));
        deploy.run();
    }

    function testSepoliaRehearsal() public {
        vm.chainId(11155111);
        (GenerativeVideo renderer, SolVideoNFT collection) = new DeploySepolia().run();
        require(address(collection.renderer()) == address(renderer), "Deployment wiring failed");
        require(address(renderer).code.length <= 24576 && address(collection).code.length <= 24576, "Runtime too large");
        require(collection.totalSupply() == 3 && collection.formatOf(3) == 2, "Deployment did not mint the first set");
    }
}
