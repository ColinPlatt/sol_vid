// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Base64, Strings} from "../vendor/openzeppelin/Flattened.sol";
import {GenerativeVideo} from "./GenerativeVideo.sol";
import {Players} from "./Players.sol";

/// @notice Limited-edition, zero-price ERC-721 with deterministic, fully onchain video.
/// @dev Each mint is a set of three tokens sharing one seed: a GIF, an AVI and an MPEG-1 video. The AVI and MPEG
///      tokens carry their own onchain HTML decoder as `animation_url`. One mint per caller address.
///      No owner, upgrade, pause, fees, or privileged mint path.
contract SolVideoNFT is ERC721 {
    using Strings for uint256;

    error InvalidRenderer();
    error SoldOut();
    error AlreadyMinted();

    /// @dev The image is a small SVG around the base64 GIF. It asks for nearest-neighbour scaling at 16x, so viewers
    /// that upscale the 64px GIF keep hard pixel edges instead of smoothing it. Spaces and angle brackets are
    /// percent-encoded (RFC 2397), so the GIF is base64-encoded only once and the URI needs no other escaping.
    string private constant SVG_HEAD =
        "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%20width='1024'%20height='1024'%3E%3Cimage%20width='64'%20height='64'%20image-rendering='optimizeSpeed'%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,";
    string private constant SVG_TAIL = "'/%3E%3C/svg%3E";
    uint256 public constant TOKENS_PER_MINT = 3;
    uint256 public constant MAX_MINTS = 6667;
    uint256 public constant MAX_SUPPLY = MAX_MINTS * TOKENS_PER_MINT;
    uint8 public constant FORMAT_GIF = 0;
    uint8 public constant FORMAT_AVI = 1;
    uint8 public constant FORMAT_MPEG = 2;
    string public constant COLLECTION_NAME = "ghoulballs";
    string public constant COLLECTION_SYMBOL = "ghoulballs";
    GenerativeVideo public immutable renderer;
    uint256 public totalSupply;
    mapping(address => bool) public hasMinted;

    constructor(GenerativeVideo renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
        if (address(renderer_).code.length == 0) revert InvalidRenderer();
        renderer = renderer_;
    }

    /// @notice Mint one set (GIF, AVI and MPEG tokens) for no payment; callers still pay network gas.
    /// @return tokenId The set's first (GIF) token; the AVI and MPEG tokens follow it.
    function mint() external returns (uint256 tokenId) {
        return _mintSet(msg.sender);
    }

    /// @notice Gift one set. It uses the caller's single mint. Contract recipients must implement IERC721Receiver.
    function mintTo(address recipient) external returns (uint256 tokenId) {
        return _mintSet(recipient);
    }

    function _mintSet(address recipient) private returns (uint256 tokenId) {
        if (totalSupply >= MAX_SUPPLY) revert SoldOut();
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        hasMinted[msg.sender] = true;
        tokenId = totalSupply + 1;
        // The counter advances before the receiver hooks, including reentrant mints.
        totalSupply += TOKENS_PER_MINT;
        for (uint256 i; i < TOKENS_PER_MINT; ++i) {
            _safeMint(recipient, tokenId + i);
        }
    }

    /// @notice Number of sets minted so far.
    function totalMinted() external view returns (uint256) {
        return totalSupply / TOKENS_PER_MINT;
    }

    /// @notice The set a token belongs to, starting at 1.
    function editionOf(uint256 tokenId) public view returns (uint256) {
        ownerOf(tokenId);
        return (tokenId + TOKENS_PER_MINT - 1) / TOKENS_PER_MINT;
    }

    /// @notice FORMAT_GIF, FORMAT_AVI or FORMAT_MPEG.
    function formatOf(uint256 tokenId) public view returns (uint8) {
        ownerOf(tokenId);
        return uint8((tokenId - 1) % TOKENS_PER_MINT);
    }

    /// @notice Shared by the three tokens of a set; stable across time, owners and transfers. Distinct deployments
    ///         use distinct seeds.
    function seedOf(uint256 tokenId) public view returns (uint256) {
        return uint256(keccak256(abi.encode("GHOULBALLS_SET_V1", block.chainid, address(this), editionOf(tokenId))));
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

    /// @notice Pixel-sharp SVG around the set's GIF; the image of all three tokens.
    function imageURI(uint256 tokenId) external view returns (string memory) {
        return _image(seedOf(tokenId));
    }

    /// @notice The AVI or MPEG token's self-contained HTML player, or "" for the GIF token.
    function animationURI(uint256 tokenId) external view returns (string memory) {
        return _animation(formatOf(tokenId), seedOf(tokenId));
    }

    function _image(uint256 seed) private view returns (string memory) {
        return string.concat(SVG_HEAD, Base64.encode(renderer.gifFromSeed(64, 10, seed)), SVG_TAIL);
    }

    /// @dev `data:text/html,` + percent-encoded HTML around the base64 file, which the page's decoder plays.
    function _animation(uint8 format, uint256 seed) private view returns (string memory) {
        if (format == FORMAT_AVI) {
            return string.concat(
                "data:text/html,", Players.HEAD, Base64.encode(renderer.aviFromSeed(64, 25, seed)), Players.AVI_TAIL
            );
        }
        if (format == FORMAT_MPEG) {
            return string.concat(
                "data:text/html,", Players.HEAD, Base64.encode(renderer.mpgFromSeed(512, seed)), Players.MPEG_TAIL
            );
        }
        return "";
    }

    /// @notice The token's media and JSON are produced in one read-only call.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        uint256 seed = seedOf(tokenId);
        uint256 edition = editionOf(tokenId);
        uint8 format = formatOf(tokenId);
        string memory formatName = format == FORMAT_GIF ? "GIF" : format == FORMAT_AVI ? "AVI" : "MPEG-1";
        GenerativeVideo.Recipe memory r = renderer.recipe(seed);
        string memory attributes = string.concat(
            '[{"trait_type":"Format","value":"',
            formatName,
            '"},{"trait_type":"Set","value":',
            edition.toString(),
            '},{"trait_type":"Ball Count","value":',
            r.ballCount.toString(),
            '},{"trait_type":"Art Version","value":"GHOULBALLS_VAPOR_V3"},',
            '{"trait_type":"Theme","value":"',
            renderer.themeName(r.theme),
            '"},{"trait_type":"Motion","value":"',
            renderer.motionName(r.motion),
            '"},{"trait_type":"Seed","value":"',
            seed.toString(),
            '"},{"trait_type":"Duration Seconds","value":2},{"trait_type":"FPS","value":',
            format == FORMAT_GIF ? "10" : "25",
            "}"
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
        string memory animation = _animation(format, seed);
        bytes memory metadata = abi.encodePacked(
            '{"name":"',
            COLLECTION_NAME,
            " #",
            edition.toString(),
            " ",
            formatName,
            '","description":"A two-second generative vaporwave loop rendered entirely in Solidity, one of a set of three: GIF, AVI and MPEG-1. ',
            format == FORMAT_GIF
                ? "This is the GIF."
                : "The animation is the onchain video file, played by an onchain decoder in the page.",
            '","image":"',
            _image(seed),
            bytes(animation).length == 0 ? "" : '","animation_url":"',
            animation,
            '","attributes":',
            attributes,
            "]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(metadata));
    }
}
