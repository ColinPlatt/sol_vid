# blocks V4 — readable block data on every frame

`BLOCKS_VIDEO_V4` keeps everything `BLOCKS_VIDEO_V3` decides from a block: the seed
(`VideoRecipeV3.seed`, unchanged), the scene, the 360 hues, 31 saturations, palette
tints, height bands, window density, street layout, direction and starting phase. The
same block gives the same city in both versions. V4 changes how the frame is shown.

## What changed from V3

- **No mirroring or crop resampling.** V3 flipped some frames horizontally and resampled
  rows for crop and pan. That reversed and squashed the scenes' own lettering. The
  diversity audit never credited those transforms (it undid them before comparing), so
  removing them leaves the audited diversity unchanged. The recipe still contains the
  fields, but V4 ignores them and drops them from the metadata.
- **Block-data bands.** Two bands are drawn over every frame after recolouring, never
  flipped or scaled:
  - **Header (rows 0–21):** two lines in the Misaki 8×8 katakana and a 3×5 font.
    - Line 1: ベース・ブロック and the block number.
    - Line 2: ガス with the gas limit (`400M` for whole millions, otherwise in full),
      鎖 with the chain ID when it fits, and the UTC time.
    - The header stays above source row 32, where the diversity audit's comparison
      region starts.
  - **Footer (rows 112–127):** still pages, each a label over a value, that advance
    evenly once per 6-second loop. Fees are in gwei (or wei below 0.001 gwei), and
    RANDAO is not shown. The pages are:
    1. base and blob fee
    2. parent hash, first half
    3. parent hash, second half (all 64 hex digits, in two halves of 32)
    4. L1 block and base fee
    5. L1 hash, first half
    6. L1 hash, second half
    7. coinbase and date

    That gives 7 pages of about 0.86 s on chains with an `L1Block` contract. Without
    one, the L1 pages are omitted, leaving 4 pages of about 1.5 s.
    Pages replaced an earlier scrolling ticker that had to move about 12 px per frame
    to fit everything into one loop.
- **Colours.**
  - The bands use the dark ramp's near-black for the background and the
    white ramp for figures; V3's palette keeps the white ramp desaturated.
  - Labels, the ticker and the 1-pixel rules use a neon ramp picked by the hue
    (`5 + hue % 6`).
- **Extra context captured at mint.** `BlockExtras.capture()` stores the parent hash
  (`blockhash(n-1)`), plus the blob base fee and the L1 block from Base's `L1Block`
  predeploy (`0x4200…0015`). These sit next to the seven art fields and are for display
  and metadata only, so the seed is unchanged.
  - A contract can't read its own block's hash, so the parent hash is the latest
    available.
  - `blobhash` only covers the minting transaction's own blobs, which a normal mint
    never has, so the blob base fee is shown instead.
  - Without an `L1Block` contract, the chain's own blob base fee is used and the L1
    fields stay empty.
  - `extrasOf(tokenId)` reads them back. Metadata adds Parent Hash, L1 Block, L1 Base
    Fee and Blob Base Fee traits.
- **Real data only.**
  - Every figure is one of the fields `mint()` captures.
  - The scenes' synthetic gas readouts stay replaced by colour chips, as in V2 and V3.
  - Base has no beacon slot, so none is shown.

`BlocksBandsV4` formats the bands and the block-data metadata traits in its own
contract, because the fonts and formatting would push the renderer past EIP-170. The renderer reads the bands once and copies them
into all 90 frames.

## Measurements and validation

- **Examples:** `test/blockart/BlockVideoV4.t.sol` renders one example per scene with
  Base-like block data and a mocked `L1Block`. Complete `tokenURI` reads measured
  **211,368,799–414,057,027 gas** in capped static calls.
- **Stress cases:** `test/blockart/VideoDiversityStressV4.t.sol` re-runs V3's 16
  corpus-selected stress seeds (`BLOCKS_DIVERSITY_STRESS=true`) with fixed extras.
  The maximum is **440,338,786 gas**, compared with 452M for V3.
- **Base build:** under `FOUNDRY_PROFILE=blocks_base` (Cancun) the AVIs are
  byte-identical to the Amsterdam build. Runtime sizes are 23,920 bytes (renderer),
  6,783 (NFT) and 9,679 (bands).
- **Fork mint:** a simulated mint on a Base fork captured the real parent hash and L1
  block, and its `tokenURI` rendered within the cap.
- **Independent check:** `python scripts/validate_blocks_video_v4.py` checks every frame
  of all 24 movies (2,160 frames) against the independent reference in
  `scripts/blocks_v4_reference.py` and `blocks_diversity_reference.py`. That covers
  palette, chips and bands, plus the FFmpeg decode and the SVG poster (frame 0). The
  reference shares only glyph bitmaps with the contracts; it reimplements formatting,
  dates and layout.
- **Font:** the 3×5 font comes from `scripts/blocks_hud_font.py`, which prints the
  table embedded in `BlocksHud.sol`.

## Deployment

`script/DeployBlocksV4Base.s.sol` reuses the verified Base V3 scene router
(`0xff9a…fb9f`, `deployments/blocks-video-v3-base.json`). It deploys the band
formatter, the renderer and the collection, then mints the first token in the same
broadcast. Run `scripts/broadcast_blocks_v4_base.sh` to simulate, and add `--broadcast`
to sign with the `ghoulballs_base` keystore. A dry run against Base on 2026-10-19
estimated about 12.0M gas (≈0.00013 ETH).

**Deployed 2026-10-19.** The user broadcast it on Base:

| Contract | Address |
|---|---|
| Collection | `0x87076cb1f55b7fb6c1febbffa1d45f4f4bd39cac` |
| Renderer | `0x650d3119d88b26d4dc662d4340acffb8e051b1e9` |
| Bands | `0x94232541d249a6b6177ce4af2bcee2684144ff04` |

- **First token:** #52814599 (路地 ALLEY). The deployment cost about 9.2M gas (0.000052 ETH).
- **Verification:** all three contracts are verified on Basescan and Sourcify.
- **Audit:** `scripts/record_blocks_v4_base.py` passed. It checked the runtime bytecode, the
  stored block, the parent hash against the block header, and the L1 fields against
  `L1Block` at the mint block. All 90 frames, the FFmpeg decode and the SVG poster match
  the independent reference, and `tokenURI` needs about 273M gas.
- **Site:** the site and lab mint and render from this collection
  (`deployments/blocks-video-v4-base.json`).
- **OpenSea:** the playback check passed on 2026-10-19 (`scripts/observe_blocks_opensea.mjs`).
  OpenSea ingested the metadata and plays the onchain player in an iframe, the frames move,
  and the player it hosts is byte-identical to the onchain `animation_url`. Evidence is in
  `previews/blocks-video-v4-base-live/opensea/`.
