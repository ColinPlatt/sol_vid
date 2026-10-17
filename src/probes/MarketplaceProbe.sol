// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Base64, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {ProbeFixtures} from "./ProbeFixtures.sol";

/// @notice Diagnostic collection. Fifteen fixed controls are minted once at deployment.
/// @dev Prerecorded media controls, not new ghoulballs artwork or a new video codec.
contract MarketplaceProbe is ERC721 {
    using Strings for uint256;
    error InvalidCase();
    error InvalidHostedURL();
    error InsufficientGasForProbe();

    uint256 public constant TOTAL_CASES = 15;
    string public hostedHTML;

    constructor(address recipient, string memory hostedHTML_) ERC721("ghoulballs marketplace probe", "GBPROBE") {
        if (recipient == address(uint160(0))) revert ERC721InvalidReceiver(recipient);
        bytes memory url = bytes(hostedHTML_);
        if (url.length < 9 || url.length > 512 || bytes8(url) != bytes8("https://")) revert InvalidHostedURL();
        for (uint256 i; i < url.length; ++i) {
            if (uint8(url[i]) < 33 || uint8(url[i]) > 126 || url[i] == '"' || url[i] == "\\") {
                revert InvalidHostedURL();
            }
        }
        hostedHTML = hostedHTML_;
        for (uint256 id = 1; id <= TOTAL_CASES; ++id) {
            _safeMint(recipient, id);
        }
    }

    function largeURIBytes() external pure returns (uint256) {
        return ProbeFixtures.large_size();
    }

    function largeURIHash() external pure returns (bytes32) {
        return ProbeFixtures.large_hash();
    }

    function totalSupply() external pure returns (uint256) {
        return TOTAL_CASES;
    }

    function caseName(uint256 id) public pure returns (string memory) {
        if (id == 0 || id > TOTAL_CASES) revert InvalidCase();
        if (id <= 7) return string.concat("Gas ", (gasTarget(id) / 1000000).toString(), "M");
        if (id == 8) return "HTML JS base64";
        if (id == 9) return "HTML JS percent";
        if (id == 10) return "HTML CSS no JS";
        if (id == 11) return "Cheap 600KB HTML";
        if (id == 12) return "Inline MP4";
        if (id == 13) return "Hosted HTML JS";
        if (id == 14) return "SVG wrapped GIF";
        return "Raw GIF image";
    }

    function gasTarget(uint256 id) public pure returns (uint256) {
        if (id == 1) return 10000000;
        if (id == 2) return 30000000;
        if (id == 3) return 45000000;
        if (id == 4) return 60000000;
        if (id == 5) return 100000000;
        if (id == 6) return 200000000;
        if (id == 7) return 400000000;
        return 0;
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        ownerOf(id);
        if (id == 11) return string(ProbeFixtures.large_uri());
        if (id <= 7) _consumeGas(gasTarget(id));
        string memory image = string.concat("data:image/gif;base64,", Base64.encode(ProbeFixtures.gif()));
        string memory animation;
        if (id == 8) animation = string.concat("data:text/html;base64,", Base64.encode(ProbeFixtures.html_js()));
        if (id == 9) animation = string.concat("data:text/html,", _percent(ProbeFixtures.html_js()));
        if (id == 10) animation = string.concat("data:text/html;base64,", Base64.encode(ProbeFixtures.html_css()));
        if (id == 12) animation = string.concat("data:video/mp4;base64,", Base64.encode(ProbeFixtures.mp4()));
        if (id == 13) animation = hostedHTML;
        if (id == 14) {
            image = string.concat(
                "data:image/svg+xml,",
                _percent(
                    abi.encodePacked(
                        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='512' height='512'><image width='32' height='32' style='image-rendering:pixelated' href='",
                        image,
                        "'/></svg>"
                    )
                )
            );
        }
        bytes memory metadata = abi.encodePacked(
            '{"name":"ghoulballs probe #',
            id.toString(),
            " - ",
            caseName(id),
            '","description":"Marketplace compatibility control. Prerecorded media; not a new onchain codec.","image":"',
            image,
            '"',
            bytes(animation).length == 0 ? "" : string.concat(',"animation_url":"', animation, '"'),
            ',"attributes":[{"trait_type":"Probe","value":"',
            caseName(id),
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(metadata));
    }

    function _consumeGas(uint256 amount) private view {
        if (gasleft() < amount + 500000) revert InsufficientGasForProbe();
        assembly ("memory-safe") {
            let gasFloor := sub(gas(), amount)
            for {} gt(gas(), gasFloor) {} {}
        }
    }

    function _percent(bytes memory input) private pure returns (string memory) {
        bytes memory output = new bytes(input.length * 3);
        bytes16 hexChars = "0123456789ABCDEF";
        uint256 p;
        for (uint256 i; i < input.length; ++i) {
            uint8 c = uint8(input[i]);
            if (
                (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c == 45 || c == 46 || c == 95
                    || c == 126
            ) {
                output[p++] = bytes1(c);
            } else {
                output[p++] = "%";
                output[p++] = hexChars[c >> 4];
                output[p++] = hexChars[c & 15];
            }
        }
        assembly ("memory-safe") { mstore(output, p) }
        return string(output);
    }
}
