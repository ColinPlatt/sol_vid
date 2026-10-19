// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BlockHeaders} from "../../src/blockart/BlockHeaders.sol";
import {GifWriter} from "../../src/blockart/GifWriter.sol";
import {BlockArtNFT} from "../../src/blockart/BlockArtNFT.sol";
import {BlockArtRenderer, IBlockScene} from "../../src/blockart/BlockArtRenderer.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {Descent} from "../../src/blockart/scenes/Descent.sol";
import {Monorail} from "../../src/blockart/scenes/Monorail.sol";
import {Spire} from "../../src/blockart/scenes/Spire.sol";
import {Skyline} from "../../src/blockart/scenes/Skyline.sol";
import {Alley} from "../../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../../src/blockart/scenes/Satoyama.sol";

import {BaseEpochs} from "./BaseEpochs.sol";
import {SceneKit} from "../../src/blockart/SceneBase.sol";

interface SceneVm {
    function load(address target, bytes32 slot) external view returns (bytes32);
    function etch(address target, bytes calldata code) external;
    function createDir(string calldata path, bool recursive) external;
    function writeFile(string calldata path, string calldata data) external;
    function toString(uint256 value) external pure returns (string memory);
    function envOr(string calldata key, string calldata defaultValue) external view returns (string memory);
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function writeFileBinary(string calldata path, bytes calldata data) external;
}

/// @notice Every scene, rendered from the real Base epoch 5254696: its GIF and its complete tokenURI, each inside a
///         STATICCALL capped at the 500M budget. Writes previews/blockart-<scene>.gif.
abstract contract BlockArtScenesTest {
    SceneVm internal constant vm = SceneVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant BUDGET = 500_000_000;

    event log_named_uint(string key, uint256 val);

    function setUp() public {
        vm.createDir("previews/ARCHIVE/blockart", true);
    }

    function _measure(address scene, string memory name) internal {
        require(scene.code.length <= 24576, "Scene runtime too large");
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        bytes[] memory headers = BaseEpochs.epoch5254696();
        bytes memory e = BlockHeaders.verifyEpoch(5254696, headers);
        string memory stem = string.concat("previews/ARCHIVE/blockart/", name);
        uint256 g = gasleft();
        (bool ok, bytes memory ret) = scene.staticcall{gas: BUDGET}(abi.encodeCall(IBlockScene.gif, (e)));
        uint256 gifGas = g - gasleft();
        require(ok && gifGas <= BUDGET, "gif exceeded the 500M budget");
        bytes memory out = abi.decode(ret, (bytes));
        require(out.length == GifWriter.size(90), "GIF size");
        vm.writeFileBinary(string.concat(stem, ".gif"), out);
        address[8] memory scenes = [scene, scene, scene, scene, scene, scene, scene, scene];
        BlockArtNFT nft = new BlockArtNFT(new BlockArtRenderer(scenes));
        nft.mint(5254696, headers);
        g = gasleft();
        (ok, ret) = address(nft).staticcall{gas: BUDGET}(abi.encodeCall(nft.tokenURI, (5254696)));
        uint256 uriGas = g - gasleft();
        require(ok && uriGas <= BUDGET, "tokenURI exceeded the 500M budget");
        string memory uri = abi.decode(ret, (string));
        vm.writeFile(string.concat(stem, ".uri"), uri);
        g = gasleft();
        (ok, ret) = address(nft).staticcall{gas: BUDGET}(abi.encodeCall(nft.avi, (5254696)));
        uint256 aviGas = g - gasleft();
        require(ok && aviGas <= BUDGET, "AVI exceeded the 500M budget");
        bytes memory avi = abi.decode(ret, (bytes));
        vm.writeFileBinary(string.concat(stem, ".avi"), avi);
        vm.writeFile(
            string.concat(stem, ".json"),
            string.concat(
                '{"profile":"',
                vm.envOr("FOUNDRY_PROFILE", string("default")),
                '","epoch":5254696,"gif_gas":',
                vm.toString(gifGas),
                ',"gif_bytes":',
                vm.toString(out.length),
                ',"avi_gas":',
                vm.toString(aviGas),
                ',"avi_bytes":',
                vm.toString(avi.length),
                ',"token_uri_gas":',
                vm.toString(uriGas),
                ',"token_uri_bytes":',
                vm.toString(bytes(uri).length),
                ',"runtime_bytes":',
                vm.toString(scene.code.length),
                "}"
            )
        );
        emit log_named_uint(string.concat(name, " GIF gas"), gifGas);
        emit log_named_uint(string.concat(name, " AVI gas"), aviGas);
        emit log_named_uint(string.concat(name, " tokenURI gas"), uriGas);
    }

    function _stress(address scene, string memory name) internal {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        address[8] memory slots = [scene, scene, scene, scene, scene, scene, scene, scene];
        BlockArtNFT nft = new BlockArtNFT(new BlockArtRenderer(slots));
        nft.mint(5254696, BaseEpochs.epoch5254696());
        // ERC721 slots 0..5, totalSupply 6, _data mapping 7. Confirm the pointer layout before test-only replacement.
        address ptr =
            address(uint160(uint256(vm.load(address(nft), keccak256(abi.encode(uint256(5254696), uint256(7)))))));
        bytes memory e = nft.epochData(5254696);
        require(keccak256(ptr.code) == keccak256(bytes.concat(hex"00", e)), "Data pointer layout changed");
        for (uint256 i; i < 10; ++i) {
            uint256 meta = ((52546960 + i) << 192) | (uint256(30000000) << 128) | (uint256(30000000) << 64) | 1700000000;
            assembly ("memory-safe") {
                let p := add(add(e, 32), mul(i, 352))
                mstore(p, meta)
                for { let off := 32 } lt(off, 352) { off := add(off, 32) } { mstore(add(p, off), not(0)) }
            }
        }
        vm.etch(ptr, bytes.concat(hex"00", e));
        uint256 g = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: BUDGET}(abi.encodeCall(nft.tokenURI, (5254696)));
        uint256 used = g - gasleft();
        require(ok && used <= BUDGET, "Dense synthetic metadata exceeds budget");
        emit log_named_uint(string.concat(name, " dense metadata gas"), used);
        vm.writeFile(
            string.concat("previews/ARCHIVE/blockart/", name, ".stress.json"),
            string.concat(
                '{"data_kind":"synthetic full bloom/hash/state and full gas usage","profile":"',
                vm.envOr("FOUNDRY_PROFILE", string("default")),
                '","gas":',
                vm.toString(used),
                ',"abi_bytes":',
                vm.toString(result.length),
                "}"
            )
        );
    }

    function _frames(address scene, string memory name) internal {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        bytes memory e = BlockHeaders.verifyEpoch(5254696, BaseEpochs.epoch5254696());
        string memory stem = string.concat("previews/ARCHIVE/blockart/", name);
        bool ok;
        bytes memory ret;
        bytes memory all = new bytes(90 * 16384);
        for (uint256 f; f < 90; ++f) {
            (ok, ret) = scene.staticcall(abi.encodeWithSignature("frame(bytes,uint256)", e, f));
            require(ok, "Raw frame reverted");
            (bytes memory pixels, bytes memory palette) = abi.decode(ret, (bytes, bytes));
            assembly ("memory-safe") { mcopy(add(add(all, 32), mul(f, 16384)), add(pixels, 32), 16384) }
            if (f == 0) {
                vm.writeFileBinary(string.concat(stem, ".palette"), palette);
                (ok, ret) = scene.staticcall(abi.encodeWithSignature("frame(bytes,uint256)", e, 90));
                require(ok, "Loop boundary reverted");
                (bytes memory repeated,) = abi.decode(ret, (bytes, bytes));
                require(keccak256(pixels) == keccak256(repeated), "Loop boundary differs");
            }
        }
        vm.writeFileBinary(string.concat(stem, ".raw"), all);
    }

    /// @dev One frame through SceneBase.frame: gas per frame (x90 approximates drawing cost) and a raw dump.
    function _probe(address scene, string memory name, uint256 f) internal {
        vm.roll(52546970);
        vm.setBlockhash(52546969, BaseEpochs.LAST_HASH_5254696);
        bytes memory e = BlockHeaders.verifyEpoch(5254696, BaseEpochs.epoch5254696());
        uint256 g = gasleft();
        (bool ok, bytes memory ret) =
            scene.staticcall{gas: 400_000_000}(abi.encodeWithSignature("frame(bytes,uint256)", e, f));
        emit log_named_uint(string.concat(name, " frame gas"), g - gasleft());
        require(ok, "frame");
        (bytes memory buf, bytes memory pal) = abi.decode(ret, (bytes, bytes));
        vm.writeFileBinary(string.concat("previews/blockart-", name, ".raw"), bytes.concat(pal, buf));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract CanyonSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Canyon()), "canyon");
    }

    function test_render() public {
        _measure(address(new Canyon()), "canyon");
    }

    function test_frames() public {
        _frames(address(new Canyon()), "canyon");
    }
}

