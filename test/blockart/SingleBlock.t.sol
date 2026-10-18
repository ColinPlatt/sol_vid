// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {SingleBlockNFT} from "../../src/blockart/SingleBlockNFT.sol";
import {SingleBlockData} from "../../src/blockart/SingleBlockData.sol";
import {BlockArtRenderer} from "../../src/blockart/BlockArtRenderer.sol";
import {Epoch} from "../../src/blockart/Epoch.sol";
import {Canyon} from "../../src/blockart/scenes/Canyon.sol";
import {Descent} from "../../src/blockart/scenes/Descent.sol";
import {Monorail} from "../../src/blockart/scenes/Monorail.sol";
import {Spire} from "../../src/blockart/scenes/Spire.sol";
import {Skyline} from "../../src/blockart/scenes/Skyline.sol";
import {Alley} from "../../src/blockart/scenes/Alley.sol";
import {NightTrain} from "../../src/blockart/scenes/NightTrain.sol";
import {Satoyama} from "../../src/blockart/scenes/Satoyama.sol";

interface SingleVm {
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

contract SingleMarker {}

abstract contract SingleReceiver {
    SingleVm constant vm = SingleVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function onERC721Received(address, address, uint256, bytes calldata) external virtual returns (bytes4) {
        return 0x150b7a02;
    }
}

contract SingleReentrantReceiver is SingleReceiver {
    bool public blocked;

    function claim(SingleBlockNFT nft) external {
        nft.mint();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        (bool ok,) = msg.sender.call(abi.encodeWithSignature("mint()"));
        blocked = !ok;
        return 0x150b7a02;
    }
}

contract SingleBlockRulesTest is SingleReceiver {
    SingleBlockNFT nft;

    function setUp() public {
        vm.roll(13000000);
        vm.warp(1800000000);
        vm.chainId(11155111);
        vm.fee(20);
        vm.coinbase(address(0xBEEF));
        vm.prevrandao(bytes32(uint256(123)));
        nft = new SingleBlockNFT(BlockArtRenderer(address(new SingleMarker())));
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
        require(nft.seedOf(id) == SingleBlockData.seed(b));
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
        SingleBlockNFT other = new SingleBlockNFT(nft.renderer());
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
        SingleReentrantReceiver r = new SingleReentrantReceiver();
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

contract SingleBlockMediaTest is SingleReceiver {
    event log_named_uint(string key, uint256 val);

    function _measure(address scene, string memory name, uint256 wanted, bool frames) private {
        vm.roll(13000000 + wanted);
        vm.warp(1800000000);
        vm.chainId(11155111);
        vm.fee(20);
        vm.coinbase(address(0xBEEF));
        SingleBlockData.Info memory info = SingleBlockData.capture();
        for (uint256 r = 1; r < 4096; ++r) {
            info.prevrandao = r;
            uint256 h = uint256(SingleBlockData.seed(info));
            uint256 s = ((h >> 216) & 255) < 4 ? 7 : (h >> 224) % 7;
            if (s == wanted) {
                vm.prevrandao(bytes32(r));
                break;
            }
            require(r < 4095, "Scene seed search failed");
        }
        address[8] memory slots = [scene, scene, scene, scene, scene, scene, scene, scene];
        SingleBlockNFT nft = new SingleBlockNFT(new BlockArtRenderer(slots));
        uint256 id = nft.mint();
        require(nft.sceneOf(id) == wanted);
        string memory stem = string.concat("previews/blocks-single/", name);
        vm.createDir("previews/blocks-single", true);
        if (frames) {
            bool ok;
            bytes memory ret;
            bytes memory art = SingleBlockData.artwork(nft.blockData(id));
            bytes memory all = new bytes(90 * 16384);
            for (uint256 f; f < 90; ++f) {
                (ok, ret) = scene.staticcall(abi.encodeWithSignature("frame(bytes,uint256)", art, f));
                require(ok);
                (bytes memory pixels, bytes memory palette) = abi.decode(ret, (bytes, bytes));
                assembly ("memory-safe") { mcopy(add(add(all, 32), mul(f, 16384)), add(pixels, 32), 16384) }
                if (f == 0) {
                    vm.writeFileBinary(string.concat(stem, ".palette"), palette);
                    (bool loopOk, bytes memory loopRet) =
                        scene.staticcall(abi.encodeWithSignature("frame(bytes,uint256)", art, 90));
                    require(loopOk);
                    (bytes memory repeated,) = abi.decode(loopRet, (bytes, bytes));
                    require(keccak256(repeated) == keccak256(pixels), "Loop seam differs");
                }
            }
            vm.writeFileBinary(string.concat(stem, ".raw"), all);
            return;
        }
        uint256 before = gasleft();
        (bool ok, bytes memory ret) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.tokenURI, (id)));
        uint256 used = before - gasleft();
        require(ok && used <= 500000000, "Metadata exceeds cap");
        vm.writeFile(string.concat(stem, ".uri"), abi.decode(ret, (string)));
        emit log_named_uint(string.concat(name, " metadata gas"), used);
        (ok, ret) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.gif, (id)));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".gif"), abi.decode(ret, (bytes)));
        (ok, ret) = address(nft).staticcall{gas: 500000000}(abi.encodeCall(nft.avi, (id)));
        require(ok);
        vm.writeFileBinary(string.concat(stem, ".avi"), abi.decode(ret, (bytes)));
        vm.writeFile(
            string.concat(stem, ".json"),
            string.concat(
                '{"block":',
                vm.toString(id),
                ',"metadata_gas":',
                vm.toString(used),
                ',"scene":',
                vm.toString(wanted),
                "}"
            )
        );
    }

    function testSingleCanyon() public {
        _measure(address(new Canyon()), "canyon", 0, false);
    }

    function testSingleDescent() public {
        _measure(address(new Descent()), "descent", 1, false);
    }

    function testSingleMonorail() public {
        _measure(address(new Monorail()), "monorail", 2, false);
    }

    function testSingleSpire() public {
        _measure(address(new Spire()), "spire", 3, false);
    }

    function testSingleSkyline() public {
        _measure(address(new Skyline()), "skyline", 4, false);
    }

    function testSingleAlley() public {
        _measure(address(new Alley()), "alley", 5, false);
    }

    function testSingleNightTrain() public {
        _measure(address(new NightTrain()), "nighttrain", 6, false);
    }

    function testSingleSatoyama() public {
        _measure(address(new Satoyama()), "satoyama", 7, false);
    }

    function testSingleFramesCanyon() public {
        _measure(address(new Canyon()), "canyon", 0, true);
    }

    function testSingleFramesDescent() public {
        _measure(address(new Descent()), "descent", 1, true);
    }

    function testSingleFramesMonorail() public {
        _measure(address(new Monorail()), "monorail", 2, true);
    }

    function testSingleFramesSpire() public {
        _measure(address(new Spire()), "spire", 3, true);
    }

    function testSingleFramesSkyline() public {
        _measure(address(new Skyline()), "skyline", 4, true);
    }

    function testSingleFramesAlley() public {
        _measure(address(new Alley()), "alley", 5, true);
    }

    function testSingleFramesNightTrain() public {
        _measure(address(new NightTrain()), "nighttrain", 6, true);
    }

    function testSingleFramesSatoyama() public {
        _measure(address(new Satoyama()), "satoyama", 7, true);
    }
}
