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
  - **Header (rows 0–13):** ベース・ブロック in the Misaki 8×8 katakana, and the block
    number with thousands separators.
  - **Footer (rows 112–127):**
    - ガス with the gas limit (`400M` for whole millions, otherwise in full), 鎖 with
      the chain ID when it fits, and the UTC time on the right.
    - A ticker that loops exactly once per 6-second movie. It shows the base fee in
      gwei (or wei below 0.001 gwei), the parent block hash, and, on OP Stack chains
      such as Base, the anchoring L1 block number, hash and base fee. Then come the blob
      base fee, the shortened coinbase and the UTC date. RANDAO is not shown.
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
  **207,116,513–409,619,708 gas** in capped static calls.
- **Stress cases:** `test/blockart/VideoDiversityStressV4.t.sol` re-runs V3's 16
  corpus-selected stress seeds (`BLOCKS_DIVERSITY_STRESS=true`) with fixed extras.
  The maximum is **436,558,618 gas**, compared with 452M for V3.
- **Base build:** under `FOUNDRY_PROFILE=blocks_base` (Cancun) the AVIs are
  byte-identical to the Amsterdam build. Runtime sizes are 23,910 bytes (renderer),
  6,783 (NFT) and 8,939 (bands).
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
estimated about 11.8M gas (≈0.00012 ETH).
