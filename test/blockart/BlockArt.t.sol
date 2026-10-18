// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BlockHeaders} from "../../src/blockart/BlockHeaders.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {GifWriter} from "../../src/blockart/GifWriter.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {SceneKit} from "../../src/blockart/SceneBase.sol";
import {BaseEpochs} from "./BaseEpochs.sol";
import {BlockArtNFT} from "../../src/blockart/BlockArtNFT.sol";
import {BlockArtRenderer, IBlockScene} from "../../src/blockart/BlockArtRenderer.sol";

contract HeaderHarness {
    function verify(uint256 epoch, bytes[] memory headers) external view returns (bytes memory) {
        return BlockHeaders.verifyEpoch(epoch, headers);
    }

    function decode(bytes memory raw) external pure returns (BlockHeaders.Header memory) {
        return BlockHeaders.decode(raw);
    }
}

interface Vm {
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function expectRevert(bytes calldata) external;
    function writeFileBinary(string calldata path, bytes calldata data) external;
}

contract BlockArtTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant BUDGET = 500_000_000;

    event log_named_uint(string key, uint256 val);

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "not equal");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "not equal");
    }

    function assertGt(uint256 a, uint256 b) internal pure {
        require(a > b, "not greater");
    }

    function assertTrue(bool v, string memory why) internal pure {
        require(v, why);
    }
    HeaderHarness internal harness;

    function setUp() public {
        harness = new HeaderHarness();
    }

    function _epoch() internal returns (bytes memory) {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        return harness.verify(5254696, BaseEpochs.epoch5254696());
    }

    function test_decodesBaseHeader() public view {
        BlockHeaders.Header memory h = harness.decode(BaseEpochs.epoch5254696()[9]);
        assertEq(h.hash, BaseEpochs.LAST_HASH_5254696);
        assertEq(h.number, 52546969);
        assertGt(h.gasLimit, 0);
        assertGt(h.gasUsed, 0);
    }

    function test_verifiesEpoch() public {
        bytes memory e = _epoch();
        assertEq(e.length, BlockHeaders.EPOCH_BYTES);
        for (uint256 i; i < 10; ++i) {
            assertEq(Epoch.number(e, i), 52546960 + i);
        }
        assertEq(bytes32(Epoch.hash(e, 9)), BaseEpochs.LAST_HASH_5254696);
    }

    function test_rejectsTamperedHeader() public {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        bytes[] memory h = BaseEpochs.epoch5254696();
        h[3][100] = bytes1(uint8(h[3][100]) ^ 1);
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.BrokenChain.selector, 3));
        harness.verify(5254696, h);
    }

    function test_rejectsUnknownBlockHash() public {
        vm.roll(52546969); // the epoch's last block is not yet in the past
        vm.expectRevert(abi.encodeWithSelector(BlockHeaders.UnknownBlockHash.selector));
        harness.verify(5254696, BaseEpochs.epoch5254696());
    }

    function test_canyonFitsBudget() public {
        bytes memory e = _epoch();
        Canyon canyon = new Canyon();
        uint256 before = gasleft();
        (bool ok, bytes memory ret) = address(canyon).staticcall{gas: BUDGET}(abi.encodeCall(IBlockScene.gif, (e)));
        uint256 used = before - gasleft();
        assertTrue(ok, "render reverted or ran out of the 500M budget");
        bytes memory out = abi.decode(ret, (bytes));
        emit log_named_uint("canyon gif bytes", out.length);
        emit log_named_uint("canyon staticcall gas", used);
        assertEq(out.length, GifWriter.size(90));
        assertEq(uint8(out[0]), 0x47);
        assertEq(uint8(out[out.length - 1]), 0x3b);
        vm.writeFileBinary("previews/blockart-canyon.gif", out);
    }
}

interface VmWrite {
    function writeFile(string calldata path, string calldata data) external;
}

contract BlockArtNFTTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant BUDGET = 500_000_000;

    event log_named_uint(string key, uint256 val);

    BlockArtNFT internal nft;

    function setUp() public {
        address canyon = address(new Canyon());
        address[8] memory scenes = [canyon, canyon, canyon, canyon, canyon, canyon, canyon, canyon];
        nft = new BlockArtNFT(new BlockArtRenderer(scenes));
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
    }

    function test_mintStoresEpochAndRendersUnderBudget() public {
        uint256 g = gasleft();
        nft.mint(5254696, BaseEpochs.epoch5254696());
        emit log_named_uint("mint gas", g - gasleft());
        require(nft.ownerOf(5254696) == address(this), "owner");
        require(nft.totalSupply() == 1, "supply");
        require(Epoch.number(nft.epochData(5254696), 9) == 52546969, "data");

        g = gasleft();
        (bool ok, bytes memory ret) = address(nft).staticcall{gas: BUDGET}(abi.encodeCall(nft.tokenURI, (5254696)));
        emit log_named_uint("tokenURI staticcall gas", g - gasleft());
        require(ok, "tokenURI reverted or exceeded 500M");
        string memory uri = abi.decode(ret, (string));
        emit log_named_uint("tokenURI bytes", bytes(uri).length);
        VmWrite(address(vm)).writeFile("previews/blockart-token.uri", uri);

        g = gasleft();
        (ok, ret) = address(nft).staticcall{gas: BUDGET}(abi.encodeCall(nft.gif, (5254696)));
        emit log_named_uint("gif staticcall gas", g - gasleft());
        require(ok, "gif");
        vm.writeFileBinary("previews/blockart-token.gif", abi.decode(ret, (bytes)));
    }

    function test_epochMintsOnce() public {
        nft.mint(5254696, BaseEpochs.epoch5254696());
        vm.expectRevert(abi.encodeWithSelector(BlockArtNFT.AlreadyMinted.selector));
        nft.mint(5254696, BaseEpochs.epoch5254696());
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
