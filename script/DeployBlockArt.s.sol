// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockHeaders} from "../src/blockart/BlockHeaders.sol";
import {BlockArtNFT} from "../src/blockart/BlockArtNFT.sol";
import {BlockArtRenderer} from "../src/blockart/BlockArtRenderer.sol";
import {Canyon} from "../src/blockart/scenes/Canyon.sol";
import {Descent} from "../src/blockart/scenes/Descent.sol";
import {Monorail} from "../src/blockart/scenes/Monorail.sol";
import {Spire} from "../src/blockart/scenes/Spire.sol";
import {Skyline} from "../src/blockart/scenes/Skyline.sol";
import {Alley} from "../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../src/blockart/scenes/Satoyama.sol";

interface BlockArtDeployVm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function addr(uint256 privateKey) external pure returns (address);
    function envString(string calldata) external returns (string memory);
    function parseJsonBytesArray(string calldata, string calldata) external pure returns (bytes[] memory);
    function startBroadcast() external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Supply a recent proof from the target chain. Base uses blocks_base/Cancun; Ethereum Sepolia uses default/Amsterdam.
abstract contract DeployBlockArt {
    error WrongChain();
    BlockArtDeployVm constant vm = BlockArtDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function targetChainId() public pure virtual returns (uint256);

    function _startBroadcast() internal virtual {
        vm.startBroadcast();
    }

    function run() external returns (BlockArtRenderer renderer, BlockArtNFT collection) {
        if (block.chainid != targetChainId()) revert WrongChain();
        uint256 epoch = vm.envUint("BLOCKART_EPOCH");
        bytes[] memory headers = vm.parseJsonBytesArray(vm.envString("BLOCKART_HEADERS_JSON"), ".headers");
        // Reject stale, tampered or misordered proofs before any deployment transaction is signed.
        BlockHeaders.verifyEpoch(epoch, headers);
        _startBroadcast();
        address[8] memory scenes = [
            address(new Canyon()),
            address(new Descent()),
            address(new Monorail()),
            address(new Spire()),
            address(new Skyline()),
            address(new Alley()),
            address(new NightTrain()),
            address(new Satoyama())
        ];
        for (uint256 i; i < 8; ++i) {
            require(scenes[i].code.length <= 24576, "Scene runtime too large");
        }
        renderer = new BlockArtRenderer(scenes);
        collection = new BlockArtNFT(renderer);
        collection.mint(epoch, headers);
        vm.stopBroadcast();
        require(collection.totalSupply() == 1, "Missing first mint");
        require(address(collection.renderer()) == address(renderer), "Wrong renderer");
    }
}

contract DeployBlockArtBase is DeployBlockArt {
    function targetChainId() public pure override returns (uint256) {
        return 8453;
    }
}

contract DeployBlockArtBaseSepolia is DeployBlockArt {
    function targetChainId() public pure override returns (uint256) {
        return 84532;
    }
}

/// @notice Ethereum Sepolia only. The signing key is read from the local environment, never a CLI argument.
contract DeployBlockArtSepolia is DeployBlockArt {
    function targetChainId() public pure override returns (uint256) {
        return 11155111;
    }

    function _startBroadcast() internal override {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(vm.addr(privateKey) == vm.envAddress("DEPLOYER_ADDRESS"), "Deployer address mismatch");
        vm.startBroadcast(privateKey);
    }
}
