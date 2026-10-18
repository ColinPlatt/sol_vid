// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {DeployBlockArt, DeployBlockArtBase, DeployBlockArtBaseSepolia} from "../../script/DeployBlockArt.s.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {BlockArtNFT} from "../../src/blockart/BlockArtNFT.sol";
import {BaseEpochs} from "./BaseEpochs.sol";

interface BlocksDeployVm {
    function chainId(uint256) external;
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function setEnv(string calldata, string calldata) external;
    function expectRevert(bytes calldata) external;
}

contract BlocksDeployTest {
    BlocksDeployVm constant vm = BlocksDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function prepare() private {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        vm.setEnv("BLOCKART_EPOCH", "5254696");
        bytes[] memory headers = BaseEpochs.epoch5254696();
        bytes memory alphabet = "0123456789abcdef";
        bytes memory json = bytes('{"headers":[');
        for (uint256 i; i < 10; ++i) {
            bytes memory encoded = new bytes(headers[i].length * 2);
            for (uint256 j; j < headers[i].length; ++j) {
                encoded[j * 2] = alphabet[uint8(headers[i][j]) >> 4];
                encoded[j * 2 + 1] = alphabet[uint8(headers[i][j]) & 15];
            }
            json = bytes.concat(json, i == 0 ? bytes('"0x') : bytes(',"0x'), encoded, bytes('"'));
        }
        vm.setEnv("BLOCKART_HEADERS_JSON", string(bytes.concat(json, bytes("]}"))));
    }

    function validate(BlockArtRenderer renderer, BlockArtNFT nft) private view {
        require(nft.totalSupply() == 1 && nft.ownerOf(5254696) != address(0), "Missing first mint");
        require(
            keccak256(bytes(nft.name())) == keccak256("blocks")
                && keccak256(bytes(nft.symbol())) == keccak256("blocks"),
            "Wrong collection"
        );
        require(address(nft.renderer()) == address(renderer), "Wrong renderer");
        for (uint256 i; i < 8; ++i) {
            for (uint256 j = i + 1; j < 8; ++j) {
                require(renderer.sceneAddress(i) != renderer.sceneAddress(j), "Repeated scene slot");
            }
        }
    }

    function testBaseDeploymentRehearsal() public {
        prepare();
        vm.chainId(8453);
        (BlockArtRenderer renderer, BlockArtNFT nft) = new DeployBlockArtBase().run();
        validate(renderer, nft);
    }

    function testBaseSepoliaDeploymentRehearsal() public {
        prepare();
        vm.chainId(84532);
        (BlockArtRenderer renderer, BlockArtNFT nft) = new DeployBlockArtBaseSepolia().run();
        validate(renderer, nft);
    }

    function testDeploymentRejectsOtherChainBeforeReadingEnvironment() public {
        vm.chainId(11155111);
        DeployBlockArtBase script = new DeployBlockArtBase();
        vm.expectRevert(abi.encodeWithSelector(DeployBlockArt.WrongChain.selector));
        script.run();
    }
}
