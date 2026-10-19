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

The whole site is a walkable Three.js city. The page has no scroll: the collection,
the idea and a help guide open as panels over the street.

**Streets.** A square grid of named avenues (通り) and streets (番街) streams in
around the walker: neon market blocks, tall glass canyons with giant screens, low
lantern-lit alleys and the occasional sakura park with a torii. Signs lead with
Japanese and carry a smaller English line. Perpendicular signs stop in front of
facade ribs and awnings, and segments load well beyond the fog line in every
direction you can turn, so nothing pops in or clips. Small signs and glows only
render nearby and are excluded from the low-resolution wet-ground reflection.

**Walking.** ↑/W walks on (hold to hurry), ↓/S stops or steps back, ←/→ turn at
the next junction or into a doorway (press again to cancel), T turns around, and
Enter/E uses what is in front of you. On-screen arrows mirror the keys; mouse or
drag looks around. Prompts, a pulsing action button, a floating marker and a
minimap with the three places give visual hints; the `?` button explains the
controls and can guide you to any place. `#gallery`, `#ramen` and `#station`
deep-link straight inside.

**Places.** A ramen shop (ラーメン) with a robot chef. The gallery (ギャラリー),
whose walls show minted originals and whose central terminal
(鋳造) is the only place to mint; the one-action `mint()` flow is unchanged. A fresh
mint pops up full-screen as *your night*, then floats inside the terminal's hologram
rings and takes the first frame on the wall. Empty frames await a block; the site
shows no demo artwork. The collection panel explains how a block becomes a night
and describes the eight scenes in words; looking up a minted block opens the same
reveal. The
subway (地下鉄): tapping a ticket gate (改札) connects a wallet, or lets a visitor
through, then the train runs out through tunnels and a viaduct to Sakuragawa
(桜川), a riverside station among cherry blossoms. You can explore the platform
and deck; the train waits and brings you back as the city skyline comes into view.

**Sound.** Music is generated in the browser with Web Audio, with a layer for
each place: synth city, lo-fi ramen bar, ambient gallery, a driving ride and koto
plucks by the river. It starts only when Sound is switched on.

Pause, reduced-motion preferences (the scene starts still and never auto-walks),
background-tab suspension and a no-WebGL fallback (mint panel always shown) are
supported. The city is a browser illustration; the artwork is the original onchain
GIF. WebCodecs-capable browsers animate the gallery's GIF textures.

**Art lab.** `/lab/` (unlisted, `noindex`) is a workshop for reviewing the NFTs,
like the ghoul lab. Its renders are real: `api/lab.js` builds the 3,520-byte input
for a simulated block (block 13,000,000, fixed fields, `prevrandao` = seed) with an
exact JS port of `SingleBlockData`/`Epoch.scene` (`dist/lab/blockseed.mjs`), then asks
the deployed V1 renderer for the GIF in a 500M-gas `eth_call`. Only an integer seed
is accepted and responses are cached as immutable. Tabs: rerolled nights, forced
scene and rare studies, V1 against prepared V2/V3 posters, checks (scene
distribution, capped gas, V3 diversity audit and stress cases) and minted tokens.
`python3 scripts/blocks_lab_data.py` refreshes its data and posters from `previews/`.

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
- `node blocks-page/test/browser-qa.mjs` (Chromium; mocked wallet only; walks, mints in the gallery, connects at the gate and rides to Sakuragawa and back — several minutes under SwiftShader)

The separate Vercel project is `blocks`, root directory `blocks-page`, production
URL https://blocks-eight-pi.vercel.app . Three.js provenance/license is in
`THIRD_PARTY.md`. Existing ghoulballs pages and their contracts are separate.
