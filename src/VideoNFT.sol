// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Base64, Strings} from "../vendor/openzeppelin/Flattened.sol";
import {AviRleVideo} from "./AviRleVideo.sol";
import {AviPlayer} from "./AviPlayer.sol";

/// @notice Limited-edition, zero-price ERC-721 whose video and decoder are generated entirely onchain.
/// @dev One mint per caller address. No owner, upgrade, pause, fees, or privileged mint path.
contract VideoNFT is ERC721 {
    using Strings for uint256;

    error InvalidRenderer();
    error SoldOut();
    error AlreadyMinted();

    uint256 public constant WIDTH = 512;
    uint256 public constant HEIGHT = 512;
    uint256 public constant FPS = 25;
    string public constant FORMAT = "AVI BI_RLE8";
    uint256 public constant MAX_SUPPLY = 6667;
    string public constant COLLECTION_NAME = "ghoulballs";
    string public constant COLLECTION_SYMBOL = "ghoulballs";
    AviRleVideo public immutable renderer;
    uint256 public totalSupply;
    mapping(address => bool) public hasMinted;

    constructor(AviRleVideo renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
        if (address(renderer_).code.length == 0) revert InvalidRenderer();
        renderer = renderer_;
    }

    /// @notice Mint one token for no payment; callers still pay network gas.
    function mint() external returns (uint256 tokenId) {
        return _mintNext(msg.sender);
    }

    /// @notice Gift one token. It uses the caller's single mint. Contract recipients must implement IERC721Receiver.
    function mintTo(address recipient) external returns (uint256 tokenId) {
        return _mintNext(recipient);
    }

    function _mintNext(address recipient) internal virtual returns (uint256 tokenId) {
        if (totalSupply >= MAX_SUPPLY) revert SoldOut();
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        hasMinted[msg.sender] = true;
        tokenId = ++totalSupply;
        // The counter advances before the receiver hook, including reentrant mints.
        _safeMint(recipient, tokenId);
    }

    /// @notice Stable across time, owners and transfers. Distinct deployments use distinct seeds.
    function seedOf(uint256 tokenId) public view returns (uint256) {
        ownerOf(tokenId);
        return uint256(keccak256(abi.encode("GHOULBALLS_VIDEO_NFT_V1", block.chainid, address(this), tokenId)));
    }

    function recipeOf(uint256 tokenId) external view returns (AviRleVideo.Recipe memory) {
        return renderer.recipe(seedOf(tokenId));
    }

    /// @notice Original, lossless RIFF AVI, two seconds at 25fps.
    function video(uint256 tokenId) external view returns (bytes memory) {
        return renderer.aviFromSeed(WIDTH, seedOf(tokenId));
    }

    function imageURI(uint256 tokenId) public view returns (string memory) {
        return
            string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(renderer.posterFromSeed(seedOf(tokenId)))));
    }

    function animationURI(uint256 tokenId) public view returns (string memory) {
        return string.concat(
            "data:text/html,",
            AviPlayer.HEAD,
            Base64.encode(renderer.aviFromSeed(WIDTH, seedOf(tokenId))),
            AviPlayer.TAIL
        );
    }

    /// @notice The video, poster, player and JSON are produced in one read-only call.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        uint256 seed = seedOf(tokenId);
        AviRleVideo.Recipe memory r = renderer.recipe(seed);
        string memory attributes = string.concat(
            '[{"trait_type":"Ball Count","value":',
            r.ballCount.toString(),
            '},{"trait_type":"Art Version","value":"GHOULBALLS_VAPOR_V3"},',
            '{"trait_type":"Theme","value":"',
            renderer.themeName(r.theme),
            '"},{"trait_type":"Motion","value":"',
            renderer.motionName(r.motion),
            '"},{"trait_type":"Seed","value":"',
            seed.toString(),
            '"},{"trait_type":"Duration Seconds","value":2},{"trait_type":"FPS","value":25},{"trait_type":"Format","value":"AVI BI_RLE8"},{"trait_type":"Width","value":512},{"trait_type":"Height","value":512}'
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
            '","description":"A two-second, 25fps generative vaporwave video. Lossless AVI and its self-contained player are rendered entirely in Solidity.",',
            '"image":"',
            imageURI(tokenId),
            '","animation_url":"',
            animationURI(tokenId),
            '","attributes":',
            attributes,
            "]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(metadata));
    }
}
