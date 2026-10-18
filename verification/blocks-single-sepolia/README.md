# Single-block Sepolia verification preparation

Solidity 0.8.37+commit.f401782d, Amsterdam, optimizer 200, via-IR, experimental
target enabled. The saved standard JSON input independently reproduces the exact
creation bytecode of `SingleBlockNFT`; constructor argument is the existing verified
scene router 0xedf6937b047c1ad9d2fe4c7203b5c54f4eadad46.

No new deployment has been broadcast. A confirmed address and receipt must be
recorded after explicit authorization. Etherscan currently rejects Amsterdam;
Foundry --verify can also submit Sourcify verification.
