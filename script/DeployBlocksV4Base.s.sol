// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockArtRenderer} from "../src/blockart/BlockArtRenderer.sol";
import {BlockVideoRendererV4} from "../src/blockart/BlockVideoRendererV4.sol";
import {BlockVideoNFTV4} from "../src/blockart/BlockVideoNFTV4.sol";
import {BlocksBandsV4} from "../src/blockart/BlocksBandsV4.sol";

interface BlocksV4BaseDeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice BLOCKS_VIDEO_V4 on Base (FOUNDRY_PROFILE=blocks_base, Cancun): reuses the verified V3 scene router and its
///         eight scenes, then deploys the data-band formatter, the V4 renderer, the collection and its first mint.
///         The signer comes from the command line (`--account`), as for the earlier Base deployments.
contract DeployBlocksV4Base {
    BlocksV4BaseDeployVm constant vm = BlocksV4BaseDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    BlockArtRenderer constant ROUTER = BlockArtRenderer(ROUTER_ADDRESS);
    address constant ROUTER_ADDRESS = 0xfF9Ab8556de392F84E82A31709fB58991Cf1fB9F;

    function run() external returns (BlockVideoNFTV4 collection) {
        require(block.chainid == 8453, "Base only");
        require(address(ROUTER).code.length != 0, "Router missing");
        vm.startBroadcast();
        collection = new BlockVideoNFTV4(new BlockVideoRendererV4(ROUTER, new BlocksBandsV4()));
        collection.mint();
        vm.stopBroadcast();
        require(collection.totalSupply() == 1, "First mint missing");
        uint256 beforeGas = gasleft();
        (bool ok,) = address(collection).staticcall{gas: 500_000_000}(
            abi.encodeCall(collection.tokenURI, (collection.latestTokenId()))
        );
        require(ok && beforeGas - gasleft() <= 500_000_000, "First metadata exceeds budget");
    }
}
