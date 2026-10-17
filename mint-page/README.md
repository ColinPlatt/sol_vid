# ghoulballs mint page

A dependency-free static page for the 6,667-edition free ERC-721. Includes real
Solidity-rendered vaporwave GIF examples (four themes and four motion styles), wallet discovery, connection, network switching,
zero-value `mint()` submission, transaction links and receipt tracking. Supports
Base only. Network gas applies; one mint per address (shown as "FREE · 1 PER ADDRESS").

The page offers only Base (no network picker). When a wallet connects on another
chain, the page asks it to switch to Base, adding Base if the wallet lacks it, and
asks again if the wallet later moves away. If that is declined, the button reads
SWITCH TO BASE and minting switches first. Sepolia and Base Sepolia deployments
stay in their manifests but are not shown. The page uses confirmed deployment
addresses. The contract enforces the cap and the one-mint limit; the page also shows
supply, disables sold-out minting, and shows MINTED once the connected wallet has minted.

Below the mint panel, the page lists every token of the current collection, newest
first, with no indexer (older Sepolia versions stay in the manifest only). It reads `totalSupply` and
`ownerOf` through the normal RPC, and each token's full `tokenURI` with a 500M gas
cap through `renderRpcUrl` (the Tenderly public gateway, since most public RPCs
stop at 50M). It shows each version's image exactly as the contract returned it.
If that read fails, it falls back to the cheaper raw `gif(id)` read. Tokens load
as they scroll into view, three reads at a time. Every card shows the token's GIF. The screen shows the current
collection's newest token. `/gallery.html` redirects to `/#minted`.

## Sharing and token pages

After a confirmed mint, **SHARE ON X** opens X's post intent with "Just minted
ghoulballs: Ethereum's first (probably) fully onchain animated GIF. Mint yours for
free at:" and the token's own page. Where the browser can share files (most phones),
the share sheet also gets the minted GIF itself, read from the contract. Nothing is
posted without the user.

Each token has a server-rendered page, `/t/:id` (`api/token.js`), because link
crawlers do not run JavaScript. It carries Open Graph / X card tags whose image is
`/t/:id.png` (`api/card.js`): a 1200x630 PNG of the token's first GIF frame at 8x,
decoded from the contract's `gif(id)`. X shows card images as stills. Both read Base
through `renderRpcUrl`, are cached at the edge for a year (tokens never change), and
return uncached 404s for unminted or malformed IDs. Gallery cards link to their page.

## Icons

`/favicon.ico`, `assets/favicon.gif` and `assets/apple-touch-icon.png` are Base token
#1's exact `gif(id)` bytes (and its first frame), so the icon matches the deployed
artwork; Firefox animates the GIF natively. As in numerate_www's live favicon,
`favicon.js` also swaps PNG frames into a `<link>` at 10fps (Chrome, Edge, Firefox),
starting with token #1 and then following the newest token. Safari keeps the static
icon. `gif.mjs` is the GIF decoder shared by the page and the server.

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
