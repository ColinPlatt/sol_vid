// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployGhoulballs} from "./DeployGhoulballs.s.sol";

contract DeployBase is DeployGhoulballs {
    function targetChainId() public pure override returns (uint256) {
        return 8453;
    }
}

contract DeployBaseSepolia is DeployGhoulballs {
    function targetChainId() public pure override returns (uint256) {
        return 84532;
    }
}
