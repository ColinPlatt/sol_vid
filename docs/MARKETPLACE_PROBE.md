# Marketplace compatibility probe

This is a separate, fixed 15-token ERC-721 experiment. It does not change the live
GIF collection or merge the parked AVI/MPEG branch. Each control isolates a
metadata retrieval or display question. All 15 tokens are minted to the deployer
in the constructor; there is no public mint, owner, metadata setter or upgrade.
Normal ERC-721 transfers remain available.

**Status: built and tested locally, not deployed to a public network.** Local
Anvil addresses and transactions are not Base deployment records. Private research
notes are excluded from this branch.

## Controls and measured read cost

Every measurement is a real capped `STATICCALL`, including ABI return copying.
The table uses the Base/Cancun profile (Solidity 0.8.30, optimizer 200, via IR).
Amsterdam measurements are saved separately. The gas ladders deliberately burn
the target amount before returning small metadata; actual reads add about 105K
gas. Targets are approximate thresholds, not exact provider cap measurements.

| Token | Control | Gas | URI bytes |
| --- | --- | ---: | ---: |
| 1 | Gas 10M | 10,103,157 | 1,049 |
| 2 | Gas 30M | 30,103,173 | 1,049 |
| 3 | Gas 45M | 45,103,265 | 1,049 |
| 4 | Gas 60M | 60,103,335 | 1,049 |
| 5 | Gas 100M | 100,103,727 | 1,053 |
| 6 | Gas 200M | 200,103,778 | 1,053 |
| 7 | Gas 400M | 400,103,829 | 1,053 |
| 8 | HTML JS base64 | 225,224 | 2,281 |
| 9 | HTML JS percent | 605,155 | 2,353 |
| 10 | HTML CSS no JS | 185,142 | 1,885 |
| 11 | Cheap 600KB HTML | 7,993,759 | 801,261 |
| 12 | Offchain-encoded MP4 control | 600,044 | 5,993 |
| 13 | Hosted HTML JS | 115,472 | 1,157 |
| 14 | SVG wrapped GIF | 539,878 | 1,473 |
| 15 | Raw GIF image | 103,141 | 1,065 |

Tokens 8 and 9 contain byte-identical HTML/JavaScript, changing only base64 versus
percent encoding. Token 10 uses CSS animation with no scripts. Token 13 points to
the same JS page over HTTPS, isolating inline `data:` handling from hosted HTML.
Tokens 14 and 15 use the same animated GIF, wrapped in SVG versus returned raw.

The large control contains exactly **600,000 HTML bytes**, mostly a comment. It
expands compact, pre-encoded padding into an 801,261-byte metadata URI. This avoids
both expensive video rendering and a large storage deployment; the full read is
about 8M gas. Thus a failure to retrieve or display it cannot be attributed to a
50M render requirement. The shape and size deliberately resemble a large inline
player, without an actual decoder or movie in that page.

The MP4 is a **prerecorded diagnostic fixture**, encoded offchain with FFmpeg:
32×32 H.264 Constrained Baseline, 16 frames, two seconds. Its unchanged bytes are
returned in the metadata. This does not implement or claim a Solidity H.264
encoder. The GIF and HTML controls are prerecorded fixtures too.

## Validation

The full Amsterdam suite passes 61 tests; all eight probe and deployment-guard tests also pass under
Base/Cancun. The 50M call test retrieves ladder tokens 1–3 and rejects 4–7. All
other controls are below 40M. The full 400M ladder token fits a 500M read.

An independent validator decodes every exported JSON/data URI, compares both JS
encodings, validates the 600KB page and SVG/GIF relationship, and checks MP4 codec,
profile, duration and frame count. Chrome plays both inline JS pages, CSS-only
animation, native MP4 and both GIF variants; it also loads the large page and the
same JS page served from a local HTTP origin. Safari/Firefox and real marketplace
ingestion have not been tested.

A throwaway local Anvil deployment exercises the read-only RPC audit end to end:
all 15 controls are retrieved with 500M requested; at 50M only gas-ladder cases
4–7 fail. See `previews/probe/local-rpc-*.json`. This is a transport test, not a
claim about any public RPC or marketplace.

```bash
# Foundry >=1.8.5; matching locally installed compilers can be selected with FOUNDRY_SOLC.
forge fmt --check
forge test --offline -vv
# The probe tests write previews/probe/ only with PROBE_EXPORT=true (a plain run leaves the tree clean):
PROBE_EXPORT=true forge test --offline --match-contract MarketplaceProbeTest -vv
python3 scripts/validate_probe.py --profile amsterdam
FOUNDRY_PROFILE=base PROBE_EXPORT=true forge test --offline --match-contract MarketplaceProbeTest -vv
python3 scripts/validate_probe.py --profile base
node scripts/probe_browser_qa.mjs
# Starts and stops a disposable local Anvil; no public-chain transactions. Its Foundry broadcast and logs go to a
# temporary directory, so it never touches broadcast/DeployMarketplaceProbe.s.sol/8453/ from a real deployment:
FOUNDRY_SOLC=/path/to/solc-0.8.30 python3 scripts/probe_rpc_smoke.py
```

