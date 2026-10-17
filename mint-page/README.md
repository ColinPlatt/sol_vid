# ghoulballs mint page

A dependency-free static page for the 6,667-edition free ERC-721. Includes real
Solidity-rendered vaporwave GIF examples (four themes and four motion styles), wallet discovery, connection, network switching,
zero-value `mint()` submission, transaction links and receipt tracking. Supports
Sepolia, Base and Base Sepolia. Network gas applies; no per-wallet mint limit.

Sepolia is deployed and enabled (collection v3: each mint is a GIF, AVI and MPEG-1 set; one mint per wallet). Base and Base Sepolia remain
disabled. The page uses confirmed deployment addresses. The contract
enforces the cap; the page also shows supply and disables sold-out minting when
a supply read succeeds.

Below the mint panel, the page lists every token from every collection version in
the deployment manifest, newest first, with no indexer. It reads `totalSupply` and
`ownerOf` through the normal RPC, and each token's full `tokenURI` with a 500M gas
cap through `renderRpcUrl` (the Tenderly public gateway, since most public RPCs
stop at 50M). It shows each version's image exactly as the contract returned it.
If that read fails, it falls back to the cheaper raw `gif(id)` read. Tokens load
as they scroll into view, three reads at a time. Set cards have GIF / AVI / MPG
tabs; AVI and MPG run that token's own onchain player (its `animation_url`) via
`player.html`, a sandboxed shim that allows the player's inline script (a `data:`
iframe would inherit this page's no-inline-script policy). Older single-token
collections offer raw GIF / AVI / MPG downloads. The screen shows the current
collection's newest token. `/gallery.html` redirects to `/#minted`.

```bash
cd mint-page
npm test
npm run check
npm run preview
# Open http://localhost:4173
```

Refresh exact GIF assets and derived static posters after contract exports with
`python3 scripts/sync_mint_art.py` from the repository root. Static posters are
offchain snapshots; the animated GIFs are unchanged Solidity return bytes.

No dependencies or build are required. Deploy `dist/` on a static host. The
tracked `.openai/hosting.json` identifies the private Sites preview; preserve its
project ID. GitHub holds the canonical source. Sites publication uses a separate
source checkout and an archive of the exact pushed source commit.

After a real deployment, update `deployments/<network>.json` with status
`deployed`, collection and renderer addresses, and both successful transaction
hashes. From the repository root run:

```bash
python3 scripts/sync_mint_config.py
```

Review the generated `dist/config.json`, then republish. Use a production RPC
suited to browser traffic before public launch. Never put a deployer private key
in this directory; signing happens in the user's wallet. Deployment keys belong
only in the repository root's ignored local `.env`.

Wallet unit tests cover the transaction payload, network switching, deployment
checks, cancellation, account changes and receipt verification. Browser QA
(`node test/browser-qa.mjs`) requires installed Chrome and loopback networking;
it checks desktop/mobile layout, the undeployed guard, and an enabled Sepolia
mint through a mocked wallet and receipt. It sends no real transactions. The
deployed contract was checked with a live zero-value mint simulation and gas
estimation; no real mint has been sent.

## Vercel

Import `ColinPlatt/sol_vid` with **Root Directory `mint-page`**, framework **Other**,
no install/build command, and output directory **`dist`**. These static deployment
settings are tracked in `vercel.json`. The page needs no environment variables.
`config.json` is served with `Cache-Control: no-store` so deployment addresses
are refreshed. `.vercelignore` excludes local tooling, tests and environment files.

The requested Vercel owner is `colin@numerate.tech` and the GitHub owner is
`ColinPlatt`. GitHub was confirmed through the connected account. The Vercel CLI
was confirmed as colin@numerate.tech (team `platt-advisors-projects`, project
`mint-page`). Production: https://mint-page-mauve.vercel.app. The project is linked to
the GitHub repo; its Root Directory must be `mint-page` for git-triggered deploys.
