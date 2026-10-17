// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {GenerativeVideo} from "../src/GenerativeVideo.sol";
import {Vm} from "./SolVideo.t.sol";

contract GenerativeVideoTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event log_named_uint(string key, uint256 val);
    event log(string val);

    function _export(
        GenerativeVideo renderer,
        bytes memory input,
        string memory name,
        string memory extension,
        uint256 seed
    ) private {
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(renderer).staticcall{gas: 500_000_000}(input);
        uint256 used = beforeGas - gasleft();
        require(ok, "Generative render exceeds budget or reverts");
        bytes memory media = abi.decode(result, (bytes));
        emit log(name);
        emit log_named_uint("gas", used);
        vm.writeFileBinary(string.concat("previews/", name, extension), media);
        vm.writeFile(
            string.concat("previews/", name, ".json"),
            string.concat(
                "{\"success\":true,\"generative\":true,\"seed\":",
                vm.toString(seed),
                ",\"gas\":",
                vm.toString(used),
                ",\"bytes\":",
                vm.toString(media.length),
                "}"
            )
        );
    }

    function _sample(uint256 seed) private {
        GenerativeVideo renderer = new GenerativeVideo();
        GenerativeVideo.Recipe memory r = renderer.recipe(seed);
        string memory suffix = string.concat("-25-", vm.toString(r.scene), "-seed", vm.toString(seed));
        _export(
            renderer,
            abi.encodeCall(renderer.aviFromSeed, (64, 25, seed)),
            string.concat("avi-64", suffix),
            ".avi",
            seed
        );
        _export(
            renderer,
            abi.encodeCall(renderer.gifFromSeed, (64, 25, seed)),
            string.concat("gif-64", suffix),
            ".gif",
            seed
        );
        _export(
            renderer,
            abi.encodeCall(renderer.mpegFromSeed, (512, seed)),
            string.concat("mpeg-512", suffix),
            ".m1v",
            seed
        );
        _export(
            renderer, abi.encodeCall(renderer.mpgFromSeed, (512, seed)), string.concat("mpg-512", suffix), ".mpg", seed
        );
        vm.writeFileBinary(string.concat("previews/recipe-seed", vm.toString(seed), ".abi"), abi.encode(r));
    }

    function testSeed1() public {
        _sample(1);
    }

    function testSeed2() public {
        _sample(2);
    }

    function testSeed3() public {
        _sample(3);
    }

    function testSeed4() public {
        _sample(4);
    }

    function testSeed6() public {
        _sample(6);
    }

    function testSeed7() public {
        _sample(7);
    }

    function testSeed42() public {
        _sample(42);
    }

    function testSeed99() public {
        _sample(99);
    }

    function testSeed2026() public {
        _sample(2026);
    }

    function testWrapperMatchesExplicitScene() public {
        GenerativeVideo renderer = new GenerativeVideo();
        for (uint256 seed; seed < 4; ++seed) {
            bytes memory autoGif = renderer.gifFromSeed(32, 10, seed);
            bytes memory explicitGif = renderer.gif(32, 10, renderer.sceneForSeed(seed), seed);
            require(keccak256(autoGif) == keccak256(explicitGif), "Seed wrapper changes artwork");
            require(keccak256(autoGif) == keccak256(renderer.gifFromSeed(32, 10, seed)), "Output is not repeatable");
        }
    }

    function testFuzzRecipeBounds(uint256 seed) public {
        GenerativeVideo renderer = new GenerativeVideo();
        GenerativeVideo.Recipe memory r = renderer.recipe(seed);
        require(r.scene >= 7 && r.scene <= 10, "Invalid scene");
        require(r.ballCount == 1 || r.ballCount == 2 || r.ballCount == 4 || r.ballCount == 6, "Invalid count");
        require(r.seed == seed && r.balls.length == r.ballCount && r.palette.length == 48, "Invalid recipe");
        require(r.theme < 4 && r.motion < 4, "Invalid style");
        for (uint256 i; i < r.ballCount; ++i) {
            GenerativeVideo.Ball memory b = r.balls[i];
            require(b.radius >= 5 && b.radius <= 10, "Invalid radius");
            require(b.xPhase < 2 * (63 - 2 * b.radius) && b.yPhase < 2 * (63 - 2 * b.radius), "Invalid phase");
            uint256 p = 3 * (8 + i);
            require(
                b.colour[0] == r.palette[p] && b.colour[1] == r.palette[p + 1] && b.colour[2] == r.palette[p + 2],
                "Trait colour differs"
            );
        }
    }
}
