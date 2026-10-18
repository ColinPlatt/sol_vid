// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Base64, Strings} from "../../vendor/openzeppelin/Flattened.sol";
import {BlockArtRenderer} from "./BlockArtRenderer.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {VideoRecipe} from "./VideoRecipe.sol";
import {AviVariation} from "./AviVariation.sol";
import {AviPoster} from "./AviPoster.sol";
import {BlocksAviPlayer} from "./BlocksAviPlayer.sol";
import {DataURI} from "./DataURI.sol";
import {InPlace} from "./InPlace.sol";

/// @notice Poster, original AVI, decoder and metadata in one static call; no GIF in the new metadata.
contract BlockVideoRenderer {
    using Strings for uint256;
    BlockArtRenderer public immutable scenes;

    constructor(BlockArtRenderer scenes_) {
        require(address(scenes_).code.length != 0, "Missing scenes");
        scenes = scenes_;
    }

    function sceneOf(SingleBlockData.Info memory info) external view returns (uint256) {
        return scenes.sceneOf(VideoRecipe.artwork(info));
    }

    function _video(SingleBlockData.Info memory info) private view returns (bytes memory) {
        bytes memory movie = InPlace.call(address(scenes), abi.encodeCall(scenes.avi, (VideoRecipe.artwork(info))));
        return AviVariation.remix(movie, VideoRecipe.recipe(info), scenes.sceneOf(VideoRecipe.artwork(info)));
    }

    function video(SingleBlockData.Info memory info) external view returns (bytes memory) {
        InPlace.ret(_video(info));
    }

    function _image(bytes memory movie) private pure returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", Base64.encode(AviPoster.svg(movie)));
    }

    function imageURI(SingleBlockData.Info memory info) external view returns (string memory) {
        InPlace.ret(bytes(_image(_video(info))));
    }

    function animationURI(SingleBlockData.Info memory info) external view returns (string memory) {
        InPlace.ret(
            bytes(
                string.concat(
                    "data:text/html,", BlocksAviPlayer.HEAD, Base64.encode(_video(info)), BlocksAviPlayer.TAIL
                )
            )
        );
    }

    function tokenURI(SingleBlockData.Info memory info) external view returns (string memory) {
        bytes memory movie = _video(info);
        VideoRecipe.Recipe memory r = VideoRecipe.recipe(info);
        uint256 scene = scenes.sceneOf(VideoRecipe.artwork(info));
        bytes memory pre = abi.encodePacked(
            '{"name":"',
            scenes.sceneName(scene),
            " #",
            info.number.toString(),
            '","description":"One Ethereum block. A six-second onchain city. Native SVG first-frame poster and a fully embedded lossless AVI player.","image":"',
            _image(movie),
            '","animation_url":"data:text/html,',
            BlocksAviPlayer.HEAD
        );
        bytes memory post = abi.encodePacked(
            BlocksAviPlayer.TAIL,
            '","attributes":[{"trait_type":"Art Version","value":"BLOCKS_VIDEO_V2"},{"trait_type":"Scene","value":"',
            scenes.sceneName(scene),
            '"},{"trait_type":"Rare","value":"',
            scene == 7 ? "Yes" : "No",
            '"},{"trait_type":"Colourway","value":"',
            VideoRecipe.colourwayName(r.colourway),
            '"},{"trait_type":"Light","value":"',
            VideoRecipe.lightName(r.light),
            '"},{"trait_type":"Direction","value":"',
            r.reverse ? "Reverse" : "Forward",
            '"},{"trait_type":"Phase","value":',
            r.phase.toString(),
            '},{"trait_type":"Block","value":',
            info.number.toString(),
            '},{"trait_type":"Timestamp","value":',
            info.timestamp.toString(),
            '},{"trait_type":"Gas Limit","value":',
            info.gasLimit.toString(),
            '},{"trait_type":"Base Fee (wei)","value":',
            info.baseFee.toString(),
            '},{"trait_type":"Chain ID","value":',
            info.chainId.toString(),
            '},{"trait_type":"Duration Seconds","value":6},{"trait_type":"FPS","value":15},',
            '{"trait_type":"Format","value":"AVI BI_RGB"},{"trait_type":"Width","value":128},{"trait_type":"Height","value":128}]}'
        );
        // This generic double-base64 streamer also works for AVI; no full inner-encoded movie copy.
        InPlace.ret(bytes(DataURI.jsonWithGif(pre, movie, post)));
    }
}
