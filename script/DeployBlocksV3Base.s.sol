// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockArtRenderer} from "../src/blockart/BlockArtRenderer.sol";
import {BlockVideoRendererV3} from "../src/blockart/BlockVideoRendererV3.sol";
import {BlockVideoNFTV3} from "../src/blockart/BlockVideoNFTV3.sol";
import {Canyon} from "../src/blockart/scenes/Canyon.sol";
import {DescentV3} from "../src/blockart/scenes/DescentV3.sol";
import {Monorail} from "../src/blockart/scenes/Monorail.sol";
import {Spire} from "../src/blockart/scenes/Spire.sol";
import {Skyline} from "../src/blockart/scenes/Skyline.sol";
import {Alley} from "../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../src/blockart/scenes/Satoyama.sol";

interface BlocksV3BaseDeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice BLOCKS_VIDEO_V3 on Base (FOUNDRY_PROFILE=blocks_base, Cancun): no blocks contracts exist there yet, so all
///         eight scenes (DescentV3 in slot 1), the router, renderer, collection and first mint go in one broadcast.
///         The signer comes from the command line (`--account`), as for the earlier Base deployments.
contract DeployBlocksV3Base {
    BlocksV3BaseDeployVm constant vm = BlocksV3BaseDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (BlockVideoNFTV3 collection) {
        require(block.chainid == 8453, "Base only");
        vm.startBroadcast();
        address[8] memory slots = [
            address(new Canyon()),
            address(new DescentV3()),
            address(new Monorail()),
            address(new Spire()),
            address(new Skyline()),
            address(new Alley()),
            address(new NightTrain()),
            address(new Satoyama())
        ];
        collection = new BlockVideoNFTV3(new BlockVideoRendererV3(new BlockArtRenderer(slots)));
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
