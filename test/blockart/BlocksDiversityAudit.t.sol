// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoRecipeV3} from "../../src/blockart/VideoRecipeV3.sol";
import {AviVariationV3} from "../../src/blockart/AviVariationV3.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
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

interface DiversityVm {
    function envOr(string calldata, uint256) external returns (uint256);
    function envOr(string calldata, bool) external returns (bool);
    function createDir(string calldata, bool) external;
    function writeFileBinary(string calldata, bytes calldata) external;
    function readFileBinary(string calldata) external returns (bytes memory);
    function toString(uint256) external pure returns (string memory);
}

interface DiversityScene {
    function frame(bytes memory, uint256) external view returns (bytes memory, bytes memory);
}

contract DiversityFrame {
    using Epoch for bytes;
    BlockArtRenderer public immutable scenes;

    constructor(BlockArtRenderer s) {
        scenes = s;
    }

    function canonical(uint256 index) external view returns (uint256 scene, bytes memory raw, bytes memory pal) {
        SingleBlockData.Info memory info =
            SingleBlockData.Info(13000000, 1800000000, 60000000, 20, index + 1, address(0xBEEF), 11155111);
        bytes memory e = VideoRecipeV3.artwork(info);
        scene = e.scene();
        (raw, pal) = DiversityScene(scenes.sceneAddress(scene)).frame(e, 0);
        (raw, pal) = AviVariationV3.frame(raw, pal, VideoRecipeV3.recipe(info), scene);
    }
}

/// @notice Opt-in 100k actual Solidity-frame audit. Default unit runs do not regenerate the corpus.
abstract contract BlocksDiversityAuditBase {
    DiversityVm constant vm = DiversityVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    DiversityFrame renderer;

    function setUp() public {
        if (!vm.envOr("BLOCKS_DIVERSITY_EXPORT", false)) return;
        address[8] memory slots;
        slots[0] = address(new Canyon());
        slots[1] = address(new DescentV3());
        slots[2] = address(new Monorail());
        slots[3] = address(new Spire());
        slots[4] = address(new Skyline());
        slots[5] = address(new Alley());
        slots[6] = address(new NightTrain());
        slots[7] = address(new Satoyama());
        renderer = new DiversityFrame(new BlockArtRenderer(slots));
    }

    function _batch(uint256 batch) internal {
        if (!vm.envOr("BLOCKS_DIVERSITY_EXPORT", false)) return;
        uint256 count = vm.envOr("BLOCKS_DIVERSITY_COUNT", uint256(100000));
        uint256 start = batch * 192;
        if (start >= count) return;
        uint256 n = count - start;
        if (n > 192) n = 192;
        bool tunnelOnly = vm.envOr("BLOCKS_DIVERSITY_TUNNEL_ONLY", false);
        string memory output = string.concat("previews/blocks-diversity-v3/raw/", vm.toString(batch), ".bin");
        bytes memory bundle = tunnelOnly ? vm.readFileBinary(output) : new bytes(n * 17153);
        require(bundle.length == n * 17153);

        for (uint256 k; k < n; ++k) {
            if (tunnelOnly && uint8(bundle[k * 17153]) != 1) continue;
            (uint256 scene, bytes memory raw, bytes memory pal) = renderer.canonical(start + k);
            require(raw.length == 16384 && pal.length == 768);
            uint256 dst;
            assembly ("memory-safe") {
                dst := add(add(bundle, 32), mul(k, 17153))
                mstore8(dst, scene)
                mcopy(add(dst, 1), add(pal, 32), 768)
                mcopy(add(dst, 769), add(raw, 32), 16384)
            }
        }
        vm.createDir("previews/blocks-diversity-v3/raw", true);
        vm.writeFileBinary(string.concat("previews/blocks-diversity-v3/raw/", vm.toString(batch), ".bin"), bundle);
    }
}
