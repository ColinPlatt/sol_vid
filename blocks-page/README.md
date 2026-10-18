# blocks — one block, one night

The single-block redesign targets Ethereum Sepolia and uses `mint()` with **no
arguments**. One action connects the wallet, checks the deployed recipe/renderer,
requests the free mint, waits for the receipt, then displays the token selected by
the transaction's actual block. No epoch, seed or header inputs are presented.
Only one token can be minted per block. Wallets can mint again in later blocks.

The revised collection is deployed on **Ethereum Sepolia** at
`0x4a37f71418870d89e192bc973626db8eb4ded06b`. The first NFT, **DESCENT #11941801**,
is owned by the deployment wallet. Receipts, exact bytecode checks and original
media hashes are in `deployments/blocks-single-sepolia.json`. Sourcify verified
exact creation and runtime matches. The prior epoch prototype remains separate.

The Three.js scene is a Tokyo-inspired modernist night walk at 1.72m eye height.
Eight street segments recycle behind the walker: glass and concrete facades,
covered pavements, lit shops, trees, vending machines and overhead bridges.
A low-resolution planar reflection pass gives the wet pavement actual reflections
of the buildings; rain, a passing train and gentle head movement add motion.

“Walk the street” clears the overview and pins a compact mint dock over the walk.
Move the pointer or drag on mobile to look around; Escape or “Back to overview”
returns to the page. Entering the street is optional: the same one-action mint is
available in both views. A confirmed mint returns to the artwork viewer.
Pause, reduced-motion preferences, background-tab/offscreen suspension and a
no-WebGL fallback are supported. This browser illustration is separate from the
original onchain GIF in the collection viewer.

The street includes eight art kiosks. They start with labelled demo scenes, then
show original minted GIFs from the fixed Sepolia collection. New mints also enter
the gallery after their metadata loads. WebCodecs-capable browsers animate GIF
textures; other browsers display the first-frame poster. Pausing or requesting
reduced motion freezes the artwork as well as the walk.

The read-only `/api/world` feed refreshes every 30 seconds and reports the latest
Sepolia block, base fee and collection mint count in the HUD and overhead signs.
Delayed/offline readings are marked. Mint discovery uses the collection's
`latestTokenId`, the known first mint and a bounded 2,000-block Transfer-log scan;
this is a recent gallery, not a complete historical index. Metadata renders run
sequentially, at most two new tokens per refresh, without blocking chain updates.
The endpoint accepts no RPC or collection override and uses only `SEPOLIA_RPC_URL`.

The tab icon is a locally drawn neon city block with animated windows. Like
ghoulballs, it swaps pre-rendered PNG frames, respects reduced motion, and keeps
static ICO/PNG and Apple touch fallbacks. Browser QA exports its first frame to
`previews/blocks-sepolia/tab-icon.png`.

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
