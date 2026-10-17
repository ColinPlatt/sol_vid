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
        require(nft.MAX_MINTS() == 6667 && nft.MAX_SUPPLY() == 20001 && nft.TOKENS_PER_MINT() == 3, "Wrong caps");
        require(nft.totalSupply() == 0 && nft.totalMinted() == 0, "Bad initial supply");
        require(address(nft.renderer()) == address(renderer), "Bad renderer");
        require(keccak256(bytes(nft.name())) == keccak256("ghoulballs"), "Bad name");
        require(keccak256(bytes(nft.symbol())) == keccak256("ghoulballs"), "Bad symbol");
    }

    function testMintIsASetOfThreeSharingOneSeed() public {
        uint256 beforeGas = gasleft();
        uint256 first = nft.mint();
        emit log_named_uint("first mint gas, three tokens including receiver callbacks", beforeGas - gasleft());
        require(first == 1 && nft.totalSupply() == 3 && nft.totalMinted() == 1, "Wrong set IDs");
        require(nft.balanceOf(address(this)) == 3 && address(nft).balance == 0, "Wrong balance or payment");
        for (uint256 id = 1; id <= 3; ++id) {
            require(nft.ownerOf(id) == address(this) && nft.editionOf(id) == 1, "Wrong set member");
            require(nft.formatOf(id) == id - 1 && nft.seedOf(id) == nft.seedOf(1), "Wrong format or seed");
        }
        vm.prank(BOB);
        require(nft.mintTo(ALICE) == 4 && nft.ownerOf(6) == ALICE && nft.balanceOf(ALICE) == 3, "Gift failed");
        require(nft.editionOf(4) == 2 && nft.formatOf(6) == 2, "Second set misnumbered");
        require(nft.seedOf(4) != nft.seedOf(1), "Sets share a seed");
        require(
            nft.seedOf(1)
                == uint256(keccak256(abi.encode("GHOULBALLS_SET_V1", block.chainid, address(nft), uint256(1)))),
            "Seed derivation changed"
        );
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
        require(nft.totalSupply() == 6 && nft.balanceOf(ALICE) == 5, "Wrong supply");
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
        require(nft.mintTo(ALICE) == 1, "Failed mint consumed IDs");
    }

    function testZeroRecipientRejected() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(uint160(0))));
        nft.mintTo(address(uint160(0)));
        require(nft.totalSupply() == 0, "Zero recipient consumed IDs");
    }

    function testReentrantSecondMintFromSameCallerReverts() public {
        ReentrantMinter receiver = new ReentrantMinter(nft);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.AlreadyMinted.selector));
        receiver.start();
        require(nft.totalSupply() == 0 && nft.balanceOf(address(receiver)) == 0, "Reentrant mint escaped rollback");
    }

    function testSupplyCapAfterAllSets() public {
        nft.mint();
        // Jump the counter (storage slot 6) to just before the final set instead of minting 6,665 more.
        require(uint256(vm.load(address(nft), bytes32(uint256(6)))) == 3, "totalSupply slot moved");
        vm.store(address(nft), bytes32(uint256(6)), bytes32(uint256(20_001 - 3)));
        require(nft.totalMinted() == 6666, "Wrong supply before final set");
        vm.prank(BOB);
        require(nft.mintTo(BOB) == 19_999 && nft.ownerOf(20_001) == BOB, "Final set failed");
        require(nft.formatOf(20_001) == 2 && nft.editionOf(20_001) == 6667, "Final set misnumbered");
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.SoldOut.selector));
        nft.mint();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.SoldOut.selector));
        nft.mintTo(ALICE);
        require(nft.totalSupply() == 20_001 && nft.totalMinted() == 6667, "Supply exceeded cap");
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
        require(nft.seedOf(1) == seed && nft.seedOf(3) == seed, "Seed changed on transfer or time");
        require(nft.balanceOf(ALICE) == 2 && nft.balanceOf(BOB) == 0 && nft.balanceOf(address(this)) == 1, "Balances");
    }

    function testNonexistentMediaRevertsBeforeRendering() public {
        bytes memory missing = abi.encodeWithSignature("ERC721NonexistentToken(uint256)", uint256(1));
        vm.expectRevert(missing);
        nft.tokenURI(1);
        vm.expectRevert(missing);
        nft.seedOf(1);
        vm.expectRevert(missing);
        nft.formatOf(1);
        vm.expectRevert(missing);
        nft.imageURI(1);
        vm.expectRevert(missing);
        nft.animationURI(1);
        vm.expectRevert(missing);
        nft.mpeg(1);
    }

    function testRejectsMissingRenderer() public {
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.InvalidRenderer.selector));
        new SolVideoNFT(GenerativeVideo(address(uint160(0))));
        vm.expectRevert(abi.encodeWithSelector(SolVideoNFT.InvalidRenderer.selector));
        new SolVideoNFT(GenerativeVideo(ALICE));
    }

    /// @dev A real 500M-capped STATICCALL of one token's full tokenURI, including ABI return copy.
    function _measure(uint256 id) private view returns (uint256 used, string memory uri) {
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: 500_000_000}(abi.encodeCall(nft.tokenURI, (id)));
        used = beforeGas - gasleft();
        require(ok, "tokenURI exceeds 500M");
        uri = abi.decode(result, (string));
    }

    /// @dev Export all three tokens of a set with their measurements, for scripts/validate_nft.py.
    function _export(string memory label, uint256 first) private {
        string[3] memory names = ["gif", "avi", "mpeg"];
        for (uint256 f; f < 3; ++f) {
            (uint256 used, string memory uri) = _measure(first + f);
            emit log_named_uint(string.concat(label, " ", names[f], " tokenURI gas"), used);
            emit log_named_uint(string.concat(label, " ", names[f], " tokenURI bytes"), bytes(uri).length);
            string memory stem = string.concat("previews/nft/", label, "-", names[f]);
            vm.writeFile(string.concat(stem, ".uri.txt"), uri);
            vm.writeFile(
                string.concat(stem, ".json"),
                string.concat(
                    '{"token_id":',
                    vm.toString(first + f),
                    ',"set":',
                    vm.toString(nft.editionOf(first)),
                    ',"seed":"',
                    vm.toString(nft.seedOf(first)),
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
        }
        string memory base = string.concat("previews/nft/", label);
        vm.writeFileBinary(string.concat(base, ".recipe.abi"), abi.encode(nft.recipeOf(first)));
        vm.writeFileBinary(string.concat(base, ".avi"), nft.avi(first));
        vm.writeFileBinary(string.concat(base, ".image-uri.abi"), abi.encode(nft.imageURI(first)));
        vm.writeFileBinary(string.concat(base, ".avi-animation-uri.abi"), abi.encode(nft.animationURI(first + 1)));
        vm.writeFileBinary(string.concat(base, ".mpeg-animation-uri.abi"), abi.encode(nft.animationURI(first + 2)));
    }

    function testFirstSetMetadataWithin500M() public {
        nft.mintTo(ALICE);
        _export("set-1", 1);
    }

    /// @dev Six-ball sets among the first 128 with the largest summed squared radii, one per motion.
    function _sixBallSamples() private returns (uint256[] memory selected) {
        selected = new uint256[](4);
        uint256[] memory areas = new uint256[](4);
        for (uint256 i = 1; i <= 128; ++i) {
            vm.prank(address(uint160(0x20000 + i)));
            uint256 first = nft.mintTo(ALICE);
            GenerativeVideo.Recipe memory r = nft.recipeOf(first);
            if (r.ballCount != 6) continue;
            uint256 area;
            for (uint256 b; b < 6; ++b) {
                area += r.balls[b].radius * r.balls[b].radius;
            }
            if (area > areas[r.motion]) {
                areas[r.motion] = area;
                selected[r.motion] = first;
            }
        }
        for (uint256 style; style < 4; ++style) {
            require(selected[style] != 0, "Missing six-ball motion sample");
        }
    }

    /// @dev The MPEG token is the most expensive; check a large six-ball set for every motion.
    function testSixBallMpegMetadataBudgetForEveryMotion() public {
        uint256[] memory selected = _sixBallSamples();
        for (uint256 style; style < 4; ++style) {
            (uint256 used,) = _measure(selected[style] + 2);
            emit log_named_uint(string.concat(renderer.motionName(style), " MPEG tokenURI gas"), used);
        }
    }

    /// @dev Export the heaviest of those sets (Figure Eight) in full.
    function testStressSetMetadataWithin500M() public {
        uint256 first = _sixBallSamples()[3];
        emit log_named_uint("stress set", nft.editionOf(first));
        _export("stress", first);
    }
}
