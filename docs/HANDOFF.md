# Handoff — blocks (block-art) status

Last updated 2026-10-19 by Claude Code, after `3787c3a` (site mints V3). This covers the
`blocks` collection only; ghoulballs is unchanged. AGENTS.md remains the source of rules
and authorizations.

## Live (Ethereum Sepolia)

| What | Where | Notes |
|---|---|---|
| `blocks` video, `BLOCKS_VIDEO_V3` | collection `0x8d5ece93b3e5bedfabf1cddfebcc8e2cedb9cf9f` | **The site's collection.** Deployed 2026-10-19 with explicit approval by `script/DeployBlocksV3.s.sol`: new `DescentV3` `0xc549…88b7`, a new router `0xd5b2…4d6b` (DescentV3 in slot 1, the other seven epoch-era scenes reused), `BlockVideoRendererV3` `0xfc1f…649b`, then the collection and first mint in one broadcast. First token #11947754 (夜景 SKYLINE) to the deployer. Manifest: `deployments/blocks-video-v3-sepolia.json`. |
| `blocks` single-block, `BLOCKS_SINGLE_V1` | `0x4a37f71418870d89e192bc973626db8eb4ded06b` | Previous site collection (GIF in metadata). Still deployed and open to direct `mint()` calls; the site no longer uses it. Kept in `blocks-page/dist/config.json` under `previous` for the lab's V1 renders. Manifest: `deployments/blocks-single-sepolia.json`. |
| `blocks` ten-block epochs, `NEO_TOKYO_BLOCKS_V1` | `0xedff9b1dfb79ba12fde25fc8c1aadb730a3b5825` | Oldest collection. Its router `0xedf6…ad46` (V1 renders) and scene contracts are reused by V1 and V3. Manifest: `deployments/blocks-sepolia.json`. |
| Site `blocks-page/` | https://blocks-eight-pi.vercel.app | Walkable Three.js city; mints V3 in the gallery. Vercel project `blocks` auto-deploys `main`; production verified after `3787c3a`. |
| Art lab | https://blocks-eight-pi.vercel.app/lab/ | Unlisted, `noindex`. Live V1/V3 renders for any seed. |
| Concepts site | https://solvids-concepts.vercel.app | Source in `concepts/`. Deploy only from a clean bundle, never the repo root (a root deploy once leaked `.env`). |

## V3 deployment evidence

- **Verification:** all four new contracts are exact matches (creation and runtime) on
  Sourcify. Etherscan rejects the `amsterdam` EVM version, as it did for V1.
- **Live audit:** `scripts/record_blocks_v3_sepolia.py` (run it with the diversity venv,
  which needs numpy and pycryptodome) checks several things:
  - receipts;
  - runtime bytecode against the local build, with immutables filled in;
  - the stored mint block;
  - seed, recipe and scene against an independent Python port;
  - all 90 AVI frames, the palette, the FFmpeg decode and the SVG poster, against
    `scripts/blocks_diversity_reference.py`.

  It writes the manifest and `previews/blocks-video-v3-sepolia/`.
- **Gas:** `tokenURI` needs about 420M gas, found by bisecting capped `eth_call`s.
  `eth_estimateGas` reverts because providers bound it by the 60M block gas limit.
- **Playback:** `BLOCKS_VIDEO_FIXTURES=blocks-video-v3-sepolia node scripts/blocks_video_browser_qa.mjs`
  passes in Chromium and Firefox. Safari is untested.
- **OpenSea:** the gate cannot run, because OpenSea dropped testnets
  (`testnets.opensea.io` redirects to "Farewell, Testnets"). The user explicitly chose to
  switch the site to V3 anyway; this is recorded in AGENTS.md and the manifest.

## Site (`blocks-page/`)

- **City:** `walker.mjs` (navigation, rooms, routes), `kit.mjs`, `streets.mjs`, `places.mjs`
  (ramen shop, gallery mint terminal, subway with ticket-gate wallet connect),
  `journey.mjs` (ride to Sakuragawa), `audio.mjs` and `city.mjs` (wiring). The QA hook is
  `window.__blocks`.
- **V3 media:**
  - `/api/token?id=` returns `{name, attributes, image (onchain SVG poster), video}`.
  - `&as=avi` returns the lossless AVI from `video(uint256)`.
  - `&as=player` returns the onchain player from `animationURI(uint256)`, served with
    `CSP: sandbox allow-scripts`.
  - Each is one 500M-gas `eth_call`, cached as immutable.
- **Animation:** `dist/avi.mjs` decodes the 8-bit BI_RGB AVI. Gallery frames show the
  poster, then animate the AVI. The mint reveal plays it over the poster and downloads
  the `.avi`. `test/avi.test.mjs` checks frame 0 against the live token's poster.
- **Mint checks:** `mint.mjs` requires `ART_VERSION === 'BLOCKS_VIDEO_V3'`, name and symbol
  `blocks`, and the configured renderer before sending the zero-argument `mint()`.
- **Lab:**
  - `api/lab.js` builds inputs from an integer seed only; the simulated block is
    13,000,000 with `prevrandao` = seed.
  - V1 asks the old router for `gif(bytes)`. V3 sends the `Info` tuple to the V3 renderer
    (`&as=poster|player|avi`).
  - `dist/lab/blockseed.mjs` ports the seed, artwork, scene and V3 recipe logic. It is
    verified against both live collections in `test/lab.test.mjs`.
  - `python3 scripts/blocks_lab_data.py` refreshes `dist/lab/data.json` and its posters.
- **Checks before pushing site changes:** `npm test` (31 tests), `npm run check`, and
  `node blocks-page/test/browser-qa.mjs` (about 5 minutes under SwiftShader; it mocks the
  wallet and serves the live V3 token's real poster and AVI).

## Prepared, not deployed

- `BLOCKS_VIDEO_V2` (`deployments/blocks-video-sepolia.json`) is superseded in practice by
  V3, but still prepared. It needs its own authorization if ever wanted.
- Base (`FOUNDRY_PROFILE=blocks_base`, `deployments/blocks-base.json`) has no broadcast
  approval. A Base or mainnet V3 deployment is the only way to pass a real OpenSea
  playback gate. It needs explicit user authorization.

## Open items

1. **`deployments/blocks-site.json` is stale.** It still records the `67fd74e` deploy and
   the V1 collection. Update it with the current deployment id, source commit and V3
   collection.
2. **Preview JSON drift.** A plain `forge test --offline` rewrites about 35 tracked files
   (`previews/blockart/*.json`, `previews/blocks-video/*.json`,
   `previews/blocks-single/nighttrain.json`, `previews/blocks-video-v3/nighttrain.json`,
   `previews/mpeg-*`, `previews/mpg-*`). Never commit them as measurements. Stage files
   explicitly. Worth fixing: have tests write only when an env flag is set.
3. **Performance unchecked.** Real-GPU and mobile performance of the city is not measured;
   only SwiftShader was used (about 550 draw calls on the street).
4. **Safari** playback of the onchain player and the canvas AVI decoder is untested.
5. **Open design questions.** These are the user's decisions:
   - V1's diversity weaknesses are visible in the lab. Satoyama seeds differ almost only
     in the torii colour, and same-scene neighbours can look alike. V3 addresses this for
     new mints.
   - Whether to deploy to Base or mainnet.
   - Whether the site should show V1 history at all.
