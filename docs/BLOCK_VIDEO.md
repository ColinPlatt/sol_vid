# blocks video revision — native SVG + embedded AVI

`BLOCKS_VIDEO_V2` is a separate, prepared revision. It is not deployed, and the
current Sepolia collection and mint page continue to use `BLOCKS_SINGLE_V1`.
The deployed collections are immutable; existing tokens cannot acquire this
metadata format or a new recipe retroactively.

## One animation, one still image

- `image`: a native SVG containing coloured path strokes representing exactly
  the first displayed frame of the AVI. It embeds no bitmap, GIF, script, fonts
  or external assets. Pixel edges remain sharp when enlarged.
- `animation_url`: a data-URI HTML document containing the AVI and its complete
  decoder/player. No hosted player, fetches or external scripts are needed.
- `video(tokenId)`: the original lossless 128×128 AVI, 90 frames at 15fps, six
  seconds. No GIF is included in this collection's metadata or public media API.

A browser generally needs the embedded decoder to play this AVI; it is not a
native MP4 `<video>` source. The separate deployed ghoulballs AVI edition already
established this general inline-player path on OpenSea. These larger blocks
payloads still require their own deployed candidate retrieval/playback check.

The poster is derived from the final AVI, after applying its palette, phase,
direction and decorative overlays. Its pixels therefore match the first frame
of the actual animation, rather than an approximate illustration. The metadata
renderer generates the AVI once and streams its base64 into the complete JSON
response. In-place frame permutation and colour-grouped SVG paths keep temporary
memory and payload overhead bounded. All measurements use capped static calls,
including the caller's return-data copy.

## Variation

The versioned seed hashes only the mint block's captured information. Minting
still takes no inputs; the first successful caller in a block wins, and wallets
may mint in subsequent blocks.

The eight scene families remain, including rare Satoyama. Within them the seed
already drives signs, windows, lights, rain placement and scene-specific geometry.
V2 adds six RGB channel-permutation colourways, three light levels and forward or
reverse motion. A deterministic starting phase changes the first frame without
changing the loop duration; phase alone is not a different underlying animation.

`recipeOf`, `seedOf` and `sceneOf` expose the recipe. Metadata lists the scene,
colourway, light, direction, phase, version, genuine captured block fields, format
and dimensions. Synthetic drawing intensity is not reported as real block gas.
The inherited templates' gas-percentage labels are replaced by decorative colour
chips in the new video output; original renderer/deployed-token output is intact.

The variation audit renders 32 entropy samples per scene while keeping the block
number and timestamp constant. This checks visual differences beyond a changing
serial label. See `previews/ARCHIVE/blocks-video/variation-256.png`, `posters.png` and
`validation.json`. Distinct sampled images are evidence of variation, not a
mathematical guarantee that every future token looks different. The balanced
scene sample does not measure natural rarity frequencies.

## Validation and release

Run, from the repo root:

```
forge test --offline -vv
python3 scripts/validate_blocks_video.py
node scripts/blocks_video_browser_qa.mjs
```

The validator independently checks each AVI's 90 RGB frames against the original
scene frames plus the documented palette, phase, direction and overlay transforms.
It reconstructs every native SVG path and checks exact first-frame agreement.
The embedded decoder is compared against FFmpeg for every frame. Chromium also
rasterizes the real SVG and compares it with FFmpeg's first frame; Chromium and
Firefox exercise actual data-URI playback, pause/resume and repeat timing.
Safari and the new candidate's OpenSea playback are not yet checked.

The new NFT and renderer each fit EIP-170's deployed-code size limit. Measured
per-scene payload sizes, gas and compiler/profile are in `validation.json`.
These are eight reproducible cases, not an exhaustive maximum across every seed.
Broader stress sampling, Base/Cancun measurements and the actual marketplace
candidate check remain release gates before a public video launch.

The existing immutable scene router can be reused. A new video renderer and NFT
must be deployed for this revision, with separate broadcast authorization. Keep
its manifest and eventual site configuration separate from the current GIF mint.

Current Amsterdam measurements span **203,099,814–417,474,627 gas** for the full
`tokenURI` in the eight measured cases. Each original AVI is **1,477,976 bytes**;
SVGs are **31,960–81,264 bytes**; complete metadata URIs are about **2.70–2.79 MB**.
The runtime is **5,499 bytes** for the NFT and **21,539 bytes** for the renderer.
`deployments/blocks-video-sepolia.json` records this prepared state, not a launch.
