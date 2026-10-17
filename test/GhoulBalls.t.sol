// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SolVideo} from "../src/SolVideo.sol";
import {MpegVideo} from "../src/MpegVideo.sol";
import {Scene} from "../src/Scene.sol";
import {Vm} from "./SolVideo.t.sol";

contract BallsFrameHarness is Scene {
    function frame(uint256 size, uint256 f, uint256 frames, uint256 scene, uint256 seed)
        external
        pure
        returns (bytes memory pixels, bytes memory palette)
    {
        pixels = new bytes(size * size);
        _draw(pixels, size, f, frames, scene, seed);
        palette = _palette(scene, seed);
    }
}

contract GhoulBallsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event log_named_uint(string key, uint256 val);
    event log(string val);

    function _export(address renderer, bytes memory input, string memory name, string memory extension) private {
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = renderer.staticcall{gas: 500_000_000}(input);
        uint256 used = beforeGas - gasleft();
        require(ok, "Ghoul Balls preset exceeds budget or reverts");
        bytes memory media = abi.decode(result, (bytes));
        emit log(name);
        emit log_named_uint("gas including STATICCALL and return copy", used);
        emit log_named_uint("file bytes", media.length);
        vm.writeFileBinary(string.concat("previews/", name, extension), media);
        vm.writeFile(
            string.concat("previews/", name, ".json"),
            string.concat(
                "{\"success\":true,\"seed\":42,\"gas\":",
                vm.toString(used),
                ",\"bytes\":",
                vm.toString(media.length),
                "}"
            )
        );
    }

    function _all(uint256 scene) private {
        SolVideo lossless = new SolVideo();
        MpegVideo mpeg = new MpegVideo();
        string memory suffix = string.concat("-25-", vm.toString(scene));
        _export(
            address(lossless),
            abi.encodeCall(lossless.avi, (64, 25, scene, 42)),
            string.concat("avi-64", suffix),
            ".avi"
        );
        _export(
            address(lossless),
            abi.encodeCall(lossless.gif, (64, 25, scene, 42)),
            string.concat("gif-64", suffix),
            ".gif"
        );
        _export(address(mpeg), abi.encodeCall(mpeg.mpeg, (512, scene, 42)), string.concat("mpeg-512", suffix), ".m1v");
        _export(address(mpeg), abi.encodeCall(mpeg.mpg, (512, scene, 42)), string.concat("mpg-512", suffix), ".mpg");
    }

    function testOneBall() public {
        _all(3);
    }

    function testTwoBalls() public {
        _all(4);
    }

    function testFourBalls() public {
        _all(5);
    }

    function testSixBalls() public {
        _all(6);
    }

    function testSixBalls128Lossless() public {
        SolVideo lossless = new SolVideo();
        _export(address(lossless), abi.encodeCall(lossless.avi, (128, 25, 6, 42)), "avi-128-25-6", ".avi");
        _export(address(lossless), abi.encodeCall(lossless.gif, (128, 25, 6, 42)), "gif-128-25-6", ".gif");
    }

    function testFramePeriodAndSeed() public {
        BallsFrameHarness harness = new BallsFrameHarness();
        for (uint256 scene = 3; scene <= 6; ++scene) {
            (bytes memory first, bytes memory palette) = harness.frame(64, 0, 50, scene, 42);
            (bytes memory looped,) = harness.frame(64, 50, 50, scene, 42);
            (bytes memory changed, bytes memory changedPalette) = harness.frame(64, 0, 50, scene, 43);
            require(keccak256(first) == keccak256(looped), "Loop endpoint differs");
            require(keccak256(first) != keccak256(changed), "Seed does not affect positions");
            require(keccak256(palette) != keccak256(changedPalette), "Seed does not affect colours");
            require(palette[0] == 0 && palette[1] == 0 && palette[2] == 0, "Background is not black");
            for (uint256 i; i < first.length; ++i) {
                require(uint8(first[i]) <= 6, "Invalid ball index");
            }
        }
    }
}
