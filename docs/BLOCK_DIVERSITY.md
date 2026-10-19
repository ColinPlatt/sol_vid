# blocks V3 — visual diversity at a 100,000-token scale

`BLOCKS_VIDEO_V3` is a separate, undeployed experiment. It preserves the eight
scene families, including rare Satoyama, the block-only seed, no-argument free
mint and one token per block. It does not change either deployed collection,
the live site, or prepared `BLOCKS_VIDEO_V2`. The 100,000 figure is an audit
population, not a newly imposed supply cap.

The V3 contracts are `BlockVideoNFTV3` and `BlockVideoRendererV3`. Its router must
use `DescentV3` in slot 1; the other seven existing scene contracts can be reused.
The current deployed router cannot be reused unchanged for this version. Their media
remain a six-second, 90-frame, 15fps lossless 128×128 AVI, a native SVG matching
its first frame, and an entirely embedded player. Every response is computed
inside a static call; no render-at-mint storage or hosted playback is introduced.

## Visible channels

`VideoRecipeV3` separates colour from architecture rather than relying on seed
uniqueness. There are 360 main hue positions, 31 saturation levels and independent
hue offsets for the 16 semantic palette ramps. Original palette values and fog
shading are retained. White lettering stays relatively desaturated.

Eight height bands influence the size of buildings across the district. Four
window-occupancy levels affect lit facades. Four street layouts select organic,
alternating, left-heavy or right-heavy sides. Other seed bits control signs,
individual building dimensions, light positions and scene details as before.
Four vertical crops, nine pan positions, mirroring, direction and starting phase
supply additional views and motion variation. All choices are deterministic. Top-level choices are exposed by `recipeOf`;
scene-specific geometry is derived from `seedOf`, and meaningful numeric traits
appear in metadata. The dedicated
`DescentV3` scene also derives arched, box, pointed or trapezoid tunnel sections,
wall and ceiling heights, four rib spacings and 256 track-gauge settings
from the final seed channel. Rib spacings divide the loop length to preserve
seamless motion. The old `Descent` contract remains unchanged.

Scene selection still uses the untouched final entropy channel, preserving the
approximately 1/64 Satoyama selection probability. Drawing intensity is a visual
parameter, not reported chain gas usage. As in V2, inherited synthetic gas labels
are replaced with decorative chips.

## Native visual audit

The corpus consists of 100,000 **actual Solidity-rendered canonical frames**,
not a count of possible trait combinations. The block number, timestamp, gas
limit, base fee, beneficiary and chain ID stay fixed; only prevrandao changes
from 1 through 100,000 before hashing. These are simulated inputs, not minted
tokens or historical block headers.

The comparison deliberately withholds several easy sources of apparent variety:

- Every sample uses source frame zero: phase and reverse playback get no credit.
- Block labels stay identical throughout the population.
- Python exactly undoes crop, pan and mirroring over source rows 32–111.
  Every view retains those rows, so this reconstruction loses no source pixels.
- Header and footer caption bands are excluded.
- Exact RGB **and palette-index geometry** duplicates are counted separately.
- Near duplicates require RGB RMSE ≤0.035 and luminance SSIM ≥0.98 on 32×20
  downsampled artwork. The acceptance target is no exact duplicates and at most
  0.1% of samples participating in flagged near-duplicate pairs.

The near-duplicate gate covers cross-scene pairs as well. After the initial
100k audit identified repetitive tunnel silhouettes, only that scene was
regenerated with new geometry. The incremental rerun verifies all seven unchanged
scenes byte-for-byte against the original, fully audited corpus, then compares
every new tunnel sample against the entire corpus. A from-scratch run needs no
baseline and searches all pairs directly. An exact L2 radius
search on an averaging projection conservatively identifies all pairs that can
pass the fine-image RGB threshold; full-distance and SSIM refinement follow.
The 2/255 radius margin covers integer rounding in both BOX downsampling stages.
HNSW supplies additional closest-pair examples and a separate structural diagnostic
using max-channel value, which the palette transformation preserves. That
structural diagnostic is approximate and is not a second all-pairs guarantee.

