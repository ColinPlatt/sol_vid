// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {BlockHeaders} from "./BlockHeaders.sol";
import {BlockArtRenderer} from "./BlockArtRenderer.sol";
import {DataURI} from "./DataURI.sol";
import {Epoch} from "./Epoch.sol";
import {InPlace} from "./InPlace.sol";

/// @notice One token per 10-block epoch on the deployment chain, first come first served. The minter supplies the epoch's ten block
///         headers; the contract verifies them against the chain's own block hashes and keeps the fields the art
///         reads. The artwork is a 6-second, 128x128 animated GIF rendered from those blocks in one read-only call.
/// @dev Token id = epoch number e (blocks 10e .. 10e+9). An epoch is mintable once its last block is in the past and
///      still within the 256-block `blockhash` window (about 8.5 minutes on Base). No owner, fees or privileged mint.
contract BlockArtNFT is ERC721 {
    using Strings for uint256;
    using Epoch for bytes;

    error AlreadyMinted();
    error InvalidRenderer();
    error StoreFailed();

    // Collection name and symbol selected by the user.
    string public constant COLLECTION_NAME = "blocks";
    string public constant COLLECTION_SYMBOL = "blocks";
    string public constant ART_VERSION = "NEO_TOKYO_BLOCKS_V1";

    /// @dev Pixel-sharp SVG around the base64 GIF (percent-encoded, as in the ghoulballs collection): viewers that
    ///      upscale keep hard pixel edges.
    string private constant SVG_HEAD =
        "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20128%20128'%20width='1024'%20height='1024'%3E%3Cimage%20width='128'%20height='128'%20image-rendering='optimizeSpeed'%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,";
    string private constant SVG_TAIL = "'/%3E%3C/svg%3E";

    BlockArtRenderer public immutable renderer;
    uint256 public totalSupply;
    /// @dev Epoch -> contract whose code holds the packed epoch record (SSTORE2 pattern).
    mapping(uint256 => address) private _data;

    constructor(BlockArtRenderer renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
        if (address(renderer_).code.length == 0) revert InvalidRenderer();
        renderer = renderer_;
    }

    /// @notice Mint epoch `epoch` by supplying its ten RLP-encoded block headers, oldest first.
    function mint(uint256 epoch, bytes[] calldata headers) external returns (uint256) {
        if (_data[epoch] != address(0)) revert AlreadyMinted();
        bytes memory packed = BlockHeaders.verifyEpoch(epoch, headers);
        _data[epoch] = _store(packed);
        ++totalSupply;
        _safeMint(msg.sender, epoch);
        return epoch;
    }

    function epochData(uint256 tokenId) public view returns (bytes memory e) {
        _requireOwned(tokenId);
        address ptr = _data[tokenId];
        uint256 size = ptr.code.length - 1;
        e = new bytes(size);
        assembly ("memory-safe") {
            extcodecopy(ptr, add(e, 32), 1, size)
        }
    }

    function sceneOf(uint256 tokenId) public view returns (uint256) {
        return epochData(tokenId).scene();
    }

    /// @notice The token's raw GIF: 128x128, 90 frames at 15fps, a 6-second loop.
    function gif(uint256 tokenId) external view returns (bytes memory) {
        InPlace.ret(_gif(epochData(tokenId)));
    }

    /// @notice Original-file alternative, generated from exactly the same immutable epoch.
    function avi(uint256 tokenId) external view returns (bytes memory) {
        InPlace.ret(InPlace.call(address(renderer), abi.encodeCall(BlockArtRenderer.avi, (epochData(tokenId)))));
    }

    function _gif(bytes memory e) private view returns (bytes memory) {
        return InPlace.call(address(renderer), abi.encodeCall(BlockArtRenderer.gif, (e)));
    }

    /// @notice JSON metadata with the GIF (in its pixelated SVG wrapper), all produced in one read-only call.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        bytes memory e = epochData(tokenId);
        uint256 s = e.scene();
        bytes memory pre = abi.encodePacked(
            '{"name":"',
            renderer.sceneName(s),
            " #",
            tokenId.toString(),
            '","description":"Ten consecutive blocks (',
            Epoch.number(e, 0).toString(),
            "-",
            Epoch.number(e, 9).toString(),
            "), verified onchain from their headers and rendered as a six-second night in Neo-Tokyo: a 128x128 GIF drawn entirely in Solidity.",
            '","image":"',
            SVG_HEAD
        );
        uint256 gasBps;
        for (uint256 i; i < 10; ++i) {
            gasBps += e.gasBps(i);
        }
        bytes memory post = abi.encodePacked(
            SVG_TAIL,
            '","attributes":[{"trait_type":"Art Version","value":"NEO_TOKYO_BLOCKS_V1"},{"trait_type":"Scene","value":"',
            renderer.sceneName(s),
            '"},{"trait_type":"Rare","value":"',
            s == 7 ? "Yes" : "No",
            '"},{"trait_type":"Epoch","value":',
            tokenId.toString(),
            '},{"trait_type":"First Block","value":',
            Epoch.number(e, 0).toString(),
            '},{"trait_type":"Average Gas Used (bps)","value":',
            (gasBps / 10).toString(),
            '},{"trait_type":"Duration Seconds","value":6},{"trait_type":"FPS","value":15}]}'
        );
        InPlace.ret(bytes(DataURI.jsonWithGif(pre, _gif(e), post)));
    }

    function _store(bytes memory data) private returns (address ptr) {
        // Init code: PUSH2 size, DUP1, PUSH1 0x0a, RETURNDATASIZE, CODECOPY, RETURNDATASIZE, RETURN; then STOP + data.
        bytes memory init = abi.encodePacked(hex"61", uint16(data.length + 1), hex"80600a3d393df300", data);
        assembly ("memory-safe") {
            ptr := create(0, add(init, 32), mload(init))
        }
        if (ptr == address(0)) revert StoreFailed();
    }
}
