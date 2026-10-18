# blocks — Ethereum Sepolia verification inputs

Solidity v0.8.37+commit.f401782d, Amsterdam, experimental target enabled,
optimizer 200 runs, via-IR. `contracts.json` maps exact deployed addresses, source
paths and ABI-encoded constructor arguments. Each `*.standard.json` is the
Foundry-generated standard JSON compiler input for that contract.

These reproduce the locally checked deployed runtime, with immutable slots
checked separately through the router/NFT getters. Explorer verification status
is recorded independently in `deployments/blocks-sepolia.json`.
