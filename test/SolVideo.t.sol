// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SolVideo} from "../src/SolVideo.sol";

interface Vm {
    function writeFileBinary(string calldata path, bytes calldata data) external;
    function writeFile(string calldata path, string calldata data) external;
    function toString(uint256 value) external pure returns (string memory);
}

contract SolVideoTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event log_named_uint(string key, uint256 val);
    event log(string val);

    function _probe(uint256 size, uint256 fps, uint256 scene, bool isGif, bool required) private {
        SolVideo renderer = new SolVideo();
        bytes memory input =
            abi.encodeWithSelector(isGif ? renderer.gif.selector : renderer.avi.selector, size, fps, scene, 42);
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(renderer).staticcall{gas: 500_000_000}(input);
        uint256 used = beforeGas - gasleft();
        string memory name =
            string.concat(isGif ? "gif" : "avi", "-", vm.toString(size), "-", vm.toString(fps), "-", vm.toString(scene));
        emit log(name);
        emit log_named_uint("gas including STATICCALL and return copy", used);
        if (required) require(ok, "Required preset exceeds budget or reverts");
        if (!ok) {
            vm.writeFile(string.concat("previews/", name, ".json"), "{\"success\":false,\"budget\":500000000}");
            return;
        }
        bytes memory media = abi.decode(result, (bytes));
        emit log_named_uint("file bytes", media.length);
        vm.writeFileBinary(string.concat("previews/", name, isGif ? ".gif" : ".avi"), media);
        vm.writeFile(
            string.concat("previews/", name, ".json"),
            string.concat(
                "{\"success\":true,\"gas\":", vm.toString(used), ",\"bytes\":", vm.toString(media.length), "}"
            )
        );
    }

    function test64Road() public {
        _probe(64, 10, 0, false, true);
        _probe(64, 10, 0, true, true);
    }

    function test64Orb() public {
        _probe(64, 10, 1, false, true);
        _probe(64, 10, 1, true, true);
    }

    function test64Interference() public {
        _probe(64, 10, 2, false, true);
        _probe(64, 10, 2, true, true);
    }

    function test128Road() public {
        _probe(128, 20, 0, false, true);
        _probe(128, 20, 0, true, true);
    }

    function test256Road() public {
        _probe(256, 25, 0, false, false);
        _probe(256, 25, 0, true, false);
    }

    function testRejectInvalidSettings() public {
        SolVideo renderer = new SolVideo();
        (bool ok,) = address(renderer).staticcall(abi.encodeCall(renderer.gif, (65, 10, 0, 0)));
        require(!ok, "Invalid dimensions accepted");
        (ok,) = address(renderer).staticcall(abi.encodeCall(renderer.avi, (64, 30, 0, 0)));
        require(!ok, "Invalid frame rate accepted");
    }
}
