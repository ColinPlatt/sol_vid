// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MarketplaceProbe} from "../src/probes/MarketplaceProbe.sol";

interface VmMarketplaceProbe {
    function envAddress(string calldata name) external view returns (address);
    function envString(string calldata name) external view returns (string memory);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

abstract contract DeployMarketplaceProbe {
    error WrongChain(uint256 chainId);
    VmMarketplaceProbe constant vm = VmMarketplaceProbe(address(uint160(uint256(keccak256("hevm cheat code")))));
    function targetChainId() public pure virtual returns (uint256);

    function run() external returns (MarketplaceProbe probe) {
        if (block.chainid != targetChainId()) revert WrongChain(block.chainid);
        address deployer = vm.envAddress("PROBE_DEPLOYER_ADDRESS");
        string memory hostedURL = vm.envString("PROBE_HOSTED_HTML_URL");
        vm.startBroadcast(deployer);
        probe = new MarketplaceProbe(deployer, hostedURL);
        vm.stopBroadcast();
        require(probe.totalSupply() == 15 && probe.balanceOf(deployer) == 15, "Probe set not minted to deployer");
    }
}

contract DeployMarketplaceProbeBase is DeployMarketplaceProbe {
    function targetChainId() public pure override returns (uint256) {
        return 8453;
    }
}

contract DeployMarketplaceProbeBaseSepolia is DeployMarketplaceProbe {
    function targetChainId() public pure override returns (uint256) {
        return 84532;
    }
}
