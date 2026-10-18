# Single-block Sepolia verification

Solidity 0.8.37+commit.f401782d, Amsterdam, optimizer 200, via-IR, experimental
target enabled. The saved standard JSON reproduces `SingleBlockNFT`; constructor
argument is the verified router 0xedf6937b047c1ad9d2fe4c7203b5c54f4eadad46.

Deployed with explicit authorization on 2026-10-18:
`0x4a37f71418870d89e192bc973626db8eb4ded06b` (Ethereum Sepolia).
Sourcify verified exact creation and runtime matches; see `sourcify-job.json` and
https://repo.sourcify.dev/11155111/0x4a37f71418870d89e192bc973626db8eb4ded06b .

Foundry used `--broadcast --verify`. Its initial Etherscan submission arrived
before indexing. A subsequent direct standard-JSON submission was accepted for
processing, then rejected with “Invalid EVM version entered.” See the Etherscan
submission/result JSON files. No alternative bytecode or compiler target was used.
