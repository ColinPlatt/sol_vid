// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MarketplaceProbe} from "../src/probes/MarketplaceProbe.sol";
import {Vm} from "./SolVideo.t.sol";

interface VmProbe is Vm {
    function readFileBinary(string calldata path) external view returns (bytes memory);
    function expectRevert(bytes calldata data) external;
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
}

contract MarketplaceProbeTest {
    VmProbe constant vm = VmProbe(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant RECIPIENT = address(uint160(0xA11CE));
    MarketplaceProbe probe;
    bytes32 expectedHash;
    event log_named_uint(string name, uint256 value);

    function setUp() public {
        bytes memory source = vm.readFileBinary("fixtures/marketplace-probe/large-html.uri");
        expectedHash = keccak256(source);
        probe = new MarketplaceProbe(RECIPIENT, "https://ghoulballs.vercel.app/probe/player.html");
    }

    function testFixedSupplyAndPayloadIntegrity() public view {
        require(probe.totalSupply() == 15 && probe.balanceOf(RECIPIENT) == 15, "Wrong probe set");
        for (uint256 id = 1; id <= 15; ++id) {
            require(probe.ownerOf(id) == RECIPIENT, "Wrong recipient");
        }
        require(probe.largeURIHash() == expectedHash, "Wrong payload hash");
        require(keccak256(bytes(probe.tokenURI(11))) == expectedHash, "Stored payload changed");
        require(address(probe).code.length <= 24576, "Probe runtime exceeds Base code limit");
    }

    function testAllMetadataWithin500MAndExport() public {
        string memory records = "[";
        for (uint256 id = 1; id <= 15; ++id) {
            uint256 beforeGas = gasleft();
            (bool ok, bytes memory result) =
                address(probe).staticcall{gas: 500000000}(abi.encodeCall(probe.tokenURI, (id)));
            uint256 used = beforeGas - gasleft();
            require(ok, "Probe metadata failed below 500M");
            string memory uri = abi.decode(result, (string));
            uint256 target = probe.gasTarget(id);
            if (target != 0) require(used >= target && used < target + 2000000, "Gas ladder not calibrated");
            else require(used < 40000000, "Non-gas control is not cheap");
            emit log_named_uint(probe.caseName(id), used);
            vm.writeFile(string.concat("previews/probe/token-", vm.toString(id), ".uri.txt"), uri);
            records = string.concat(
                records,
                id == 1 ? "" : ",",
                '{"token_id":',
                vm.toString(id),
                ',"name":"',
                probe.caseName(id),
                '","gas":',
                vm.toString(used),
                ',"target_gas":',
                vm.toString(target),
                ',"uri_bytes":',
                vm.toString(bytes(uri).length),
                "}"
            );
        }
        string memory profile = vm.envOr("FOUNDRY_PROFILE", string("default"));
        bool isBase =
            keccak256(bytes(profile)) == keccak256("base") || keccak256(bytes(profile)) == keccak256("base_sepolia");
        vm.writeFile(
            isBase ? "previews/probe/measurements.base.json" : "previews/probe/measurements.amsterdam.json",
            string.concat(records, "]")
        );
    }

    function testFiftyMillionReadSeparatesGasLadder() public view {
        for (uint256 id = 1; id <= 7; ++id) {
            (bool ok,) = address(probe).staticcall{gas: 50000000}(abi.encodeCall(probe.tokenURI, (id)));
            require(ok == (id <= 3), "50M boundary does not isolate gas");
        }
    }

    function testNonexistentURIReverts() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(16)));
        probe.tokenURI(16);
    }

    function testRejectsZeroRecipient() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(uint160(0))));
        new MarketplaceProbe(address(uint160(0)), "https://ghoulballs.vercel.app/probe/player.html");
    }

    function testRejectsInsecureHostedURL() public {
        vm.expectRevert(abi.encodeWithSelector(MarketplaceProbe.InvalidHostedURL.selector));
        new MarketplaceProbe(RECIPIENT, "http://example.com");
    }
}
