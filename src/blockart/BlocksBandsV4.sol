// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlocksHud} from "./BlocksHud.sol";
import {SingleBlockData} from "./SingleBlockData.sol";

/// @notice Formats a block's captured data into BLOCKS_VIDEO_V4's header, footer and ticker bitmaps. A separate
///         contract keeps the fonts and formatting out of the size-limited renderer.
contract BlocksBandsV4 {
    function bands(SingleBlockData.Info memory info, uint256 hue)
        external
        pure
        returns (bytes memory header, bytes memory footer, bytes memory ticker, uint256 period)
    {
        BlocksHud.Bands memory b = BlocksHud.bands(info, hue);
        return (b.header, b.footer, b.ticker, b.period);
    }
}
