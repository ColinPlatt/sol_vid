// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockArtNFT} from "../../src/blockart/BlockArtNFT.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {BlockHeaders} from "../../src/blockart/BlockHeaders.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {BaseEpochs} from "./BaseEpochs.sol";
import {HeaderHarness} from "./BlockArt.t.sol";

interface RulesVm {
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function expectRevert(bytes calldata) external;
    function prank(address) external;
}

contract UnusedScene {}

contract RejectEpoch {
    function mint(BlockArtNFT nft, bytes[] memory headers) external {
        nft.mint(5254696, headers);
    }
}

contract ReenterEpoch {
    bool public blocked;

    function mint(BlockArtNFT nft, bytes[] memory headers) external {
        nft.mint(5254696, headers);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        try BlockArtNFT(msg.sender).mint(5254696, BaseEpochs.epoch5254696()) {
            revert("Reentry succeeded");
        } catch (bytes memory reason) {
            require(bytes4(reason) == BlockArtNFT.AlreadyMinted.selector, "Unexpected reentry failure");
            blocked = true;
        }
        return this.onERC721Received.selector;
    }
}

contract EpochRulesTest {
    using Epoch for bytes;
    RulesVm constant vm = RulesVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    BlockArtNFT nft;
    BlockArtRenderer renderer;

    function setUp() public {
        address[8] memory scenes;
        for (uint256 i; i < 8; ++i) {
            scenes[i] = address(new UnusedScene());
        }
        renderer = new BlockArtRenderer(scenes);
        nft = new BlockArtNFT(renderer);
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
    }

    function testCollectionNameAndSymbol() public view {
        require(keccak256(bytes(nft.name())) == keccak256("blocks"), "Collection name");
        require(keccak256(bytes(nft.symbol())) == keccak256("blocks"), "Collection symbol");
    }

    function testAllSceneBucketsAndRareByte() public view {
        bytes memory e = new bytes(3520);
        for (uint256 i; i < 7; ++i) {
            uint256 h = (i << 224) | (uint256(4) << 216);
            assembly ("memory-safe") { mstore(add(add(e, 32), add(mul(9, 352), 32)), h) }
            require(renderer.sceneOf(e) == i, "Regular scene mapping");
            require(renderer.sceneAddress(i).code.length > 0, "Missing scene");
        }
        for (uint256 b; b < 4; ++b) {
            uint256 h = (uint256(12345) << 224) | (b << 216);
            assembly ("memory-safe") { mstore(add(add(e, 32), add(mul(9, 352), 32)), h) }
            require(renderer.sceneOf(e) == 7, "Rare byte mapping");
        }
    }

    function testOldEpochRejectsAndWindowBoundaryAccepts() public {
        vm.roll(52546969 + 257);
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.UnknownBlockHash.selector));
        nft.mint(5254696, BaseEpochs.epoch5254696());
        vm.roll(52546969 + 256);
        nft.mint(5254696, BaseEpochs.epoch5254696());
        require(nft.ownerOf(5254696) == address(this), "Boundary owner");
    }

    function testFutureEpochRejects() public {
        vm.roll(52546969);
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.UnknownBlockHash.selector));
        nft.mint(5254696, BaseEpochs.epoch5254696());
    }

    function testWrongCountRejects() public {
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.BadHeader.selector));
        nft.mint(5254696, new bytes[](9));
    }

    function testWrongEpochNumberRejects() public {
        vm.roll(52546980);
        vm.setBlockhash(52546979, BaseEpochs.LAST_HASH_5254696);
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.WrongBlock.selector, 9));
        nft.mint(5254697, BaseEpochs.epoch5254696());
    }

    function testReceiverRejectionRollsBackAndReentryBlocked() public {
        RejectEpoch rejector = new RejectEpoch();
        (bool ok,) = address(rejector).call(abi.encodeCall(rejector.mint, (nft, BaseEpochs.epoch5254696())));
        require(!ok && nft.totalSupply() == 0, "Rejected mint persisted");
        ReenterEpoch receiver = new ReenterEpoch();
        receiver.mint(nft, BaseEpochs.epoch5254696());
        require(receiver.blocked() && nft.totalSupply() == 1, "Reentry guard/state");
    }

    function testTransferAndStoredDataSurviveExpiredHeaders() public {
        nft.mint(5254696, BaseEpochs.epoch5254696());
        bytes32 beforeHash = keccak256(nft.epochData(5254696));
        nft.transferFrom(address(this), address(0xBEEF), 5254696);
        vm.roll(52547970);
        require(keccak256(nft.epochData(5254696)) == beforeHash, "Mutable data");
        require(nft.ownerOf(5254696) == address(0xBEEF), "Transfer owner");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
