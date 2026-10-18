// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {DataURI} from "../../src/blockart/DataURI.sol";
import {Base64} from "../../vendor/openzeppelin/Flattened.sol";

/// @notice Independent reference for the streamed, word-parallel two-layer base64 encoder.
contract BlockArtDataURITest {
    function check(bytes memory pre, bytes memory media, bytes memory post) internal pure {
        string memory actual = DataURI.jsonWithGif(pre, media, post);
        string memory expected = string.concat(
            "data:application/json;base64,", Base64.encode(abi.encodePacked(pre, Base64.encode(media), post))
        );
        require(keccak256(bytes(actual)) == keccak256(bytes(expected)), "Streaming base64 differs from reference");
    }

    function testFuzzReference(bytes memory pre, bytes memory media, bytes memory post) public pure {
        check(pre, media, post);
    }

    function testWindowAndPaddingBoundaries() public pure {
        uint256[12] memory lengths = [uint256(0), 1, 2, 3, 23, 24, 25, 2295, 2303, 2304, 2305, 4095];
        for (uint256 i; i < lengths.length; ++i) {
            bytes memory data = new bytes(lengths[i]);
            for (uint256 k; k < data.length; ++k) {
                data[k] = bytes1(uint8(k * 37 + i));
            }
            check(
                i % 3 == 0 ? bytes(unicode"blocks 夜景") : i % 3 == 1 ? bytes("a") : bytes("ab"),
                data,
                i % 2 == 0 ? bytes("end") : bytes("x")
            );
        }
    }
}
