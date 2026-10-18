# blocks — Ethereum Sepolia verification inputs

Solidity v0.8.37+commit.f401782d, Amsterdam, experimental target enabled,
optimizer 200 runs, via-IR. `contracts.json` maps exact deployed addresses, source
paths and ABI-encoded constructor arguments. Each `*.standard.json` is the
Foundry-generated standard JSON compiler input for that contract.

These reproduce the locally checked deployed runtime, with immutable slots
checked separately through the router/NFT getters. Explorer verification status
is recorded independently in `deployments/blocks-sepolia.json`.

NightTrain retains the complete original compilation source set, including
Foundry's generated deployment helpers. Compiling only its imported sources
changes optimizer output (the known Solidity extra-file-input issue). The full
input reproduces its deployed creation bytecode exactly; the other nine inputs
also reproduce exact creation bytecode. `contracts.json` records SHA-256 hashes
and creation transaction hashes to check this independently of a local cache.

Run `python3 scripts/check_blocks_verification.py --solc /path/to/solc-0.8.37`
to compile every input and compare its creation-bytecode hash.
