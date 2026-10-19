// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockArtRenderer} from "../src/blockart/BlockArtRenderer.sol";
import {BlockVideoRendererV3} from "../src/blockart/BlockVideoRendererV3.sol";
import {BlockVideoNFTV3} from "../src/blockart/BlockVideoNFTV3.sol";
import {DescentV3} from "../src/blockart/scenes/DescentV3.sol";

interface BlocksV3DeployVm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function addr(uint256) external pure returns (address);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}

/// @notice BLOCKS_VIDEO_V3 on Ethereum Sepolia: DescentV3 in slot 1, the seven other exact-source-verified
///         scenes reused, a new router and renderer, then the collection and its first mint in the same broadcast.
contract DeployBlocksV3Sepolia {
    BlocksV3DeployVm constant vm = BlocksV3DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant CANYON = 0x9B98725F47faE11EdC4d62cC1A6BE6cDfFa4bA9e;
    address constant MONORAIL = 0x052D7C4f8388868EE4d609b7B766B2e55493EaDB;
    address constant SPIRE = 0x6A12FcaB116179201E8AB8018524F48C66A89525;
    address constant SKYLINE = 0x5930977cB50ACef591838b6dC60ea4798635a4D3;
    address constant ALLEY = 0x6B5C2c6E2Fab7BfD3b35284aA3ec47a0e0Ab1c1A;
    address constant NIGHT_TRAIN = 0x8f9Ba4F5a8ae784c771b0b17d7959dd9210430dD;
    address constant SATOYAMA = 0x82A997dE5a28EEB9c772FEBB8a02FA70afa34b08;

    function run() external returns (BlockVideoNFTV3 collection) {
        require(block.chainid == 11155111, "Ethereum Sepolia only");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(vm.addr(key) == vm.envAddress("DEPLOYER_ADDRESS"), "Wrong signer");
        vm.startBroadcast(key);
        address[8] memory slots =
            [CANYON, address(new DescentV3()), MONORAIL, SPIRE, SKYLINE, ALLEY, NIGHT_TRAIN, SATOYAMA];
        collection = new BlockVideoNFTV3(new BlockVideoRendererV3(new BlockArtRenderer(slots)));
        collection.mint();
        vm.stopBroadcast();
        require(collection.totalSupply() == 1, "First mint missing");
    }
}
