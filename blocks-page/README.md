# blocks — one block, one night

The single-block redesign targets Ethereum Sepolia and uses `mint()` with **no
arguments**. One action connects the wallet, checks the deployed recipe/renderer,
requests the free mint, waits for the receipt, then displays the token selected by
the transaction's actual block. No epoch, seed or header inputs are presented.
Only one token can be minted per block. Wallets can mint again in later blocks.

The new collection is **prepared, not deployed**. Its preview keeps minting and
artwork reads disabled until a confirmed deployment is recorded. The existing
public epoch collection and production site remain usable until the replacement
is explicitly authorized and validated. Status: `deployments/blocks-single-sepolia.json`.

The hero is a locally bundled Three.js r180 scene: instanced neon city, moving
train, rain and pointer parallax. Pause, reduced-motion preferences, background-tab
suspension and a no-WebGL fallback are supported. This browser illustration is
labelled separately from the original onchain GIF in the collection viewer.

The only server credential is `SEPOLIA_RPC_URL`, used for fixed-contract reads
capped at 500M gas. Never upload a deployment key or the repository's `.env`.
The API reads its public collection address from `dist/config.json` and refuses
reads for an unconfirmed deployment. No transcoding or signing happens here.

Checks from the repo root:

- `npm test --prefix blocks-page`
- `npm run check --prefix blocks-page`
- `node blocks-page/test/browser-qa.mjs` (Chromium; mocked wallet only)

The separate Vercel project is `blocks`, root directory `blocks-page`, production
URL https://blocks-eight-pi.vercel.app . Three.js provenance/license is in
`THIRD_PARTY.md`. Existing ghoulballs pages and their contracts are separate.
