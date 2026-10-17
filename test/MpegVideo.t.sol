// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MpegVideo} from "../src/MpegVideo.sol";
import {Vm} from "./SolVideo.t.sol";

contract MpegVideoTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event log_named_uint(string key, uint256 val);
    event log(string val);

    function _probe(uint256 size, uint256 scene, bool required) private {
        MpegVideo renderer = new MpegVideo();
        bytes memory input = abi.encodeCall(renderer.mpeg, (size, scene, 42));
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(renderer).staticcall{gas: 500_000_000}(input);
        uint256 used = beforeGas - gasleft();
        string memory name = string.concat("mpeg-", vm.toString(size), "-25-", vm.toString(scene));
        emit log(name);
        emit log_named_uint("gas including STATICCALL and return copy", used);
        if (required) require(ok, "MPEG render failed");
        if (!ok) {
            vm.writeFile(string.concat("previews/", name, ".json"), "{\"success\":false,\"budget\":500000000}");
            return;
        }
        bytes memory media = abi.decode(result, (bytes));
        emit log_named_uint("file bytes", media.length);
        vm.writeFileBinary(string.concat("previews/", name, ".m1v"), media);
        vm.writeFile(
            string.concat("previews/", name, ".json"),
            string.concat(
                "{\"success\":true,\"gas\":", vm.toString(used), ",\"bytes\":", vm.toString(media.length), "}"
            )
        );
    }

    function testMpeg128() public {
        _probe(128, 0, true);
    }

    function testMpeg256() public {
        _probe(256, 0, true);
    }

    function testMpeg512() public {
        _probe(512, 0, true);
    }

    function testMpeg1024() public {
        _probe(1024, 0, false);
    }

    function testMpegOrb() public {
        _probe(512, 1, true);
    }

    function testMpegInterference() public {
        _probe(512, 2, true);
    }

    function testMpg512() public {
        MpegVideo renderer = new MpegVideo();
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(renderer).staticcall{gas: 500_000_000}(abi.encodeCall(renderer.mpg, (512, 0, 42)));
        uint256 used = beforeGas - gasleft();
        require(ok, "MPG render failed");
        bytes memory media = abi.decode(result, (bytes));
        emit log_named_uint("MPEG program stream gas", used);
        emit log_named_uint("file bytes", media.length);
        vm.writeFileBinary("previews/mpg-512-25-0.mpg", media);
        vm.writeFile(
            "previews/mpg-512-25-0.json",
            string.concat(
                "{\"success\":true,\"gas\":", vm.toString(used), ",\"bytes\":", vm.toString(media.length), "}"
            )
        );
    }
}
