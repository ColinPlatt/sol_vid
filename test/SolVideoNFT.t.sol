// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SolVideoNFT} from "../src/SolVideoNFT.sol";
import {GenerativeVideo} from "../src/GenerativeVideo.sol";
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

contract RejectingReceiver {}

contract ReentrantMinter is IERC721Receiver {
    SolVideoNFT immutable nft;
    bool entered;

    constructor(SolVideoNFT nft_) {
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

contract SolVideoNFTTest is IERC721Receiver {
    VmNFT constant vm = VmNFT(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(uint160(0xA11CE));
    address constant BOB = address(uint160(0xB0B));
    GenerativeVideo renderer;
    SolVideoNFT nft;

    event log_named_uint(string key, uint256 val);

    function setUp() public {
        renderer = new GenerativeVideo();
        nft = new SolVideoNFT(renderer);
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
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.AlreadyMinted.selector));
        nft.mint();
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.AlreadyMinted.selector));
        nft.mintTo(BOB);
        vm.stopPrank();
        require(nft.hasMinted(ALICE) && !nft.hasMinted(BOB), "Wrong minted flags");
        // Receiving a gift does not use the recipient's own mint, and transfers do not reset it.
        vm.prank(BOB);
        nft.mintTo(ALICE);
        vm.prank(ALICE);
        nft.transferFrom(ALICE, BOB, 1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.AlreadyMinted.selector));
        nft.mint();
        require(nft.totalSupply() == 2 && nft.balanceOf(ALICE) == 1 && nft.balanceOf(BOB) == 1, "Wrong supply");
    }

    function testPaymentIsRejected() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(nft).call{value: 1}(abi.encodeCall(nft.mint, ()));
        require(!ok && nft.totalSupply() == 0 && address(nft).balance == 0, "Paid mint accepted");
    }

    function testRejectedSafeMintRollsBackCounterAndMintFlag() public {
        RejectingReceiver receiver = new RejectingReceiver();
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
        ReentrantMinter receiver = new ReentrantMinter(nft);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.AlreadyMinted.selector));
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
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.SoldOut.selector));
        nft.mint();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.SoldOut.selector));
        nft.mintTo(ALICE);
        require(nft.totalSupply() == 6667, "Supply exceeded cap");
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

    function testNonexistentMediaRevertsBeforeRendering() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(1)));
        nft.tokenURI(1);
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(1)));
        nft.seedOf(1);
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(1)));
        nft.imageURI(1);
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(1)));
        nft.gif(1);
    }

    function testRejectsMissingRenderer() public {
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.InvalidRenderer.selector));
        new SolVideoNFT(GenerativeVideo(address(uint160(0))));
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.InvalidRenderer.selector));
        new SolVideoNFT(GenerativeVideo(ALICE));
    }

    /// @dev Export the full metadata including both media files, measuring the actual 500M call.
    function testFullTokenURIWithin500M() public {
        nft.mintTo(ALICE);
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: 500_000_000}(abi.encodeCall(nft.tokenURI, (1)));
        uint256 used = beforeGas - gasleft();
        require(ok, "Full tokenURI exceeds 500M");
        string memory uri = abi.decode(result, (string));
        emit log_named_uint("full tokenURI gas including ABI return copy", used);
        emit log_named_uint("tokenURI bytes", bytes(uri).length);
        vm.writeFile("previews/nft/token-1.uri.txt", uri);
        vm.writeFile(
            "previews/nft/token-1.json",
            string.concat(
                '{"token_id":1,"seed":"',
                vm.toString(nft.seedOf(1)),
                '","collection":"',
                vm.toString(address(nft)),
                '","chain_id":',
                vm.toString(block.chainid),
                ',"gas":',
                vm.toString(used),
                ',"uri_bytes":',
                vm.toString(bytes(uri).length),
                "}"
            )
        );
        vm.writeFileBinary("previews/nft/token-1.recipe.abi", abi.encode(nft.recipeOf(1)));
        vm.writeFileBinary("previews/nft/token-1.image-uri.abi", abi.encode(nft.imageURI(1)));
        vm.writeFileBinary("previews/nft/token-1.gif", nft.gif(1));
    }

    function testSixBallMetadataBudgetForEveryMotion() public {
        uint256[] memory selected = new uint256[](4);
        uint256[] memory areas = new uint256[](4);
        for (uint256 id = 1; id <= 128; ++id) {
            vm.prank(address(uint160(0x10000 + id)));
            nft.mintTo(ALICE);
            GenerativeVideo.Recipe memory r = nft.recipeOf(id);
            if (r.ballCount != 6) continue;
            uint256 area;
            for (uint256 i; i < 6; ++i) {
                area += r.balls[i].radius * r.balls[i].radius;
            }
            if (area > areas[r.motion]) {
                areas[r.motion] = area;
                selected[r.motion] = id;
            }
        }
        for (uint256 style; style < 4; ++style) {
            require(selected[style] != 0, "Missing six-ball motion sample");
            uint256 beforeGas = gasleft();
            (bool ok,) = address(nft).staticcall{gas: 500_000_000}(abi.encodeCall(nft.tokenURI, (selected[style])));
            require(ok, "Motion metadata exceeds 500M");
            emit log_named_uint(renderer.motionName(style), beforeGas - gasleft());
        }
    }

    function testLargeSixBallMetadataWithin500M() public {
        uint256 largest;
        uint256 selected;
        for (uint256 id = 1; id <= 64; ++id) {
            vm.prank(address(uint160(0x10000 + id)));
            nft.mintTo(ALICE);
            GenerativeVideo.Recipe memory r = nft.recipeOf(id);
            if (r.ballCount != 6) continue;
            uint256 area;
            for (uint256 i; i < 6; ++i) {
                area += r.balls[i].radius * r.balls[i].radius;
            }
            if (area > largest) {
                largest = area;
                selected = id;
            }
        }
        require(selected != 0, "No six-ball stress sample");
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(nft).staticcall{gas: 500_000_000}(abi.encodeCall(nft.tokenURI, (selected)));
        uint256 used = beforeGas - gasleft();
        require(ok, "Large six-ball tokenURI exceeds budget");
        string memory uri = abi.decode(result, (string));
        emit log_named_uint("six-ball stress token ID", selected);
        emit log_named_uint("six-ball full tokenURI gas", used);
        vm.writeFile("previews/nft/stress.uri.txt", uri);
        vm.writeFile(
            "previews/nft/stress.json",
            string.concat(
                '{"token_id":',
                vm.toString(selected),
                ',"seed":"',
                vm.toString(nft.seedOf(selected)),
                '","collection":"',
                vm.toString(address(nft)),
                '","chain_id":',
                vm.toString(block.chainid),
                ',"gas":',
                vm.toString(used),
                ',"uri_bytes":',
                vm.toString(bytes(uri).length),
                "}"
            )
        );
        vm.writeFileBinary("previews/nft/stress.recipe.abi", abi.encode(nft.recipeOf(selected)));
        vm.writeFileBinary("previews/nft/stress.gif", nft.gif(selected));
    }
}
