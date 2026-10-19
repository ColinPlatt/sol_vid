// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Base64, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {BlockArtRenderer} from "./BlockArtRenderer.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {VideoRecipeV3} from "./VideoRecipeV3.sol";
import {AviVariationV4} from "./AviVariationV4.sol";
import {BlocksHud} from "./BlocksHud.sol";
import {BlocksBandsV4} from "./BlocksBandsV4.sol";
import {BlockExtras} from "./BlockExtras.sol";
import {AviPoster} from "./AviPoster.sol";
import {BlocksAviPlayer} from "./BlocksAviPlayer.sol";
import {DataURI} from "./DataURI.sol";
import {InPlace} from "./InPlace.sol";

/// @notice BLOCKS_VIDEO_V4: poster, original AVI with block-data bands, decoder and metadata in one static call.
contract BlockVideoRendererV4 {
    using Strings for uint256;
    BlockArtRenderer public immutable scenes;
    BlocksBandsV4 public immutable bands;

    constructor(BlockArtRenderer scenes_, BlocksBandsV4 bands_) {
        require(address(scenes_).code.length != 0 && address(bands_).code.length != 0, "Missing scenes");
        scenes = scenes_;
        bands = bands_;
    }

    function _bands(SingleBlockData.Info memory info, BlockExtras.Extras memory x, uint256 hue)
        private
        view
        returns (BlocksHud.Bands memory b)
    {
        (b.header, b.footer, b.pages, b.count) = bands.bands(info, x, hue);
    }

    function sceneOf(SingleBlockData.Info memory info) external view returns (uint256) {
        return scenes.sceneOf(VideoRecipeV3.artwork(info));
    }

    function _video(SingleBlockData.Info memory info, BlockExtras.Extras memory x) private view returns (bytes memory) {
        bytes memory movie = InPlace.call(address(scenes), abi.encodeCall(scenes.avi, (VideoRecipeV3.artwork(info))));
        VideoRecipeV3.Recipe memory r = VideoRecipeV3.recipe(info);
        return AviVariationV4.remix(movie, r, scenes.sceneOf(VideoRecipeV3.artwork(info)), _bands(info, x, r.hue));
    }

    function video(SingleBlockData.Info memory info, BlockExtras.Extras memory x) external view returns (bytes memory) {
        InPlace.ret(_video(info, x));
    }

    function _image(bytes memory movie) private pure returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", Base64.encode(AviPoster.svg(movie)));
    }

    function imageURI(SingleBlockData.Info memory info, BlockExtras.Extras memory x)
        external
        view
        returns (string memory)
    {
        InPlace.ret(bytes(_image(_video(info, x))));
    }

    function animationURI(SingleBlockData.Info memory info, BlockExtras.Extras memory x)
        external
        view
        returns (string memory)
    {
        InPlace.ret(
            bytes(
                string.concat(
                    "data:text/html,", BlocksAviPlayer.HEAD, Base64.encode(_video(info, x)), BlocksAviPlayer.TAIL
                )
            )
        );
    }

    function tokenURI(SingleBlockData.Info memory info, BlockExtras.Extras memory x)
        external
        view
        returns (string memory)
    {
        bytes memory movie = _video(info, x);
        VideoRecipeV3.Recipe memory r = VideoRecipeV3.recipe(info);
        uint256 scene = scenes.sceneOf(VideoRecipeV3.artwork(info));
        bytes memory pre = abi.encodePacked(
            '{"name":"',
            scenes.sceneName(scene),
            " #",
            info.number.toString(),
            '","description":"One block. A six-second onchain city with the block\u0027s own data across the top and bottom. Native SVG first-frame poster and a fully embedded lossless AVI player.","image":"',
            _image(movie),
            '","animation_url":"data:text/html,',
            BlocksAviPlayer.HEAD
        );
        bytes memory post = abi.encodePacked(
            BlocksAviPlayer.TAIL,
            '","attributes":[{"trait_type":"Art Version","value":"BLOCKS_VIDEO_V4"},{"trait_type":"Scene","value":"',
            scenes.sceneName(scene),
            '"},{"trait_type":"Rare","value":"',
            scene == 7 ? "Yes" : "No",
            '"},{"trait_type":"Hue","value":',
            r.hue.toString(),
            '},{"trait_type":"Saturation","value":',
            r.saturation.toString(),
            '},{"trait_type":"Height Band","value":',
            r.heightBand.toString(),
            '},{"trait_type":"Window Density","value":',
            r.density.toString(),
            '},{"trait_type":"Street Layout","value":',
            r.layout.toString(),
            '},{"trait_type":"Direction","value":"',
            r.reverse ? "Reverse" : "Forward",
            '"},{"trait_type":"Phase","value":',
            r.phase.toString(),
            bands.blockTraits(info, x),
            '},{"trait_type":"Duration Seconds","value":6},{"trait_type":"FPS","value":15},',
            '{"trait_type":"Format","value":"AVI BI_RGB"},{"trait_type":"Width","value":128},{"trait_type":"Height","value":128}]}'
        );
        // This generic double-base64 streamer also works for AVI; no full inner-encoded movie copy.
        InPlace.ret(bytes(DataURI.jsonWithGif(pre, movie, post)));
    }
}
