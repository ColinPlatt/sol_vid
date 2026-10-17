// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployGhoulballs} from "../script/DeployGhoulballs.s.sol";
import {DeployBase, DeployBaseSepolia} from "../script/DeployBase.s.sol";
import {GenerativeVideo} from "../src/GenerativeVideo.sol";
import {SolVideoNFT} from "../src/SolVideoNFT.sol";
import {VmChain} from "./DeploySepolia.t.sol";

contract DeployBaseTest {
    VmChain constant vm = VmChain(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testBaseGuardRejectsSepolia() public {
        DeployBase deploy = new DeployBase();
        vm.chainId(11155111);
        vm.expectRevert(abi.encodeWithSelector(DeployGhoulballs.WrongChain.selector, 11155111));
        deploy.run();
    }

    function testBaseRehearsal() public {
        vm.chainId(8453);
        (GenerativeVideo renderer, SolVideoNFT collection) = new DeployBase().run();
        require(address(collection.renderer()) == address(renderer), "Wrong Base renderer");
        require(collection.totalSupply() == 3 && collection.supportsInterface(0x80ac58cd), "Bad Base collection");
    }

    function testBaseSepoliaRehearsal() public {
        vm.chainId(84532);
        (GenerativeVideo renderer, SolVideoNFT collection) = new DeployBaseSepolia().run();
        require(address(collection.renderer()) == address(renderer), "Wrong Base Sepolia renderer");
        require(collection.totalSupply() == 3 && collection.formatOf(3) == 2, "Deployment did not mint the first set");
    }
}
