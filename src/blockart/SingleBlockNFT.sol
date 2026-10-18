// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {BlockArtRenderer} from "./BlockArtRenderer.sol";
import {DataURI} from "./DataURI.sol";
import {Epoch} from "./Epoch.sol";
import {InPlace} from "./InPlace.sol";

/// @notice One free NFT per mint block. mint() captures only that block's EVM-visible information.
/// @dev No owner, supplied headers, caller seed, privileged mint or dependence on future/previous block data.
contract SingleBlockNFT is ERC721 {
    using Strings for uint256;
    using Epoch for bytes;

    error AlreadyMinted();
    error InvalidRenderer();
    error StoreFailed();

    // Collection name and symbol selected by the user.
    string public constant COLLECTION_NAME = "blocks";
    string public constant COLLECTION_SYMBOL = "blocks";
    string public constant ART_VERSION = "BLOCKS_SINGLE_V1";

    /// @dev Pixel-sharp SVG around the base64 GIF (percent-encoded, as in the ghoulballs collection): viewers that
    ///      upscale keep hard pixel edges.
    string private constant SVG_HEAD =
        "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20128%20128'%20width='1024'%20height='1024'%3E%3Cimage%20width='128'%20height='128'%20image-rendering='optimizeSpeed'%20style='image-rendering:crisp-edges;image-rendering:pixelated'%20href='data:image/gif;base64,";
    string private constant SVG_TAIL = "'/%3E%3C/svg%3E";

    BlockArtRenderer public immutable renderer;
    uint256 public totalSupply;
    /// @dev Block number -> STOP-prefixed data contract holding the immutable single-block record.
    mapping(uint256 => address) private _data;
    uint256 public latestTokenId;

    constructor(BlockArtRenderer renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
        if (address(renderer_).code.length == 0) revert InvalidRenderer();
        renderer = renderer_;
    }

    /// @notice Mint the current execution block. One token per block, first successful caller wins.
    function mint() external returns (uint256 tokenId) {
        tokenId = block.number;
        if (_data[tokenId] != address(0)) revert AlreadyMinted();
        _data[tokenId] = _store(abi.encode(SingleBlockData.capture()));
        ++totalSupply;
        latestTokenId = tokenId;
        _safeMint(msg.sender, tokenId);
    }

    function blockData(uint256 tokenId) public view returns (SingleBlockData.Info memory info) {
        _requireOwned(tokenId);
        address ptr = _data[tokenId];
        uint256 size = ptr.code.length - 1;
        bytes memory raw = new bytes(size);
        assembly ("memory-safe") { extcodecopy(ptr, add(raw, 32), 1, size) }
        info = abi.decode(raw, (SingleBlockData.Info));
    }

    function seedOf(uint256 tokenId) public view returns (bytes32) {
        return SingleBlockData.seed(blockData(tokenId));
    }

    function _artwork(uint256 tokenId) private view returns (bytes memory) {
        return SingleBlockData.artwork(blockData(tokenId));
    }

    function sceneOf(uint256 tokenId) public view returns (uint256) {
        return _artwork(tokenId).scene();
    }

    /// @notice The token's raw GIF: 128x128, 90 frames at 15fps, a 6-second loop.
    function gif(uint256 tokenId) external view returns (bytes memory) {
        InPlace.ret(_gif(_artwork(tokenId)));
    }

    /// @notice Original-file alternative, generated from exactly the same immutable block.
    function avi(uint256 tokenId) external view returns (bytes memory) {
        InPlace.ret(InPlace.call(address(renderer), abi.encodeCall(BlockArtRenderer.avi, (_artwork(tokenId)))));
    }

    function _gif(bytes memory e) private view returns (bytes memory) {
        return InPlace.call(address(renderer), abi.encodeCall(BlockArtRenderer.gif, (e)));
    }

    /// @notice JSON metadata with the GIF (in its pixelated SVG wrapper), all produced in one read-only call.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        SingleBlockData.Info memory info = blockData(tokenId);
        bytes memory e = SingleBlockData.artwork(info);
        uint256 scene = e.scene();
        bytes memory pre = abi.encodePacked(
            '{"name":"',
            renderer.sceneName(scene),
            " #",
            tokenId.toString(),
            '","description":"One Ethereum block. One six-second night. Generated entirely in Solidity from block ',
            tokenId.toString(),
            " using its number, timestamp, gas limit, base fee, prevrandao, beneficiary and chain ID.",
            '","image":"',
            SVG_HEAD
        );
        bytes memory post = abi.encodePacked(
            SVG_TAIL,
            '","attributes":[{"trait_type":"Art Version","value":"BLOCKS_SINGLE_V1"},{"trait_type":"Scene","value":"',
            renderer.sceneName(scene),
            '"},{"trait_type":"Rare","value":"',
            scene == 7 ? "Yes" : "No",
            '"},{"trait_type":"Block","value":',
            tokenId.toString(),
            '},{"trait_type":"Timestamp","value":',
            info.timestamp.toString(),
            '},{"trait_type":"Gas Limit","value":',
            info.gasLimit.toString(),
            '},{"trait_type":"Base Fee (wei)","value":',
            info.baseFee.toString(),
            '},{"trait_type":"Chain ID","value":',
            info.chainId.toString(),
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
