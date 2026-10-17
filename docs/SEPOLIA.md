# ghoulballs — Sepolia deployment preparation

Collection name and symbol are both **`ghoulballs`**. Status: **deployed**.
The confirmed addresses and receipts are recorded in `deployments/sepolia.json`.

| Contract | Address | Deployment transaction |
| --- | --- | --- |
| Renderer | [0x3845c8f4ae6cbdb26988b78d8f7169cfd2d94b8a](https://sepolia.etherscan.io/address/0x3845c8f4ae6cbdb26988b78d8f7169cfd2d94b8a) | [Receipt](https://sepolia.etherscan.io/tx/0x6a179b483b949a68467f99c623b4146c9587a74b953590f02787eb0185ff8dc7) |
| Collection v2 (current) | [0xe7b06a27957ad992db764939c1836f92386369f1](https://sepolia.etherscan.io/address/0xe7b06a27957ad992db764939c1836f92386369f1) | [Receipt](https://sepolia.etherscan.io/tx/0xec3a1c9e999859f74bd70c1bbf000f808703810dd6872274db1cbc93ea0f2b06) |
| Collection v1 (superseded) | [0xd162eacfb30b69523aebc9dc0a07c28b7e26f11a](https://sepolia.etherscan.io/address/0xd162eacfb30b69523aebc9dc0a07c28b7e26f11a) | [Receipt](https://sepolia.etherscan.io/tx/0xdf886f93b5bc533907780983f2cb91c538accb587b8d96864e8c1489f56ece97) |

Successful deployments used 24,165,972 (renderer), 13,941,559 (v1) and 14,620,477 (v2) gas.

**v2** fixes blurry marketplace previews (Manifold upscales the 64px GIF with
smoothing). Its `image` is a percent-encoded `data:image/svg+xml,` wrapping the same
base64 GIF at 1024×1024 with `image-rendering: pixelated`, the approach used in
`ghoul_date`. The renderer was unchanged, so its live bytecode was re-checked
against the build and reused. v2 was deployed with
`RENDERER_ADDRESS=0x3845c8f4ae6cbdb26988b78d8f7169cfd2d94b8a forge script
script/DeploySepoliaCollection.s.sol:DeploySepoliaCollection` (same flags as below).
v1 is immutable, so it stays live and mintable; the mint page targets v2 and its
gallery shows both. v2's live runtime bytecode matches the build and estimates the
same 352,371 mint gas. Text below about the deployment checks applies to v1.
Both live runtime bytecodes match the compiled artifacts, including the immutable
renderer address. Name, symbol, cap, initial supply, ERC-721 and metadata
interfaces were checked. A zero-value mint simulation returns token ID 1 and
live estimation uses 352,371 gas. **No real mint has been sent.**
The mint page's public RPC also reads the live collection successfully.
Simulation addresses elsewhere in local logs are not deployment records.

## Explorer source verification

Source publication was explicitly authorized and both exact standard-JSON
compiler inputs were submitted to Etherscan. Verification is currently blocked
by the explorer response: `Fail - Unable to verify. Invalid EVM version entered.`
This also occurs when the redundant top-level EVM selector is omitted and
Amsterdam remains correctly set inside the compiler input. Do not report either
contract as Etherscan verified. Both live runtime bytecodes were independently
compared with the exact compiled artifacts, including immutable references.
Retry explorer verification when Amsterdam support is available; the submission
IDs and current status are retained in the deployment manifest.

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
  `image` (v2: inside a pixelated SVG wrapper) and embedded MPEG-1 `.mpg` `animation_url`.
- `seedOf(id)` and `recipeOf(id)`: inspectable seed and traits.
- `imageURI(id)` / `gif(id)`: 64×64 GIF, 20 frames at 10fps, a two-second loop.
- `animationURI(id)` / `mpeg(id)`: 512×512 MPEG, 50 frames at 25fps. It contains
  64×64 logical colour samples with MPEG's chroma approximation.
- `avi(id)`: lossless indexed AVI, 64×64, 50 frames at 25fps.

Reads reject nonexistent tokens. ERC-165, ERC-721 and ERC-721 Metadata are
supported. Enumerable and burn extensions are not exposed.

## Playback and RPC requirements

The artwork recipe is `GHOULBALLS_VAPOR_V2`: four sunset palettes and four
motion styles (Ricochet, Orbit, Float and Figure Eight). Theme, motion and art
version are included in metadata; `recipeOf` exposes the full seeded recipe.

The complete metadata read was measured at **374,803,755 gas** for the exported
first token. A six-ball sample selected for the largest summed squared radii among
the first 64 tokens used **420,505,727 gas**. These measurements include the
STATICCALL and ABI return-data copy, both media files, JSON and all base64 layers.
They are real 500M-capped calls, not extrapolated codec-only measurements.
Six-ball samples selected separately for each motion among the first 128 tokens
used 417,079,178 (Ricochet), 417,383,415 (Orbit), 423,481,395 (Float) and
417,232,773 (Figure Eight) gas. The v2 SVG wrapper adds about 45–50K gas. All remain below the 500M read budget.

Token URI lengths are about 576–599KB. These are sample measurements, not an
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

Requires Foundry 1.8.5 or newer, solc 0.8.37, FFmpeg/FFprobe, Python and Pillow. OpenZeppelin
v5.4.0 dependencies and their MIT license are vendored; no network install is
needed for contract dependencies. See `vendor/openzeppelin/README.md` for the
reproducible derived compilation unit and the local compiler compatibility
transformations. Compiler settings are pinned in `foundry.toml`.

```bash
# Set only if using a local compiler rather than Foundry's cached 0.8.37:
export FOUNDRY_SOLC=/path/to/solc-0.8.37

python3 scripts/check_vendor.py
forge fmt --check
forge test --offline -vv
python3 scripts/validate.py
python3 scripts/validate_nft.py
forge build --offline --sizes --skip test --skip script

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

The size check above covers deployable contracts. The local Foundry script runner
embeds both creation payloads and is not itself deployed.

Current runtime sizes: `GenerativeVideo` **15,493 bytes**, `SolVideoNFT`
**9,167 bytes**, each below 24,576. The local deployment rehearsal uses about
**39.0M gas** across two CREATE transactions. The first safe mint measured about
355.1K call gas including a contract receiver callback; this excludes transaction
intrinsic gas and is not a fee quote.

## Glamsterdam gas schedule

Sepolia activated Glamsterdam on October 6, 2026. Its execution-layer target is
`amsterdam`. The default Foundry profile pins Solidity 0.8.37 and that target;
use Foundry 1.8.5 or newer. `experimental = true` is required by this compiler
for Amsterdam; the experimental SSA CFG code generator is not enabled.
The Base profiles keep their separate Cancun compiler targets.

The initial deployment attempt used the old Cancun/Foundry 1.0 gas estimate and
reverted out of gas. Its hash and estimate are retained in the deployment
manifest. It created no contract. Do not resume that old transaction sequence:
re-read the deployer's nonce and simulate under Amsterdam before broadcasting.
The upgraded simulation estimates approximately 49.5M gas with its safety margin
for the pair, rather than the old approximately 7M. The local test rehearsal
uses approximately 39.0M gas; final receipt gas is authoritative.

References: [Ethereum Foundation activation announcement](https://blog.ethereum.org/en/2026/09/17/glamsterdam-testnet-announcement),
[EIP-8037 state creation costs](https://eips.ethereum.org/EIPS/eip-8037), and
[Solidity 0.8.37 Amsterdam support](https://www.soliditylang.org/blog/2026/09/10/solidity-0.8.37-release-announcement/).

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
below; the same compiler target and experimental setting must be used for verification.

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