contract DescentSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Descent()), "descent");
    }

    function test_render() public {
        _measure(address(new Descent()), "descent");
    }

    function test_frames() public {
        _frames(address(new Descent()), "descent");
    }
}

contract MonorailSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Monorail()), "monorail");
    }

    function test_render() public {
        _measure(address(new Monorail()), "monorail");
    }

    function test_frames() public {
        _frames(address(new Monorail()), "monorail");
    }
}

contract SpireSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Spire()), "spire");
    }

    function test_render() public {
        _measure(address(new Spire()), "spire");
    }

    function test_frames() public {
        _frames(address(new Spire()), "spire");
    }
}

contract SkylineSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Skyline()), "skyline");
    }

    function test_render() public {
        _measure(address(new Skyline()), "skyline");
    }

    function test_frames() public {
        _frames(address(new Skyline()), "skyline");
    }
}

contract AlleySceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Alley()), "alley");
    }

    function test_render() public {
        _measure(address(new Alley()), "alley");
    }

    function test_frames() public {
        _frames(address(new Alley()), "alley");
    }
}

contract NightTrainSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new NightTrain()), "nighttrain");
    }

    function test_render() public {
        _measure(address(new NightTrain()), "nighttrain");
    }

    function test_frames() public {
        _frames(address(new NightTrain()), "nighttrain");
    }
}

contract SatoyamaSceneTest is BlockArtScenesTest {
    function test_stress() public {
        _stress(address(new Satoyama()), "satoyama");
    }

    function test_render() public {
        _measure(address(new Satoyama()), "satoyama");
    }

    function test_frames() public {
        _frames(address(new Satoyama()), "satoyama");
    }
}
