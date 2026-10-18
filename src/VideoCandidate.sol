// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {VideoNFT} from "./VideoNFT.sol";
import {AviRleVideo} from "./AviRleVideo.sol";

/// @notice One-token compatibility canary. Same renderer and tokenURI as the video edition.
/// @dev Constructor mints to the deployer; every subsequent mint reverts, with no admin path.
contract VideoCandidate is VideoNFT {
    uint256 public constant CANDIDATE_SUPPLY = 1;

    constructor(AviRleVideo renderer_) VideoNFT(renderer_) {
        _mintNext(msg.sender);
    }

    function name() public pure override returns (string memory) {
        return "ghoulballs video candidate";
    }

    function _mintNext(address recipient) internal override returns (uint256 tokenId) {
        if (totalSupply >= CANDIDATE_SUPPLY) revert SoldOut();
        return super._mintNext(recipient);
    }
}
