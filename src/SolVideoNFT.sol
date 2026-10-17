// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Base64, Strings} from "../vendor/openzeppelin/Flattened.sol";
import {GenerativeVideo} from "./GenerativeVideo.sol";

/// @notice Limited-edition, zero-price ERC-721 with deterministic, fully onchain video.
/// @dev No owner, upgrade, pause, fees, wallet cap, or privileged mint path.
contract SolVideoNFT is ERC721 {
    using Strings for uint256;

    error InvalidRenderer();
    error SoldOut();

    /// @dev The image is a small SVG around the base64 GIF. It asks for nearest-neighbour scaling at 16x, so viewers
    /// that upscale the 64px GIF keep hard pixel edges instead of smoothing it. Spaces and angle brackets are
    /// percent-encoded (RFC 2397), so the GIF is base64-encoded only once and the URI needs no other escaping.
    string private constant SVG_HEAD =
        "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%20width='1024'%20height='1024'%3E%3Cimage%20width='64'%20height='64'%20image-rendering='optimizeSpeed'%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,";
    string private constant SVG_TAIL = "'/%3E%3C/svg%3E";
    uint256 public constant MAX_SUPPLY = 6667;
    string public constant COLLECTION_NAME = "ghoulballs";
    string public constant COLLECTION_SYMBOL = "ghoulballs";
    GenerativeVideo public immutable renderer;
    uint256 public totalSupply;

    constructor(GenerativeVideo renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
        if (address(renderer_).code.length == 0) revert InvalidRenderer();
        renderer = renderer_;
    }

    /// @notice Mint one token for no payment; callers still pay network gas.
    function mint() external returns (uint256 tokenId) {
        return _mintNext(msg.sender);
    }

    /// @notice Gift one token. Contract recipients must implement IERC721Receiver.
    function mintTo(address recipient) external returns (uint256 tokenId) {
        return _mintNext(recipient);
    }

    function _mintNext(address recipient) private returns (uint256 tokenId) {
        if (totalSupply >= MAX_SUPPLY) revert SoldOut();
        tokenId = ++totalSupply;
        // The counter advances before the receiver hook, including reentrant mints.
        _safeMint(recipient, tokenId);
    }

    /// @notice Stable across time, owners and transfers. Distinct deployments use distinct seeds.
    function seedOf(uint256 tokenId) public view returns (uint256) {
        ownerOf(tokenId);
        return uint256(keccak256(abi.encode("SOL_VIDEO_NFT_V1", block.chainid, address(this), tokenId)));
    }

    function recipeOf(uint256 tokenId) external view returns (GenerativeVideo.Recipe memory) {
        return renderer.recipe(seedOf(tokenId));
    }

    function gif(uint256 tokenId) external view returns (bytes memory) {
        return renderer.gifFromSeed(64, 10, seedOf(tokenId));
    }

    function avi(uint256 tokenId) external view returns (bytes memory) {
        return renderer.aviFromSeed(64, 25, seedOf(tokenId));
    }

    function mpeg(uint256 tokenId) external view returns (bytes memory) {
        return renderer.mpgFromSeed(512, seedOf(tokenId));
    }

    /// @notice Pixel-sharp SVG around the GIF, the image fallback for clients that cannot play MPEG-1.
    function imageURI(uint256 tokenId) external view returns (string memory) {
        return string.concat(SVG_HEAD, Base64.encode(renderer.gifFromSeed(64, 10, seedOf(tokenId))), SVG_TAIL);
    }

    function animationURI(uint256 tokenId) external view returns (string memory) {
        return string.concat("data:video/mpeg;base64,", Base64.encode(renderer.mpgFromSeed(512, seedOf(tokenId))));
    }

    /// @notice Both media files and JSON are produced in one read-only call.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        uint256 seed = seedOf(tokenId);
        GenerativeVideo.Recipe memory r = renderer.recipe(seed);
        string memory attributes = string.concat(
            '[{"trait_type":"Ball Count","value":',
            r.ballCount.toString(),
            '},{"trait_type":"Art Version","value":"GHOULBALLS_VAPOR_V2"},',
            '{"trait_type":"Theme","value":"',
            renderer.themeName(r.theme),
            '"},{"trait_type":"Motion","value":"',
            renderer.motionName(r.motion),
            '"},{"trait_type":"Seed","value":"',
            seed.toString(),
            '"},{"trait_type":"Duration Seconds","value":2},',
            '{"trait_type":"Video FPS","value":25},',
            '{"trait_type":"Video Format","value":"MPEG-1"}'
        );
        for (uint256 i; i < r.balls.length; ++i) {
            attributes = string.concat(
                attributes,
                ',{"trait_type":"Ball ',
                (i + 1).toString(),
                ' Colour","value":"',
                Strings.toHexString(uint256(uint24(r.balls[i].colour)), 3),
                '"},{"trait_type":"Ball ',
                (i + 1).toString(),
                ' Radius","value":',
                r.balls[i].radius.toString(),
                "}"
            );
        }
        bytes memory metadata = abi.encodePacked(
            '{"name":"',
            COLLECTION_NAME,
            " #",
            tokenId.toString(),
            '","description":"A two-second generative vaporwave loop with neon balls, rendered entirely in Solidity. ',
            '6,667 editions. Free mint; network gas applies. GIF image and MPEG-1 animation are fully onchain.",',
            '"image":"',
            SVG_HEAD,
            Base64.encode(renderer.gifFromSeed(64, 10, seed)),
            SVG_TAIL,
            '","animation_url":"data:video/mpeg;base64,',
            Base64.encode(renderer.mpgFromSeed(512, seed)),
            '","attributes":',
            attributes,
            "]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(metadata));
    }
}
