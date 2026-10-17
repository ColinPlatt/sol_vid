// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {
    DeployMarketplaceProbe,
    DeployMarketplaceProbeBase,
    DeployMarketplaceProbeBaseSepolia
} from "../script/DeployMarketplaceProbe.s.sol";

interface VmProbeChain {
    function chainId(uint256 chainId) external;
    function expectRevert(bytes calldata data) external;
}

contract DeployMarketplaceProbeTest {
    VmProbeChain constant vm = VmProbeChain(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testBaseRejectsSepoliaBeforeReadingDeploymentSettings() public {
        DeployMarketplaceProbeBase script = new DeployMarketplaceProbeBase();
        vm.chainId(11155111);
        vm.expectRevert(abi.encodeWithSelector(DeployMarketplaceProbe.WrongChain.selector, 11155111));
        script.run();
    }

    function testBaseSepoliaRejectsBaseBeforeReadingDeploymentSettings() public {
        DeployMarketplaceProbeBaseSepolia script = new DeployMarketplaceProbeBaseSepolia();
        vm.chainId(8453);
        vm.expectRevert(abi.encodeWithSelector(DeployMarketplaceProbe.WrongChain.selector, 8453));
        script.run();
    }
}
