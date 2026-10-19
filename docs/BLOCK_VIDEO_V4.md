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
    - ガス with the gas limit, and the UTC time on the right.
    - A ticker that loops exactly once per 6-second movie: base fee in gwei (or wei
      below 0.001 gwei), the first 32 bits of RANDAO, the shortened coinbase, the chain
      ID and the UTC date.
- **Colours.**
  - The bands use the dark ramp's near-black for the background and the
    white ramp for figures; V3's palette keeps the white ramp desaturated.
  - Labels, the ticker and the 1-pixel rules use a neon ramp picked by the hue
    (`5 + hue % 6`).
- **Real data only.**
  - Every figure is one of the fields `mint()` captures.
  - The scenes' synthetic gas readouts stay replaced by colour chips, as in V2 and V3.
  - Base has no beacon slot, so none is shown.

`BlocksBandsV4` formats the bands in its own contract, because the fonts and formatting
would push the renderer past EIP-170. The renderer reads the bands once and copies them
into all 90 frames.

## Measurements and validation

- **Examples:** `test/blockart/BlockVideoV4.t.sol` renders one example per scene with
  Base-like block data. Complete `tokenURI` reads measured **206,099,273–408,603,584
  gas** in capped static calls.
- **Stress cases:** `test/blockart/VideoDiversityStressV4.t.sol` re-runs V3's 16
  corpus-selected stress seeds (`BLOCKS_DIVERSITY_STRESS=true`). The maximum is
  **435,574,638 gas**, compared with 452M for V3.
- **Base build:** under `FOUNDRY_PROFILE=blocks_base` (Cancun) the AVIs are
  byte-identical to the Amsterdam build. Runtime sizes are 23,824 bytes (renderer),
  5,807 (NFT) and 6,416 (bands).
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
estimated about 10.7M gas (≈0.00011 ETH).
