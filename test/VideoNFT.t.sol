// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {VideoNFT} from "../src/VideoNFT.sol";
import {AviRleVideo} from "../src/AviRleVideo.sol";
import {IERC721Receiver} from "../vendor/openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Vm} from "./SolVideo.t.sol";

interface VmNFT is Vm {
    function toString(address value) external pure returns (string memory);
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function store(address target, bytes32 slot, bytes32 value) external;
    function load(address target, bytes32 slot) external view returns (bytes32);
    function deal(address account, uint256 balance) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes calldata data) external;
}

contract VideoRejectingReceiver {}

contract VideoReentrantMinter is IERC721Receiver {
    VideoNFT immutable nft;
    bool entered;

    constructor(VideoNFT nft_) {
        nft = nft_;
    }

    function start() external {
        nft.mintTo(address(this));
    }

    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(nft), "Wrong collection");
        require(nft.ownerOf(id) == address(this) && nft.totalSupply() >= id, "Incoherent callback state");
        if (!entered) {
            entered = true;
            nft.mint();
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract VideoNFTTest is IERC721Receiver {
    VmNFT constant vm = VmNFT(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(uint160(0xA11CE));
    address constant BOB = address(uint160(0xB0B));
    AviRleVideo renderer;
    VideoNFT nft;

    event log_named_uint(string key, uint256 val);

    function setUp() public {
        renderer = new AviRleVideo();
        nft = new VideoNFT(renderer);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function testInterfacesAndInitialState() public view {
        require(nft.supportsInterface(0x01ffc9a7), "Missing ERC165");
        require(nft.supportsInterface(0x80ac58cd), "Missing ERC721");
        require(nft.supportsInterface(0x5b5e139f), "Missing metadata");
        require(!nft.supportsInterface(0xffffffff), "Invalid interface supported");
        require(nft.MAX_SUPPLY() == 6667, "Wrong supply cap");
        require(nft.totalSupply() == 0 && address(nft.renderer()) == address(renderer), "Bad initial state");
        require(keccak256(bytes(nft.name())) == keccak256("ghoulballs"), "Bad name");
        require(keccak256(bytes(nft.symbol())) == keccak256("ghoulballs"), "Bad symbol");
    }

    function testFreeMintAndGifting() public {
        uint256 beforeGas = gasleft();
        uint256 first = nft.mint();
        emit log_named_uint("first mint gas including receiver callback", beforeGas - gasleft());
        vm.prank(BOB);
        uint256 second = nft.mintTo(ALICE);
        require(first == 1 && second == 2 && nft.totalSupply() == 2, "Nonsequential IDs");
        require(nft.ownerOf(1) == address(this) && nft.ownerOf(2) == ALICE, "Wrong recipient");
        require(nft.balanceOf(address(this)) == 1 && nft.balanceOf(ALICE) == 1, "Wrong balance");
        require(address(nft).balance == 0, "Mint collected payment");
    }

    function testOneMintPerCallerAddress() public {
        vm.startPrank(ALICE);
        nft.mint();
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.AlreadyMinted.selector));
        nft.mint();
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.AlreadyMinted.selector));
        nft.mintTo(BOB);
        vm.stopPrank();
        require(nft.hasMinted(ALICE) && !nft.hasMinted(BOB), "Wrong minted flags");
        // Receiving a gift does not use the recipient's own mint, and transfers do not reset it.
        vm.prank(BOB);
        nft.mintTo(ALICE);
        vm.prank(ALICE);
        nft.transferFrom(ALICE, BOB, 1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.AlreadyMinted.selector));
        nft.mint();
        require(nft.totalSupply() == 2 && nft.balanceOf(ALICE) == 1 && nft.balanceOf(BOB) == 1, "Wrong supply");
    }

    function testPaymentIsRejected() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(nft).call{value: 1}(abi.encodeCall(nft.mint, ()));
        require(!ok && nft.totalSupply() == 0 && address(nft).balance == 0, "Paid mint accepted");
    }

    function testRejectedSafeMintRollsBackCounterAndMintFlag() public {
        VideoRejectingReceiver receiver = new VideoRejectingReceiver();
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(receiver)));
        nft.mintTo(address(receiver));
        require(nft.totalSupply() == 0 && !nft.hasMinted(address(this)), "Failed mint changed state");
        require(nft.mintTo(ALICE) == 1, "Failed mint consumed ID");
    }

    function testZeroRecipientRejected() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(uint160(0))));
        nft.mintTo(address(uint160(0)));
        require(nft.totalSupply() == 0, "Zero recipient consumed ID");
    }

    function testReentrantSecondMintFromSameCallerReverts() public {
        VideoReentrantMinter receiver = new VideoReentrantMinter(nft);
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.AlreadyMinted.selector));
        receiver.start();
        require(nft.totalSupply() == 0 && nft.balanceOf(address(receiver)) == 0, "Reentrant mint escaped rollback");
    }

    function testSupplyCapBothMintPaths() public {
        nft.mint();
        // Jump the counter (storage slot 6) to just before the cap instead of minting 6,665 more.
        require(uint256(vm.load(address(nft), bytes32(uint256(6)))) == 1, "totalSupply slot moved");
        vm.store(address(nft), bytes32(uint256(6)), bytes32(uint256(6666)));
        vm.prank(BOB);
        require(nft.mintTo(BOB) == 6667 && nft.ownerOf(6667) == BOB, "Final mint failed");
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.SoldOut.selector));
        nft.mint();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(VideoNFT.SoldOut.selector));
        nft.mintTo(ALICE);
        require(nft.totalSupply() == 6667, "Supply exceeded cap");
    }

    function testNonexistentMediaRevertsBeforeRendering() public {
        (bool ok,) = address(nft).staticcall{gas: 100_000}(abi.encodeCall(nft.video, (1)));
        require(!ok, "Nonexistent video accepted");
        (ok,) = address(nft).staticcall{gas: 100_000}(abi.encodeCall(nft.tokenURI, (1)));
        require(!ok, "Nonexistent metadata accepted");
    }

    function testTransfersApprovalsAndStableSeed() public {
        nft.mintTo(ALICE);
        uint256 seed = nft.seedOf(1);
        vm.expectRevert(
            abi.encodeWithSignature("ERC721InsufficientApproval(address,uint256)", address(this), uint256(1))
        );
        nft.transferFrom(ALICE, BOB, 1);
        vm.prank(ALICE);
        nft.approve(BOB, 1);
        vm.prank(BOB);
        nft.transferFrom(ALICE, BOB, 1);
        require(nft.ownerOf(1) == BOB && nft.getApproved(1) == address(uint160(0)), "Approval not cleared");
        vm.prank(BOB);
        nft.setApprovalForAll(ALICE, true);
        vm.prank(ALICE);
        nft.safeTransferFrom(BOB, address(this), 1);
        vm.warp(block.timestamp + 365 days);
        require(nft.seedOf(1) == seed, "Seed changed on transfer or time");
        require(
            nft.balanceOf(ALICE) == 0 && nft.balanceOf(BOB) == 0 && nft.balanceOf(address(this)) == 1, "Wrong balances"
        );
    }
}

