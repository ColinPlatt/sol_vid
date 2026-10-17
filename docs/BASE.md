# Base deployment

`main` deploys to Base exactly what Sepolia v4 runs: the `GHOULBALLS_VAPOR_V3` renderer
and the GIF-only `ghoulballs` collection (6,667 tokens, free, one mint per caller
address). `script/DeployBase.s.sol:DeployBase` deploys the renderer, then the
collection, then mints token 1 to the deployer, in one broadcast. It rejects any chain
but 8453 before broadcasting. Base uses the `base` profile: Solidity 0.8.30, Cancun.
See [Sepolia](SEPOLIA.md) for contract behaviour.

Status: **deployed and verified on Basescan** (`deployments/base.json`).

| Contract | Address | Transaction |
| --- | --- | --- |
| Renderer | [0x5902e513c974f5d644dde577b46626a4bf7ceb30](https://basescan.org/address/0x5902e513c974f5d644dde577b46626a4bf7ceb30#code) | [0x9574eaf0…](https://basescan.org/tx/0x9574eaf0202a94fec64687704ad2c0be6539210742289418845c98ec1342c490) |
| Collection | [0xf3654d0ce6cf518f4efbbe490f4a26483fb0969c](https://basescan.org/address/0xf3654d0ce6cf518f4efbbe490f4a26483fb0969c#code) | [0xa8d7c792…](https://basescan.org/tx/0xa8d7c792929810b9980f4ad3d698d88cd0fd89e21acad8ae44113c982d4e573f) |
| Token 1 mint | to the deployer | [0x31292224…](https://basescan.org/tx/0x31292224bf61779642b80c6ec24af6d448e69343fffafb3c21fb1fc9bb5e27ac) |

Gas used: 3,466,367 (renderer), 1,893,132 (collection), 112,744 (mint); total cost
about 0.0000292 ETH including L1 data fees. Both runtime bytecodes match the `base`
build; token 1's full `tokenURI` reads through `mainnet.base.org` and every GIF frame
matches the independent V3 reference.

## Signer

The Base deployer is a new key, kept in an encrypted Foundry keystore named
`ghoulballs_base`. It is not the Sepolia `DEPLOYER_PRIVATE_KEY`, which was exposed
and must not be used on mainnet. Its public address is `BASE_DEPLOYER_ADDRESS` in
`.env` (`0xBb789F9508DFBDd31De814E7A13ee1B549703D68`). No Base private key is stored in
`.env`, shell history or the repository.

## Measured on 2026-10-17

| | |
| --- | --- |
| Base profile tests | 53 passed |
| Runtime sizes | `GenerativeVideo` 15,787 bytes, `SolVideoNFT` 8,229 bytes |
| Mainnet dry run (no key, nothing sent) | renderer ~4.51M, collection ~2.46M, first mint ~0.16M gas limit; 7.12M total estimate |
| Cost | ~0.000077 ETH L2 gas at 0.005 gwei base fee, plus an L1 data fee upper bound of ~0.00000011 ETH |
| Deployer | 0.001 ETH, nonce 0 |
| `tokenURI` read | 34.1M gas (one ball) to 49.9M (largest six-ball samples), Cancun schedule |
| Mint | ~119K gas |

`eth_call` gas actually granted, measured by a probe that returns the gas it received:
`mainnet.base.org` grants the full amount (550M tested), the Tenderly gateway caps at
500M, and `base-rpc.publicnode.com` silently caps at 50M. Every `tokenURI` therefore
reads through `mainnet.base.org`; on 50M endpoints the largest tokens may fail.
Base's public RPC is rate limited; use a production RPC for heavy browser traffic.

## Broadcast

Run from the repository root in your own terminal, since the keystore asks for its
password interactively:

```bash
set -a; . ./.env; set +a
FOUNDRY_PROFILE=base forge script script/DeployBase.s.sol:DeployBase \
  --rpc-url https://mainnet.base.org --chain 8453 \
  --account ghoulballs_base --sender "$BASE_DEPLOYER_ADDRESS" \
  --broadcast --slow
```

Without `--broadcast` the same command is a dry run. After a successful broadcast,
record the addresses, transaction hashes and receipts in `deployments/base.json`
(status `deployed`, a `collections` entry with `mint_limit: 1`), check the live runtime
bytecode against the build, then run `python3 scripts/sync_mint_config.py` and
republish the mint page.

## Source verification

Basescan supports Cancun, so verification should work (Sepolia's Amsterdam target
could not be verified). Using the Etherscan V2 API key from `.env`:

```bash
FOUNDRY_PROFILE=base forge verify-contract --chain 8453 --watch \
  "$RENDERER_ADDRESS" src/GenerativeVideo.sol:GenerativeVideo \
  --verifier etherscan --etherscan-api-key "$ETHERSCAN_API_KEY"

FOUNDRY_PROFILE=base forge verify-contract --chain 8453 --watch \
  "$COLLECTION_ADDRESS" src/SolVideoNFT.sol:SolVideoNFT \
  --constructor-args "$(cast abi-encode 'constructor(address)' "$RENDERER_ADDRESS")" \
  --verifier etherscan --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Base Sepolia (`DeployBaseSepolia`, `deployments/base-sepolia.json`) remains in the
scripts but is not offered on the mint page.
