// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockVideoNFTV4} from "../../src/blockart/BlockVideoNFTV4.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
import {BlockVideoRendererV4} from "../../src/blockart/BlockVideoRendererV4.sol";
import {VideoRecipeV3} from "../../src/blockart/VideoRecipeV3.sol";
import {BlocksHud} from "../../src/blockart/BlocksHud.sol";
import {BlocksBandsV4} from "../../src/blockart/BlocksBandsV4.sol";
import {BlockExtras} from "../../src/blockart/BlockExtras.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {DescentV3} from "../../src/blockart/scenes/DescentV3.sol";
import {Monorail} from "../../src/blockart/scenes/Monorail.sol";
import {Spire} from "../../src/blockart/scenes/Spire.sol";
import {Skyline} from "../../src/blockart/scenes/Skyline.sol";
import {Alley} from "../../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../../src/blockart/scenes/Satoyama.sol";

interface VideoV4Vm {
    function etch(address, bytes calldata) external;
    function setBlockhash(uint256, bytes32) external;
    function envOr(string calldata, string calldata) external returns (string memory);
    function roll(uint256) external;
    function warp(uint256) external;
    function fee(uint256) external;
    function coinbase(address) external;
    function prevrandao(bytes32) external;
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function createDir(string calldata, bool) external;
    function writeFile(string calldata, string calldata) external;
    function writeFileBinary(string calldata, bytes calldata) external;
    function toString(uint256) external pure returns (string memory);
}

/// @dev Stands in for Base's L1Block predeploy, with values read from Base on 2026-10-19.
contract L1BlockMock {
    function number() external pure returns (uint64) {
        return 26226812;
    }

    function hash() external pure returns (bytes32) {
        return 0x291518b4a194aab123c0c2d4cf5f6ff9f8025d5e6673cec7108deeb88038f8ac;
    }

    function basefee() external pure returns (uint256) {
        return 100256339;
    }

    function blobBaseFee() external pure returns (uint256) {
        return 5365424;
    }
}

