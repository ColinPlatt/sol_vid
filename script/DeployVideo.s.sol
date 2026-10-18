// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AviRleVideo} from "../src/AviRleVideo.sol";
import {VideoNFT} from "../src/VideoNFT.sol";
import {VideoCandidate} from "../src/VideoCandidate.sol";

interface VmVideoDeploy {
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract DeployVideo {
    error WrongChain(uint256 actual);
    VmVideoDeploy constant vm = VmVideoDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    function targetChainId() public pure virtual returns (uint256);

    function candidate() public pure virtual returns (bool) {
        return false;
    }

    event VideoMetadataMeasured(uint256 gasUsed, uint256 uriBytes, bytes32 uriHash);

    function run() external returns (AviRleVideo renderer, VideoNFT collection) {
        if (block.chainid != targetChainId()) revert WrongChain(block.chainid);
        vm.startBroadcast();
        renderer = new AviRleVideo();
        if (candidate()) {
            collection = new VideoCandidate(renderer);
        } else {
            collection = new VideoNFT(renderer);
            collection.mint();
        }
        vm.stopBroadcast();
        require(collection.totalSupply() == 1, "First token missing");
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory result) =
            address(collection).staticcall{gas: 500_000_000}(abi.encodeCall(collection.tokenURI, (1)));
        uint256 used = beforeGas - gasleft();
        require(ok && used <= 500_000_000, "First metadata exceeds budget");
        bytes memory uri = abi.decode(result, (bytes));
        emit VideoMetadataMeasured(used, uri.length, keccak256(uri));
        require(address(collection.renderer()) == address(renderer), "Wrong renderer");
        require(
            address(renderer).code.length <= 24576 && address(collection).code.length <= 24576, "Base runtime limit"
        );
    }
}

contract DeployVideoBase is DeployVideo {
    function targetChainId() public pure override returns (uint256) {
        return 8453;
    }
}

contract DeployVideoBaseSepolia is DeployVideo {
    function targetChainId() public pure override returns (uint256) {
        return 84532;
    }
}

contract DeployVideoSepolia is DeployVideo {
    function targetChainId() public pure override returns (uint256) {
        return 11155111;
    }
}

contract DeployVideoCandidateBase is DeployVideoBase {
    function candidate() public pure override returns (bool) {
        return true;
    }
}

contract DeployVideoCandidateBaseSepolia is DeployVideoBaseSepolia {
    function candidate() public pure override returns (bool) {
        return true;
    }
}
