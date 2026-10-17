# ghoulballs — Sepolia deployment preparation

Collection name and symbol are both **`ghoulballs`**. Status: **prepared and tested;
not broadcast to Sepolia**. `deployments/sepolia.json` intentionally contains no
addresses or transaction hashes yet. Addresses printed by local rehearsals are
simulation addresses, not live deployments.

## Contracts and behavior

Deploy `GenerativeVideo`, then `SolVideoNFT(rendererAddress)`. The renderer reference
is immutable and the renderer itself has no upgrade mechanism. There is no proxy,
owner, pause, allowlist, per-wallet mint limit, payment, royalty or
administrative mint function. Token IDs start at 1 and advance sequentially.
The fixed `MAX_SUPPLY` is **6,667**; both mint paths revert with `SoldOut()` once reached.

`mint()` safely mints one token to the caller; `mintTo(recipient)` safely mints one
to any address. These methods are nonpayable. Minting is free of protocol fees;
the caller pays network gas. Repeat minting while supply remains. Contract
recipients must implement ERC721Receiver. Failed callbacks revert the entire
mint, including its counter increment. Reentrant receiver mints get fresh IDs.

The seed is `keccak256(abi.encode("SOL_VIDEO_NFT_V1", chainId, collection, tokenId))`.
It is deterministic, public and predictable, and stays stable across transfers
and time on the same chain. It is artwork variation, not unbiasable randomness.
There is no stored metadata blob or rendering work in the mint transaction.

Each token exposes:

- `tokenURI(id)`: base64 JSON with name, description, attributes, embedded GIF
  `image` and embedded MPEG-1 `.mpg` `animation_url`.
- `seedOf(id)` and `recipeOf(id)`: inspectable seed and traits.
- `imageURI(id)` / `gif(id)`: 64×64 GIF, 20 frames at 10fps, a two-second loop.
- `animationURI(id)` / `mpeg(id)`: 512×512 MPEG, 50 frames at 25fps. It contains
  64×64 logical colour samples with MPEG's chroma approximation.
- `avi(id)`: lossless indexed AVI, 64×64, 50 frames at 25fps.

Reads reject nonexistent tokens. ERC-165, ERC-721 and ERC-721 Metadata are
supported. Enumerable and burn extensions are not exposed.

## Playback and RPC requirements

The complete metadata read was measured at **386,993,398 gas** for the exported
first token. A six-ball sample selected for the largest summed squared radii among
the first 64 tokens used **390,814,969 gas**. These measurements include the
STATICCALL and ABI return-data copy, both media files, JSON and all base64 layers.
They are real 500M-capped calls, not extrapolated codec-only measurements.

Token URI lengths are about 513KB. These are sample measurements, not an
exhaustive guarantee over every future token or deployment address. Different
deployment addresses create different seeds. Rendering requires an RPC that
allows a sufficiently high `eth_call` gas cap, response size and timeout. Geth's
documented default gas cap is 50M; many public endpoints and NFT indexers will not
serve the full metadata at their defaults. `imageURI` is a separate cheaper read,
but ERC-721 clients will not automatically use it if `tokenURI` fails.

MPEG-1/data URI playback depends on the client. The GIF is an image fallback in
the metadata; there is no offchain video gateway or MP4 dependency. Included MP4s
are offchain viewing copies only. This is an experimental onchain video NFT,
not a claim of universal marketplace compatibility.

## Local verification

Requires Foundry, solc 0.8.30, FFmpeg/FFprobe, Python and Pillow. OpenZeppelin
v5.4.0 dependencies and their MIT license are vendored; no network install is
needed for contract dependencies. See `vendor/openzeppelin/README.md` for the
reproducible derived compilation unit and the local compiler compatibility
transformations. Compiler settings are pinned in `foundry.toml`.

```bash
# Set only if using a local compiler rather than Foundry's cached 0.8.30:
export FOUNDRY_SOLC=/usr/bin/solc

python3 scripts/check_vendor.py
forge fmt --check
forge test --offline -vv
python3 scripts/validate.py
python3 scripts/validate_nft.py
forge build --offline --sizes

# Local EVM rehearsal. No RPC and no transactions sent to Sepolia:
forge script script/DeploySepolia.s.sol:DeploySepolia --chain 11155111 --offline
```