contract VideoMetadataTest is IERC721Receiver {
    VmNFT constant vm = VmNFT(address(uint160(uint256(keccak256("hevm cheat code")))));
    event log_named_uint(string key, uint256 val);

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function testCompleteMetadataBudget() public {
        AviRleVideo renderer = new AviRleVideo();
        VideoNFT nft = new VideoNFT(renderer);
        nft.mint();
        require(address(renderer).code.length <= 24576 && address(nft).code.length <= 24576, "Base runtime limit");
        _measure(nft, abi.encodeCall(nft.video, (1)), "video");
        _measure(nft, abi.encodeCall(nft.animationURI, (1)), "animation");
        _measure(nft, abi.encodeCall(nft.tokenURI, (1)), "metadata");
        vm.writeFile("previews/video/nft-seed.txt", vm.toString(nft.seedOf(1)));
        vm.writeFile("previews/video/nft-poster.svg", renderer.posterFromSeed(nft.seedOf(1)));
    }

    function _measure(VideoNFT nft, bytes memory input, string memory label) private {
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: 500_000_000}(input);
        uint256 used = beforeGas - gasleft();
        require(ok && used <= 500_000_000, "Full read exceeds 500M");
        bytes memory output = abi.decode(result, (bytes));
        vm.writeFileBinary(string.concat("previews/video/nft-", label, ".bin"), output);
        vm.writeFile(
            string.concat("previews/video/nft-", label, ".json"),
            string.concat('{"gas":', vm.toString(used), ',"bytes":', vm.toString(output.length), "}")
        );
        emit log_named_uint(label, used);
    }
}
