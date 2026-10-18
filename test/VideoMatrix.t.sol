// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AviRleVideo} from "../src/AviRleVideo.sol";
import {VideoNFT} from "../src/VideoNFT.sol";
import {VmNFT} from "./SolVideoNFT.t.sol";
import {IERC721Receiver} from "../vendor/openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface VmMatrix is VmNFT {
    function createDir(string calldata path, bool recursive) external;
}

contract VideoMatrixTest is IERC721Receiver {
    VmMatrix constant vm = VmMatrix(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public {
        vm.createDir("previews/video/matrix", true);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _group(uint256 start) private {
        AviRleVideo renderer = new AviRleVideo();
        for (uint256 target = start; target < start + 4; ++target) {
            VideoNFT nft = new VideoNFT(renderer);
            uint256 tokenId;
            uint256 seed;
            for (uint256 id = 1; id <= 6667; ++id) {
                uint256 s = uint256(keccak256(abi.encode("GHOULBALLS_VIDEO_NFT_V1", block.chainid, address(nft), id)));
                uint256 key = uint256(keccak256(abi.encode("GHOULBALLS_VAPOR_V3", s)));
                if (key % 4 + 4 * ((key >> 8) % 4) + 16 * ((key >> 16) % 4) == target) {
                    tokenId = id;
                    seed = s;
                    break;
                }
            }
            require(tokenId != 0, "No matrix seed found");
            // Skip unused IDs only in the test; exercise the real seed and metadata implementations.
            vm.store(address(nft), bytes32(uint256(6)), bytes32(tokenId - 1));
            require(nft.mint() == tokenId, "Wrong matrix ID");
            uint256 beforeGas = gasleft();
            (bool ok, bytes memory result) =
                address(nft).staticcall{gas: 500_000_000}(abi.encodeCall(nft.tokenURI, (tokenId)));
            uint256 used = beforeGas - gasleft();
            require(ok, "Matrix metadata exceeds budget");
            string memory uri = abi.decode(result, (string));
            string memory name = string.concat("previews/video/matrix/", vm.toString(target));
            vm.writeFile(string.concat(name, ".uri"), uri);
            vm.writeFile(
                string.concat(name, ".json"),
                string.concat(
                    '{"case":',
                    vm.toString(target),
                    ',"seed":"',
                    vm.toString(seed),
                    '","gas":',
                    vm.toString(used),
                    ',"bytes":',
                    vm.toString(bytes(uri).length),
                    "}"
                )
            );
        }
    }

    function testMatrix0() public {
        _group(0);
    }

    function testMatrix1() public {
        _group(4);
    }

    function testMatrix2() public {
        _group(8);
    }

    function testMatrix3() public {
        _group(12);
    }

    function testMatrix4() public {
        _group(16);
    }

    function testMatrix5() public {
        _group(20);
    }

    function testMatrix6() public {
        _group(24);
    }

    function testMatrix7() public {
        _group(28);
    }

    function testMatrix8() public {
        _group(32);
    }

    function testMatrix9() public {
        _group(36);
    }

    function testMatrix10() public {
        _group(40);
    }

    function testMatrix11() public {
        _group(44);
    }

    function testMatrix12() public {
        _group(48);
    }

    function testMatrix13() public {
        _group(52);
    }

    function testMatrix14() public {
        _group(56);
    }

    function testMatrix15() public {
        _group(60);
    }
}