contract BlockVideoV4MediaTest {
    VideoV4Vm constant vm = VideoV4Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event log_named_uint(string key, uint256 val);

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function _info(uint256 wanted, uint256 start) private view returns (SingleBlockData.Info memory b) {
        b = SingleBlockData.Info(
            52811146, 1792411290, block.gaslimit, 5000000, 0, 0x4200000000000000000000000000000000000011, 8453
        );
        for (uint256 n = start; n < start + 10000; ++n) {
            b.prevrandao = n;
            uint256 h = uint256(VideoRecipeV3.seed(b));
            uint256 s = ((h >> 216) & 255) < 4 ? 7 : (h >> 224) % 7;
            if (s == wanted) return b;
        }
        revert("Scene search exhausted");
    }

    function _extrasJson(BlockExtras.Extras memory x) private view returns (string memory) {
        return string.concat(
            ',"parentHash":"',
            vm.toString(uint256(x.parentHash)),
            '","blobBaseFee":',
            vm.toString(x.blobBaseFee),
            ',"l1Number":',
            vm.toString(x.l1Number),
            ',"l1Hash":"',
            vm.toString(uint256(x.l1Hash)),
            '","l1BaseFee":',
            vm.toString(x.l1BaseFee)
        );
    }

    function _measure(address scene, string memory name, uint256 wanted) private {
        SingleBlockData.Info memory b = _info(wanted, 1);
        vm.roll(b.number);
        vm.warp(b.timestamp);
        vm.chainId(b.chainId);
        vm.fee(b.baseFee);
        vm.coinbase(b.beneficiary);
        vm.prevrandao(bytes32(b.prevrandao));
        address[8] memory slots = [scene, scene, scene, scene, scene, scene, scene, scene];
        BlockArtRenderer base = new BlockArtRenderer(slots);
        BlockVideoRendererV4 renderer = new BlockVideoRendererV4(base, new BlocksBandsV4());
        require(address(renderer).code.length <= 24576, "Renderer exceeds EIP-170");
        BlockVideoNFTV4 nft = new BlockVideoNFTV4(renderer);
        require(address(nft).code.length <= 24576, "NFT exceeds EIP-170");
        vm.etch(BlockExtras.L1_BLOCK, address(new L1BlockMock()).code);
        vm.setBlockhash(b.number - 1, keccak256(abi.encode("parent", b.number)));
        uint256 id = nft.mint();
        BlockExtras.Extras memory x = nft.extrasOf(id);
        require(x.l1Number == 26226812 && x.parentHash != bytes32(0), "Extras not captured");
        b = nft.blockData(id);
        require(nft.sceneOf(id) == wanted, "Selected scene differs from measured scene");
        string memory output = vm.envOr("BLOCKS_VIDEO_V4_OUTPUT", string("previews/blocks-video-v4"));
        vm.createDir(output, true);
        string memory stem = string.concat(output, "/", name);
        uint256 before = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.tokenURI, (id)));
        uint256 used = before - gasleft();
        require(ok && used <= 500000000, "Metadata exceeds cap");
        vm.writeFile(string.concat(stem, ".uri"), abi.decode(result, (string)));
        emit log_named_uint(string.concat(name, " complete metadata gas"), used);
        (ok, result) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.video, (id)));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".avi"), abi.decode(result, (bytes)));
        (ok, result) = address(base).staticcall{gas: 500000000}(abi.encodeCall(base.avi, (VideoRecipeV3.artwork(b))));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".reference.avi"), abi.decode(result, (bytes)));
        VideoRecipeV3.Recipe memory r = VideoRecipeV3.recipe(b);
        vm.writeFile(
            string.concat(stem, ".json"),
            string.concat(
                '{"metadata_gas":',
                vm.toString(used),
                ',"scene":',
                vm.toString(wanted),
                ',"hue":',
                vm.toString(r.hue),
                ',"saturation":',
                vm.toString(r.saturation),
                ',"heightBand":',
                vm.toString(r.heightBand),
                ',"density":',
                vm.toString(r.density),
                ',"layout":',
                vm.toString(r.layout),
                _extrasJson(x),
                ',"number":',
                vm.toString(b.number),
                ',"timestamp":',
                vm.toString(b.timestamp),
                ',"gasLimit":',
                vm.toString(b.gasLimit),
                ',"baseFee":',
                vm.toString(b.baseFee),
                ',"prevrandao":"',
                vm.toString(b.prevrandao),
                '","beneficiary":"',
                vm.toString(uint256(uint160(b.beneficiary))),
                '","chainId":',
                vm.toString(b.chainId),
                ',"tint":"',
                vm.toString(uint256(r.tint)),
                '"',
                ',"reverse":',
                r.reverse ? "true" : "false",
                ',"phase":',
                vm.toString(r.phase),
                "}"
            )
        );
    }

    function testVideoCanyon() public {
        _measure(address(new Canyon()), "canyon", 0);
    }

    function testVideoDescent() public {
        _measure(address(new DescentV3()), "descent", 1);
    }

    function testVideoMonorail() public {
        _measure(address(new Monorail()), "monorail", 2);
    }

    function testVideoSpire() public {
        _measure(address(new Spire()), "spire", 3);
    }

    function testVideoSkyline() public {
        _measure(address(new Skyline()), "skyline", 4);
    }

    function testVideoAlley() public {
        _measure(address(new Alley()), "alley", 5);
    }

    function testVideoNightTrain() public {
        _measure(address(new NightTrain()), "nighttrain", 6);
    }

    function testVideoSatoyama() public {
        _measure(address(new Satoyama()), "satoyama", 7);
    }
}

contract BlocksHudTest {
    function testFormatsBlockData() public pure {
        require(keccak256(BlocksHud.grouped(52811146)) == keccak256("52,811,146"), "grouping");
        require(keccak256(BlocksHud.grouped(400)) == keccak256("400"), "short grouping");
        require(keccak256(BlocksHud.gas(400000000)) == keccak256("400M"), "gas millions");
        require(keccak256(BlocksHud.gas(29999972)) == keccak256("29,999,972"), "gas exact");
        require(keccak256(BlocksHud.fee(5000000)) == keccak256("0.005 GWEI"), "base fee");
        require(keccak256(BlocksHud.fee(15)) == keccak256("15 WEI"), "tiny fee");
        require(keccak256(BlocksHud.fee(12345678901)) == keccak256("12.345 GWEI"), "large fee");
        (uint256 y, uint256 m, uint256 d) = BlocksHud.date(1792411290);
        require(y == 2026 && m == 10 && d == 19, "date");
        (y, m, d) = BlocksHud.date(951782400); // 2000-02-29
        require(y == 2000 && m == 2 && d == 29, "leap day");
        require(keccak256(BlocksHud.clock(1792411290)) == keccak256("12:01:30"), "clock");
    }
}