To rebuild the fixture library and hosted page, run
`python3 scripts/build_probe_fixtures.py`, then `forge fmt`. The generator reads
the checked-in prerecorded MP4. To reproduce that clip with FFmpeg:

```bash
ffmpeg -v error -y -f lavfi -i 'testsrc2=size=32x32:rate=8:duration=2' \
  -c:v libx264 -profile:v baseline -pix_fmt yuv420p -movflags +faststart \
  fixtures/marketplace-probe/native-control.mp4
```

## Deployment preparation

The Base local script rehearsal uses **3,820,616 gas**, in a single contract
creation that also mints all 15 controls. This is a local measurement, not a fee
quote or an RPC estimate. Check the live node's estimate and the deployer's balance
before a broadcast. The contract remains below Base's 24,576-byte runtime limit.
The Base and Base Sepolia scripts reject the wrong chain before reading settings.

1. Publish `mint-page/dist/probe/player.html` at an HTTPS URL accessible without
   authentication. On the existing host the planned path is
   `https://ghoulballs.vercel.app/probe/player.html`. This branch contains the asset;
   the path is not yet confirmed live. Check that the returned bytes match
   `fixtures/marketplace-probe/html-js.html` before embedding the immutable URL.
2. Set the **public** deployer address and hosted URL below. Sign using the existing
   Base keystore or another deliberately selected signer; do not reuse the exposed
   Sepolia key.
3. Dry run, review its estimate and addresses, then obtain deployment authorization.
   Adding `--broadcast --slow` sends the real transaction. No broadcast was performed
   as part of building this probe.
4. Record the confirmed collection address, transaction receipt, chain ID and hosted
   URL separately from the live artwork deployment manifests.

```bash
export PROBE_DEPLOYER_ADDRESS='0xYOUR_PUBLIC_BASE_ADDRESS'
export PROBE_HOSTED_HTML_URL='https://YOUR_HOST/probe/player.html'

# Base mainnet dry run; no transaction is sent:
FOUNDRY_PROFILE=base forge script \
  script/DeployMarketplaceProbe.s.sol:DeployMarketplaceProbeBase \
  --rpc-url https://mainnet.base.org --chain 8453 \
  --account ghoulballs_base --sender "$PROBE_DEPLOYER_ADDRESS" -vvv

# Local Base Sepolia rehearsal, no RPC or network transactions:
FOUNDRY_PROFILE=base_sepolia forge script \
  script/DeployMarketplaceProbe.s.sol:DeployMarketplaceProbeBaseSepolia \
  --chain 84532 --offline
```

## Collecting real results

After an authorized deployment, first audit the chosen RPC independently:

```bash
export PROBE_RPC_URL='https://mainnet.base.org'
python3 scripts/probe_rpc.py --address '0xCONFIRMED_PROBE' --chain-id 8453 \
  --gas 500000000 --output previews/probe/rpc-observation.json
```

The audit performs only `eth_chainId`, `eth_getCode` and `eth_call`. It records read
failures separately from successful JSON retrieval; it does not infer gas actually
granted or conflate an RPC read with marketplace display. A 429 retry is allowed,
but persistent rate limits and timeouts remain failures in the report.

Use `previews/probe/observations.csv` to record each marketplace's metadata ingestion,
image animation and player behavior, plus timestamps, refresh state/errors and
any original/display media URLs exposed by its API. Start with a refresh and allow
indexing time; a missing token is not proof that its media type is unsupported.
The CSV currently marks every marketplace result as `not_checked`.

| Observation | Interpretation to investigate |
| --- | --- |
| Tiny 10/30/45M metadata appears; 60/100/200/400M does not | A read budget or timeout boundary; compare RPC retrieval separately |
| AVI/MPEG token image appears, but its player does not | That token's metadata was read; investigate the animation pipeline |
| Only one of tokens 8/9 works | HTML data-URI encoding handling |
| Tokens 8/9 fail but CSS token 10 works | Script execution or script sanitization |
| Inline HTML fails, hosted token 13 works | Inline data-URI handling/rehosting rather than blanket script rejection |
| Only large token 11 fails | Payload/response-size limits, after checking its cheap RPC read |
| SVG token 14 is static while raw GIF 15 animates | SVG rasterization/caching |

[OpenSea's media documentation](https://docs.opensea.io/docs/media-and-traits)
lists HTML pages with scripts and MP4 as supported media, and says SVG is cached
as PNG. It does not establish support for these particular inline encodings or
high-gas metadata calls; this experiment is designed to measure those gaps.
