// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {DeployVideo, DeployVideoBase, DeployVideoBaseSepolia} from "../script/DeployVideo.s.sol";
import {VideoCandidate} from "../src/VideoCandidate.sol";
import {AviRleVideo} from "../src/AviRleVideo.sol";
import {VideoNFT} from "../src/VideoNFT.sol";
import {VmProbeChain} from "./DeployMarketplaceProbe.t.sol";
import {IERC721Receiver} from "../vendor/openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract DeployVideoTest is IERC721Receiver {
    VmProbeChain constant vm = VmProbeChain(address(uint160(uint256(keccak256("hevm cheat code")))));

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function testBaseRejectsWrongChain() public {
        vm.chainId(11155111);
        DeployVideoBase script = new DeployVideoBase();
        vm.expectRevert(abi.encodeWithSelector(DeployVideo.WrongChain.selector, 11155111));
        script.run();
    }

    function testBaseSepoliaRejectsBase() public {
        vm.chainId(8453);
        DeployVideoBaseSepolia script = new DeployVideoBaseSepolia();
        vm.expectRevert(abi.encodeWithSelector(DeployVideo.WrongChain.selector, 8453));
        script.run();
    }

    function testCandidateHasOnlyConstructorMint() public {
        VideoCandidate nft = new VideoCandidate(new AviRleVideo());
        require(nft.totalSupply() == 1 && nft.ownerOf(1) == address(this), "Missing canary");
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.SoldOut.selector));
        nft.mint();
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.SoldOut.selector));
        nft.mintTo(address(this));
    }
}
