# ghoulballs mint page

A dependency-free static page for the 6,667-edition free ERC-721. Includes real
Solidity-rendered GIF examples, wallet discovery, connection, network switching,
zero-value `mint()` submission, transaction links and receipt tracking. Supports
Sepolia, Base and Base Sepolia. Network gas applies; no per-wallet mint limit.

All networks start disabled because no contracts have been deployed. The page
never uses simulation addresses and does not fetch expensive video metadata.
The contract enforces the cap; the page also shows supply and disables sold-out
minting when a supply read succeeds.

```bash
cd mint-page
npm test
npm run check
npm run preview
# Open http://localhost:4173
```

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
it checks desktop/mobile layout and the undeployed flow with a mocked wallet.
It sends no real transactions. A live mint remains to be tested after deployment.
