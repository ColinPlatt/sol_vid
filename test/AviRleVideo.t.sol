// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AviRleVideo} from "../src/AviRleVideo.sol";
import {AviRlePlayer} from "../src/AviRlePlayer.sol";
import {Vm} from "./SolVideo.t.sol";

contract AviRleVideoTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event log_named_uint(string key, uint256 val);

    function testRender512() public {
        _render(512, 42);
    }

    function testRender256() public {
        _render(256, 42);
    }

    function testPlayer256() public {
        _player(256);
    }

    function testPlayer512() public {
        _player(512);
    }

    function _player(uint256 size) private {
        AviRleVideo renderer = new AviRleVideo();
        require(address(renderer).code.length <= 24576, "Runtime too large");
        AviRlePlayer player = new AviRlePlayer(renderer);
        require(address(player).code.length <= 24576, "Player runtime too large");
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(player).staticcall{gas: 500_000_000}(abi.encodeCall(player.playerURI, (size, 42)));
        uint256 used = beforeGas - gasleft();
        require(ok && used <= 500_000_000, "Player exceeds budget");
        string memory uri = abi.decode(result, (string));
        string memory name = string.concat("previews/video/avi-rle-", vm.toString(size), "-42.player");
        vm.writeFile(string.concat(name, ".uri"), uri);
        vm.writeFile(
            string.concat(name, ".json"),
            string.concat('{"gas":', vm.toString(used), ',"bytes":', vm.toString(bytes(uri).length), "}")
        );
        emit log_named_uint("AVI player gas", used);
        emit log_named_uint("AVI player URI bytes", bytes(uri).length);
    }

    function _render(uint256 size, uint256 seed) private {
        AviRleVideo renderer = new AviRleVideo();
        require(address(renderer).code.length <= 24576, "Runtime too large");
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(renderer).staticcall{gas: 500_000_000}(abi.encodeCall(renderer.aviFromSeed, (size, seed)));
        uint256 used = beforeGas - gasleft();
        require(ok && used <= 500_000_000, "Render exceeds budget");
        bytes memory media = abi.decode(result, (bytes));
        string memory name = string.concat("previews/video/avi-rle-", vm.toString(size), "-", vm.toString(seed));
        vm.writeFileBinary(string.concat(name, ".avi"), media);
        vm.writeFile(
            string.concat(name, ".json"),
            string.concat('{"gas":', vm.toString(used), ',"bytes":', vm.toString(media.length), "}")
        );
        emit log_named_uint("AVI raw gas", used);
        emit log_named_uint("AVI bytes", media.length);
        vm.writeFile(string.concat(name, ".svg"), renderer.posterFromSeed(seed));
    }
}
