# Base deployment preparation

The same `ghoulballs` contracts are prepared for Base and Base Sepolia. Minting
is free, with a fixed maximum of 6,667 tokens and no per-wallet limit. No contracts
have been broadcast. See [Sepolia](SEPOLIA.md) for signer setup, contract behavior,
verification, and metadata limitations.

| Network | Chain ID | Script | Manifest |
| --- | --- | --- | --- |
| Base | 8453 | `script/DeployBase.s.sol:DeployBase` | `deployments/base.json` |
| Base Sepolia | 84532 | `script/DeployBase.s.sol:DeployBaseSepolia` | `deployments/base-sepolia.json` |

Each script rejects the wrong chain before starting broadcast. Local rehearsals:

```bash
FOUNDRY_SOLC=/usr/bin/solc forge script script/DeployBase.s.sol:DeployBase --chain 8453 --offline
FOUNDRY_SOLC=/usr/bin/solc forge script script/DeployBase.s.sol:DeployBaseSepolia --chain 84532 --offline
```

For a network dry run, load your local `.env` as described in the Sepolia guide:

```bash
forge script script/DeployBase.s.sol:DeployBaseSepolia \
  --rpc-url https://sepolia.base.org --chain 84532 \
  --private-key "$DEPLOYER_PRIVATE_KEY" --sender "$DEPLOYER_ADDRESS" -vvv
```

For mainnet use `DeployBase`, chain `8453`, and `https://mainnet.base.org`.
Only adding `--broadcast --slow` sends transactions. Fund the deployer on the
selected network first. Record successful addresses and transaction hashes in
that network's manifest and set its status to `deployed`, then run
`python3 scripts/sync_mint_config.py` and republish the mint page.

Base's [network configuration](https://docs.base.org/get-started/connect-to-base)
uses ETH for gas. The deployment and mint transactions fit well below its current
[16,777,216 gas transaction maximum](https://docs.base.org/specifications/transactions/throughput-and-limits).
The 500M rendering budget concerns a read-only `eth_call`; it is not a transaction
budget. Full video metadata needs up to roughly 424M gas in measured samples and an RPC
provider that explicitly permits that gas, response size and timeout. The public
Base RPC's high-gas read capability has not been verified. The mint page uses only
small reads and does not request `tokenURI`.

Base's public RPCs are rate limited. Configure a production read RPC in
`scripts/sync_mint_config.py` before a public launch; any browser RPC URL is public
and must not contain a private signing key or a confidential service credential.
Different chain IDs and collection addresses give different artwork seeds.
