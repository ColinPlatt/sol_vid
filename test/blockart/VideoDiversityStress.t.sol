// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoRecipeV3} from "../../src/blockart/VideoRecipeV3.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
import {BlockVideoRendererV3} from "../../src/blockart/BlockVideoRendererV3.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {InPlace} from "../../src/blockart/InPlace.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {DescentV3} from "../../src/blockart/scenes/DescentV3.sol";
import {Monorail} from "../../src/blockart/scenes/Monorail.sol";
import {Spire} from "../../src/blockart/scenes/Spire.sol";
import {Skyline} from "../../src/blockart/scenes/Skyline.sol";
import {Alley} from "../../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../../src/blockart/scenes/Satoyama.sol";

interface StressVm {
    function skip(bool) external;
    function envOr(string calldata, bool) external returns (bool);
    function readFile(string calldata) external returns (string memory);
    function parseJsonUint(string calldata, string calldata) external pure returns (uint256);
    function toString(uint256) external pure returns (string memory);
    function writeFile(string calldata, string calldata) external;
    function writeFileBinary(string calldata, bytes calldata) external;
    function createDir(string calldata, bool) external;
}

/// @dev Mirrors the NFT's ABI forwarding/copy path for fixed audit Info; no mint or storage render.
contract DiversityStressProxy {
    BlockVideoRendererV3 public immutable renderer;

    constructor(BlockVideoRendererV3 r) {
        renderer = r;
    }

    function tokenURI(SingleBlockData.Info memory info) external view returns (string memory) {
        InPlace.forward(address(renderer), abi.encodeCall(renderer.tokenURI, (info)));
    }
}

contract VideoDiversityStressTest {
    using Epoch for bytes;
    StressVm constant vm = StressVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event log_named_uint(string key, uint256 value);
    BlockVideoRendererV3 renderer;
    DiversityStressProxy proxy;

    function setUp() public {
        if (!vm.envOr("BLOCKS_DIVERSITY_STRESS", false)) return;
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
        renderer = new BlockVideoRendererV3(new BlockArtRenderer(slots));
        proxy = new DiversityStressProxy(renderer);
    }

    function _stress(uint256 slot) private {
        if (!vm.envOr("BLOCKS_DIVERSITY_STRESS", false)) {
            vm.skip(true);
            return;
        }
        uint256 index = vm.parseJsonUint(
            vm.readFile("previews/blocks-diversity-v3/stress-seeds.json"),
            string.concat(".indices[", vm.toString(slot), "]")
        );
        SingleBlockData.Info memory info =
            SingleBlockData.Info(13000000, 1800000000, 60000000, 20, index + 1, address(0xBEEF), 11155111);
        VideoRecipeV3.Recipe memory r = VideoRecipeV3.recipe(info);
        uint256 scene = VideoRecipeV3.artwork(info).scene();
        string memory stem = string.concat("previews/ARCHIVE/blocks-video-v3/stress-", vm.toString(slot));
        vm.createDir("previews/ARCHIVE/blocks-video-v3", true);
        uint256 before = gasleft();
        (bool ok, bytes memory result) =
            address(proxy).staticcall{gas: 500000000}(abi.encodeCall(proxy.tokenURI, (info)));
        uint256 used = before - gasleft();
        require(ok && used < 499000000, "Stress metadata exceeds gas margin");
        vm.writeFile(string.concat(stem, ".uri"), abi.decode(result, (string)));
        emit log_named_uint("stress metadata gas", used);
        vm.writeFileBinary(string.concat(stem, ".reference.avi"), renderer.scenes().avi(VideoRecipeV3.artwork(info)));
        vm.writeFile(
            string.concat(stem, ".json"),
            string.concat(
                '{"index":',
                vm.toString(index),
                ',"metadata_gas":',
                vm.toString(used),
                ',"scene":',
                vm.toString(scene),
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
                ',"crop":',
                vm.toString(r.crop),
                ',"pan":',
                vm.toString(r.pan),
                ',"mirror":',
                r.mirror ? "true" : "false",
                ',"reverse":',
                r.reverse ? "true" : "false",
                ',"phase":',
                vm.toString(r.phase),
                ',"tint":"',
                vm.toString(uint256(r.tint)),
                '"}'
            )
        );
    }

    function testStress00() public {
        _stress(0);
    }

    function testStress01() public {
        _stress(1);
    }

    function testStress02() public {
        _stress(2);
    }

    function testStress03() public {
        _stress(3);
    }

    function testStress04() public {
        _stress(4);
    }

    function testStress05() public {
        _stress(5);
    }

    function testStress06() public {
        _stress(6);
    }

    function testStress07() public {
        _stress(7);
    }

    function testStress08() public {
        _stress(8);
    }

    function testStress09() public {
        _stress(9);
    }

    function testStress10() public {
        _stress(10);
    }

    function testStress11() public {
        _stress(11);
    }

    function testStress12() public {
        _stress(12);
    }

    function testStress13() public {
        _stress(13);
    }

    function testStress14() public {
        _stress(14);
    }

    function testStress15() public {
        _stress(15);
    }
}
