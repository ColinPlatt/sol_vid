# Archived previews

Superseded versions, kept for their measurements and validation evidence. Current
work lives one level up:

- `blocks-video-v4/` and `blocks-video-v4-base/` hold the current art, `BLOCKS_VIDEO_V4`.
- `blocks-video-v3-base-live/` holds the token live on Base.
- `blocks-diversity-v3/` holds the 100k audit, which also covers V4.
- `blocks-sepolia/` holds the site's browser QA screenshots.

| Folder | What it was |
|---|---|
| `blockart/` | `NEO_TOKYO_BLOCKS_V1` ten-block epoch prototype (GIF/AVI per scene) |
| `blocks-single/`, `blocks-single-sepolia/` | `BLOCKS_SINGLE_V1` single-block GIF collection and its first Sepolia token |
| `blocks-video/` | `BLOCKS_VIDEO_V2` prepared AVI revision (never deployed) |
| `blocks-video-v3/`, `blocks-video-v3-base/` | `BLOCKS_VIDEO_V3` examples and stress cases (Amsterdam and Cancun builds) |
| `blocks-video-v3-sepolia/` | The first `BLOCKS_VIDEO_V3` token on Ethereum Sepolia |

Tests and scripts for these versions still write here (for example `test/blockart/Scenes.t.sol`).
A plain `forge test` rewrites some of the JSON with default-profile gas; don't commit that drift.