The NFT tests cover minting, repeated mints, no payment, transfers, approvals,
receiver failure rollback, reentrant receivers, nonexistent reads, ERC interfaces,
seed stability and the complete metadata budget. Deployment tests cover the
chain-ID guard, contract wiring, initial supply and runtime code limits. The
independent NFT validator parses JSON and all data URIs; verifies the public seed
derivation and attributes; decodes GIF/MPEG; checks timestamps; and compares
pixels/luma against the token's independently returned AVI.

Current runtime sizes: `GenerativeVideo` **12,256 bytes**, `SolVideoNFT`
**8,202 bytes**, each below 24,576. The local deployment rehearsal uses about
**4.27M gas** across two CREATE transactions. The first safe mint measured about
75.5K call gas including a contract receiver callback; this excludes transaction
intrinsic gas and is not a fee quote.

## Sepolia dry run and broadcast

Sepolia chain ID is **11155111**. The script checks it before starting broadcast.
Copy `.env.example` to `.env` and fill in `SEPOLIA_RPC_URL`,
`DEPLOYER_PRIVATE_KEY`, and the corresponding public `DEPLOYER_ADDRESS`.
Fund that address with Sepolia ETH. `.env` is gitignored; never put signing keys
in the frontend or deployment manifests. The script uses the signer selected by
Foundry; `--sender` checks the intended public address.

```bash
set -a
source .env
set +a

# Confirm the key matches the intended public address before using it:
KEY_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
test "${KEY_ADDRESS,,}" = "${DEPLOYER_ADDRESS,,}" || { echo 'Deployer address mismatch'; exit 1; }

# Dry run against Sepolia using your intended signer; omitting --broadcast sends nothing:
forge script script/DeploySepolia.s.sol:DeploySepolia \
  --rpc-url "$SEPOLIA_RPC_URL" --chain 11155111 --private-key "$DEPLOYER_PRIVATE_KEY" --sender "$DEPLOYER_ADDRESS" -vvv

# Actual deployment command, for the later broadcast step:
forge script script/DeploySepolia.s.sol:DeploySepolia \
  --rpc-url "$SEPOLIA_RPC_URL" --chain 11155111 --private-key "$DEPLOYER_PRIVATE_KEY" --sender "$DEPLOYER_ADDRESS" \
  --broadcast --slow -vvv
```

After broadcast, record both deployed addresses and the successful transaction
hashes in `deployments/sepolia.json`, changing its status to `deployed`. Do not
substitute addresses from a simulation. Commit the public deployment manifest;
raw Foundry `broadcast/` artifacts are ignored. Run
`python3 scripts/sync_mint_config.py` to enable that network on the mint page.

For source verification, verify both contracts with the same compiler settings:
Use a current Foundry release or explicitly select the Etherscan V2 endpoint
below; the development workspace has an older Foundry executable.

```bash
forge verify-contract --chain 11155111 --watch \
  "$RENDERER_ADDRESS" src/GenerativeVideo.sol:GenerativeVideo \
  --verifier etherscan --verifier-url 'https://api.etherscan.io/v2/api?chainid=11155111' \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

forge verify-contract --chain 11155111 --watch \
  "$COLLECTION_ADDRESS" src/SolVideoNFT.sol:SolVideoNFT \
  --verifier etherscan --verifier-url 'https://api.etherscan.io/v2/api?chainid=11155111' \
  --constructor-args "$(cast abi-encode 'constructor(address)' "$RENDERER_ADDRESS")" \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Check `name()`, `symbol()`, `renderer()` and `totalSupply()` and `MAX_SUPPLY()` against the deployment
manifest, then mint a test token and inspect its owner, seed and metadata using a
high-cap read endpoint. Minting one token to the signer after deployment:

```bash
cast send "$COLLECTION_ADDRESS" 'mint()' \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --sender "$DEPLOYER_ADDRESS"
```

## Primary references

- [ERC-721](https://eips.ethereum.org/EIPS/eip-721)
- [Sepolia network configuration](https://github.com/eth-clients/sepolia/blob/main/README.md)
- [OpenZeppelin v5.4.0 ERC721](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.4.0/contracts/token/ERC721/ERC721.sol)
- [Geth RPC gas-cap configuration](https://geth.ethereum.org/docs/fundamentals/command-line-options)
- [OpenSea metadata fields and supported media](https://docs.opensea.io/docs/metadata-standards)
- [Etherscan verification with Foundry and V2 endpoints](https://docs.etherscan.io/contract-verification/verify-with-foundry)
