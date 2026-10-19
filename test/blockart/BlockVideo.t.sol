// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {BlockVideoNFT} from "../../src/blockart/BlockVideoNFT.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
import {BlockVideoRenderer} from "../../src/blockart/BlockVideoRenderer.sol";
import {VideoRecipe} from "../../src/blockart/VideoRecipe.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {Descent} from "../../src/blockart/scenes/Descent.sol";
import {Monorail} from "../../src/blockart/scenes/Monorail.sol";
import {Spire} from "../../src/blockart/scenes/Spire.sol";
import {Skyline} from "../../src/blockart/scenes/Skyline.sol";
import {Alley} from "../../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../../src/blockart/scenes/Satoyama.sol";

interface VideoVm {
    function roll(uint256) external;
    function warp(uint256) external;
    function fee(uint256) external;
    function coinbase(address) external;
    function prevrandao(bytes32) external;
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function createDir(string calldata, bool) external;
    function writeFile(string calldata, string calldata) external;
    function writeFileBinary(string calldata, bytes calldata) external;
    function toString(uint256) external pure returns (string memory);
}

contract VideoMarker {}

abstract contract VideoReceiver {
    VideoVm constant vm = VideoVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function onERC721Received(address, address, uint256, bytes calldata) external virtual returns (bytes4) {
        return 0x150b7a02;
    }
}

contract VideoReentrantReceiver is VideoReceiver {
    bool public blocked;

    function claim(BlockVideoNFT nft) external {
        nft.mint();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        (bool ok,) = msg.sender.call(abi.encodeWithSignature("mint()"));
        blocked = !ok;
        return 0x150b7a02;
    }
}

contract BlockVideoRulesTest is VideoReceiver {
    BlockVideoNFT nft;

    function setUp() public {
        vm.roll(13000000);
        vm.warp(1800000000);
        vm.chainId(11155111);
        vm.fee(20);
        vm.coinbase(address(0xBEEF));
        vm.prevrandao(bytes32(uint256(123)));
        nft = new BlockVideoNFT(BlockVideoRenderer(address(new VideoMarker())));
    }

    function testCapturesOnlyCurrentBlockAndHasNoArguments() public {
        uint256 id = nft.mint();
        require(id == block.number && nft.ownerOf(id) == address(this));
        SingleBlockData.Info memory b = nft.blockData(id);
        require(
            b.number == block.number && b.timestamp == block.timestamp && b.gasLimit == block.gaslimit
                && b.baseFee == block.basefee && b.prevrandao == block.prevrandao && b.beneficiary == block.coinbase
                && b.chainId == block.chainid
        );
        require(nft.seedOf(id) == VideoRecipe.seed(b));
        require(nft.latestTokenId() == id);
    }

    function testOnePerBlockAndFollowingBlockAllowed() public {
        nft.mint();
        vm.expectRevert();
        nft.mint();
        vm.roll(block.number + 1);
        nft.mint();
        require(nft.totalSupply() == 2);
    }

    function testSeedDoesNotDependOnCallerOrCollection() public {
        uint256 id = nft.mint();
        BlockVideoNFT other = new BlockVideoNFT(nft.renderer());
        vm.prank(address(1234));
        other.mint();
        require(other.seedOf(id) == nft.seedOf(id));
    }

    function testTransferAndFutureBlocksCannotChangeData() public {
        uint256 id = nft.mint();
        bytes32 seed = nft.seedOf(id);
        bytes32 data = keccak256(abi.encode(nft.blockData(id)));
        nft.transferFrom(address(this), address(1234), id);
        vm.roll(block.number + 1000);
        vm.warp(block.timestamp + 12000);
        vm.prevrandao(bytes32(uint256(999)));
        require(
            nft.ownerOf(id) == address(1234) && seed == nft.seedOf(id)
                && data == keccak256(abi.encode(nft.blockData(id)))
        );
    }

    function testReceiverCannotMintTwiceInOneBlock() public {
        VideoReentrantReceiver r = new VideoReentrantReceiver();
        r.claim(nft);
        require(r.blocked() && nft.totalSupply() == 1);
    }

    function testUnmintedMetadataAndDataReject() public {
        vm.expectRevert();
        nft.blockData(1);
        vm.expectRevert();
        nft.tokenURI(1);
    }
}