Results and review artifacts:

- `previews/blocks-diversity-v3/audit.json`: counts, thresholds, distributions,
  closest pairs, corpus hashes and source hashes.
- `previews/blocks-diversity-v3/closest-pairs.png`: pairs to inspect manually.
- `previews/blocks-diversity-v3/overview.png`: eight samples from each family.
- `previews/blocks-diversity-v3/stress-seeds.json`: the most complex canonical
  poster per scene, plus dense, tall, mirrored examples selected from the corpus.

The thresholds are an explicit engineering definition, not a guarantee that
all collectors will perceive every pair as distinct or that future mint blocks
will never produce a similar look. Exact full-picture hashes alone would be a
much weaker test. Shared scene silhouettes remain an intentional part of the
collection's visual language.

## Measured result

The final population contains **100,000 distinct canonical RGB frames**:
zero exact RGB duplicates, zero exact palette-index frame duplicates and
**0 near-duplicate pairs** under the stated RGB/SSIM gate.
The initial audit found one near pair; the tunnel geometry revision removed it.

The separate, coarser, colour-blind diagnostic still flags related silhouettes
in **11,831 samples (11.831%)**, down from
14,035. This approximate 16×10 diagnostic intentionally ignores the
palette and should not be confused with the full-colour near-duplicate result.
The eight families retain shared visual motifs. Contact-sheet sample numbers
are audit indices, not minted token IDs.

Amsterdam validation covers **2,160 frames in 24 full movies**, including the
16 corpus-selected stress cases. Complete metadata measured
**207,635,266–452,342,841 gas** through actual
capped calls. The Base/Cancun profile's eight standard examples measured
**207,633,059–413,992,720 gas**; their original AVI files
match the Amsterdam files byte-for-byte with the same simulated Sepolia inputs.
The 16 stress cases have not been repeated under Cancun.

Runtime sizes fit EIP-170: NFT/renderer/tunnel are 5,778/24,201/18,043 bytes under
Amsterdam and 5,764/24,187/18,029 under Cancun. The complete default suite passed
218 tests; the standalone native-corpus runs and both browser playback checks
also passed. These are local validation results, not deployed marketplace proof.

## Media, gas and release checks

`previews/blocks-video-v3/validation.json` records independent Python palette,
composition and SVG reconstruction against every frame decoded by FFmpeg.
The eight baseline examples use actual NFT `tokenURI` calls capped at 500M gas.
The 16 corpus-selected stress cases use a proxy reproducing the NFT's metadata
forwarding/copy path with fixed audit inputs, capped at 500M and requiring a
1M-gas margin. These do not prove a worst-case gas bound over every possible seed.
Chromium and Firefox also exercise the actual embedded player and repeat/pause
behaviour; Chromium's SVG rasterization must match the first AVI frame exactly.

Reproduce from the repository root with the pinned Foundry/Solidity toolchain:

```sh
python -m pip install -r scripts/requirements-diversity.txt
python scripts/export_blocks_diversity.py --count 100000 --threads 8
python scripts/audit_blocks_diversity.py --count 100000
BLOCKS_DIVERSITY_STRESS=true forge test --offline -vv --threads 8
python scripts/validate_blocks_video_v3.py
BLOCKS_VIDEO_FIXTURES=blocks-video-v3 node scripts/validate_blocks_video_player.mjs
BLOCKS_VIDEO_FIXTURES=blocks-video-v3 node scripts/blocks_video_browser_qa.mjs
```

The ~1.7GB raw corpus and multi-megabyte metadata/reference fixtures are ignored;
compact reports and review images are retained. The exporter generates transient
test cases so regular test runs do not accidentally repeat the 100,000-frame job.

Deployment still needs separate authorization. An actual candidate's OpenSea
retrieval/playback check, Safari validation and any remaining chain-specific
checks precede a public launch; this work does not enable the live mint route
for V3.
