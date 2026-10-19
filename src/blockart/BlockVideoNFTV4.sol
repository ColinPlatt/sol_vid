// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {BlockVideoRendererV4} from "./BlockVideoRendererV4.sol";
import {VideoRecipeV3} from "./VideoRecipeV3.sol";
import {InPlace} from "./InPlace.sol";

/// @notice One free NFT per mint block. mint() captures only that block's EVM-visible information.
/// @dev No owner, supplied headers, caller seed, privileged mint or dependence on future/previous block data.
contract BlockVideoNFTV4 is ERC721 {
    using Strings for uint256;

    error AlreadyMinted();
    error InvalidRenderer();
    error StoreFailed();

    // Collection name and symbol selected by the user.
    string public constant COLLECTION_NAME = "blocks";
    string public constant COLLECTION_SYMBOL = "blocks";
    uint256 public constant WIDTH = 128;
    uint256 public constant HEIGHT = 128;
    uint256 public constant FPS = 15;
    string public constant FORMAT = "AVI BI_RGB";
    string public constant ART_VERSION = "BLOCKS_VIDEO_V4";

    BlockVideoRendererV4 public immutable renderer;
    uint256 public totalSupply;
    /// @dev Block number -> STOP-prefixed data contract holding the immutable single-block record.
    mapping(uint256 => address) private _data;
    uint256 public latestTokenId;

    constructor(BlockVideoRendererV4 renderer_) ERC721(COLLECTION_NAME, COLLECTION_SYMBOL) {
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
        return VideoRecipeV3.seed(blockData(tokenId));
    }

    function sceneOf(uint256 tokenId) external view returns (uint256) {
        return renderer.sceneOf(blockData(tokenId));
    }

    function recipeOf(uint256 tokenId) external view returns (VideoRecipeV3.Recipe memory) {
        return VideoRecipeV3.recipe(blockData(tokenId));
    }

    function video(uint256 tokenId) external view returns (bytes memory) {
        InPlace.forward(address(renderer), abi.encodeCall(renderer.video, (blockData(tokenId))));
    }

    function imageURI(uint256 tokenId) external view returns (string memory) {
        InPlace.forward(address(renderer), abi.encodeCall(renderer.imageURI, (blockData(tokenId))));
    }

    function animationURI(uint256 tokenId) external view returns (string memory) {
        InPlace.forward(address(renderer), abi.encodeCall(renderer.animationURI, (blockData(tokenId))));
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        InPlace.forward(address(renderer), abi.encodeCall(renderer.tokenURI, (blockData(tokenId))));
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