contract BlockVideoMediaTest is VideoReceiver {
    event log_named_uint(string key, uint256 val);

    function _info(uint256 wanted, uint256 start) private view returns (SingleBlockData.Info memory b) {
        b = SingleBlockData.Info(13000000, 1800000000, block.gaslimit, 20, 0, address(0xBEEF), 11155111);
        for (uint256 n = start; n < start + 10000; ++n) {
            b.prevrandao = n;
            uint256 h = uint256(VideoRecipe.seed(b));
            uint256 s = ((h >> 216) & 255) < 4 ? 7 : (h >> 224) % 7;
            if (s == wanted) return b;
        }
        revert("Scene search exhausted");
    }

    function _measure(address scene, string memory name, uint256 wanted) private {
        SingleBlockData.Info memory b = _info(wanted, 1);
        vm.roll(b.number);
        vm.warp(b.timestamp);
        vm.chainId(b.chainId);
        vm.fee(b.baseFee);
        vm.coinbase(b.beneficiary);
        vm.prevrandao(bytes32(b.prevrandao));
        address[8] memory slots = [scene, scene, scene, scene, scene, scene, scene, scene];
        BlockArtRenderer base = new BlockArtRenderer(slots);
        BlockVideoRenderer renderer = new BlockVideoRenderer(base);
        require(address(renderer).code.length <= 24576, "Renderer exceeds EIP-170");
        BlockVideoNFT nft = new BlockVideoNFT(renderer);
        require(address(nft).code.length <= 24576, "NFT exceeds EIP-170");
        uint256 id = nft.mint();
        b = nft.blockData(id);
        require(nft.sceneOf(id) == wanted, "Selected scene differs from measured scene");
        vm.createDir("previews/ARCHIVE/blocks-video", true);
        string memory stem = string.concat("previews/ARCHIVE/blocks-video/", name);
        uint256 before = gasleft();
        (bool ok, bytes memory result) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.tokenURI, (id)));
        uint256 used = before - gasleft();
        require(ok && used <= 500000000, "Metadata exceeds cap");
        vm.writeFile(string.concat(stem, ".uri"), abi.decode(result, (string)));
        emit log_named_uint(string.concat(name, " complete metadata gas"), used);
        (ok, result) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.video, (id)));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".avi"), abi.decode(result, (bytes)));
        (ok, result) = address(base).staticcall{gas: 500000000}(abi.encodeCall(base.avi, (VideoRecipe.artwork(b))));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".reference.avi"), abi.decode(result, (bytes)));
        VideoRecipe.Recipe memory r = VideoRecipe.recipe(b);
        vm.writeFile(
            string.concat(stem, ".json"),
            string.concat(
                '{"metadata_gas":',
                vm.toString(used),
                ',"scene":',
                vm.toString(wanted),
                ',"colourway":',
                vm.toString(r.colourway),
                ',"light":',
                vm.toString(r.light),
                ',"reverse":',
                r.reverse ? "true" : "false",
                ',"phase":',
                vm.toString(r.phase),
                "}"
            )
        );
    }

    function _samples(address scene, uint256 wanted) private {
        string memory dir = string.concat("previews/ARCHIVE/blocks-video/samples/", vm.toString(wanted), "/");
        vm.createDir(dir, true);
        uint256 nonce = 1;
        for (uint256 k; k < 32; ++k) {
            SingleBlockData.Info memory b = _info(wanted, nonce);
            nonce = b.prevrandao + 1;
            VideoRecipe.Recipe memory r = VideoRecipe.recipe(b);
            (bool ok, bytes memory result) =
                scene.staticcall(abi.encodeWithSignature("frame(bytes,uint256)", VideoRecipe.artwork(b), r.phase));
            require(ok);
            (bytes memory pixels, bytes memory palette) = abi.decode(result, (bytes, bytes));
            string memory stem = string.concat(dir, vm.toString(k));
            vm.writeFileBinary(string.concat(stem, ".raw"), pixels);
            vm.writeFileBinary(string.concat(stem, ".palette"), palette);
            vm.writeFile(
                string.concat(stem, ".json"),
                string.concat(
                    '{"entropy":',
                    vm.toString(b.prevrandao),
                    ',"colourway":',
                    vm.toString(r.colourway),
                    ',"light":',
                    vm.toString(r.light),
                    ',"reverse":',
                    r.reverse ? "true" : "false",
                    ',"phase":',
                    vm.toString(r.phase),
                    "}"
                )
            );
        }
    }

    function testVideoCanyon() public {
        _measure(address(new Canyon()), "canyon", 0);
    }

    function testVariationCanyon() public {
        _samples(address(new Canyon()), 0);
    }

    function testVideoDescent() public {
        _measure(address(new Descent()), "descent", 1);
    }

    function testVariationDescent() public {
        _samples(address(new Descent()), 1);
    }

    function testVideoMonorail() public {
        _measure(address(new Monorail()), "monorail", 2);
    }

    function testVariationMonorail() public {
        _samples(address(new Monorail()), 2);
    }

    function testVideoSpire() public {
        _measure(address(new Spire()), "spire", 3);
    }

    function testVariationSpire() public {
        _samples(address(new Spire()), 3);
    }

    function testVideoSkyline() public {
        _measure(address(new Skyline()), "skyline", 4);
    }

    function testVariationSkyline() public {
        _samples(address(new Skyline()), 4);
    }

    function testVideoAlley() public {
        _measure(address(new Alley()), "alley", 5);
    }

    function testVariationAlley() public {
        _samples(address(new Alley()), 5);
    }

    function testVideoNightTrain() public {
        _measure(address(new NightTrain()), "nighttrain", 6);
    }

    function testVariationNightTrain() public {
        _samples(address(new NightTrain()), 6);
    }

    function testVideoSatoyama() public {
        _measure(address(new Satoyama()), "satoyama", 7);
    }

    function testVariationSatoyama() public {
        _samples(address(new Satoyama()), 7);
    }
}
