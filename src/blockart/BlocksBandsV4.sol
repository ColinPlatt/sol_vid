// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlocksHud} from "./BlocksHud.sol";
import {SingleBlockData} from "./SingleBlockData.sol";
import {BlockExtras} from "./BlockExtras.sol";
import {Strings} from "../../vendor/openzeppelin/Flattened.sol";

/// @notice Formats a block's captured data into BLOCKS_VIDEO_V4's header, footer and ticker bitmaps. A separate
///         contract keeps the fonts and formatting out of the size-limited renderer.
contract BlocksBandsV4 {
    using Strings for uint256;

    function bands(SingleBlockData.Info memory info, BlockExtras.Extras memory x, uint256 hue)
        external
        pure
        returns (bytes memory header, bytes memory footer, bytes memory ticker, uint256 period)
    {
        BlocksHud.Bands memory b = BlocksHud.bands(info, x, hue);
        return (b.header, b.footer, b.ticker, b.period);
    }

    /// @dev The block-data metadata attributes, as a fragment that follows a numeric attribute value.
    function blockTraits(SingleBlockData.Info memory info, BlockExtras.Extras memory x)
        external
        pure
        returns (string memory)
    {
        string memory core = string.concat(
            '},{"trait_type":"Block","value":',
            info.number.toString(),
            '},{"trait_type":"Timestamp","value":',
            info.timestamp.toString(),
            '},{"trait_type":"Gas Limit","value":',
            info.gasLimit.toString(),
            '},{"trait_type":"Base Fee (wei)","value":',
            info.baseFee.toString(),
            '},{"trait_type":"Chain ID","value":',
            info.chainId.toString()
        );
        return string.concat(
            core,
            '},{"trait_type":"Parent Hash","value":"',
            uint256(x.parentHash).toHexString(32),
            '"},{"trait_type":"L1 Block","value":',
            x.l1Number.toString(),
            '},{"trait_type":"L1 Base Fee (wei)","value":',
            x.l1BaseFee.toString(),
            '},{"trait_type":"Blob Base Fee (wei)","value":',
            x.blobBaseFee.toString()
        );
    }
}
