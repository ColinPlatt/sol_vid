// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployGhoulballs} from "./DeployGhoulballs.s.sol";

contract DeploySepolia is DeployGhoulballs {
    function targetChainId() public pure override returns (uint256) {
        return 11155111;
    }
}
