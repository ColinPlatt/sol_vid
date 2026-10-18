# blocks — standalone Ethereum Sepolia mint page

A separate Vercel project, `blocks`, serves this directory. The existing
`mint-page/` ghoulballs site and its Base blocks route are unchanged.

The page targets only Ethereum Sepolia (11155111), collection
`0xedff9b1dfb79ba12fde25fc8c1aadb730a3b5825`. It reconstructs current Amsterdam
headers, asks the wallet to estimate/simulate a free epoch mint, caps testnet fees,
checks the selected chain/account again before sending, and validates the receipt.
After minting it loads the original onchain GIF and traits. Existing minted epochs
can also be viewed and downloaded. The first token's original GIF is a bundled
preview, and eight example GIFs come from Solidity scene validation.

`SEPOLIA_RPC_URL` is the sole server-side environment variable used by `api/token.js`.
It must support a 500M-gas read. Never upload a deployment key or the repository's
`.env` file to this project. The server only reads the fixed blocks contract;
it doesn't sign transactions or transcode the returned media. Browser proof
fetching uses the public Sepolia endpoint in `dist/config.json`.

From the repository root, run `npm test --prefix blocks-page` and
`npm run check --prefix blocks-page`. Browser QA is
`PATH=/path/to/foundry:$PATH node blocks-page/test/browser-qa.mjs` and uses only a
mocked wallet. Publish this directory through the linked blocks Vercel project.

`blocks.vercel.app` was already assigned to another account when this project was
created; Vercel assigned `blocks-eight-pi.vercel.app`. Project identity and the
confirmed production deployment are recorded in `deployments/blocks-site.json`.

Production: https://blocks-eight-pi.vercel.app . The project is linked to
`ColinPlatt/sol_vid`, with root directory `blocks-page`. The recorded release was
explicitly deployed from `blocks-site`; merge its PR after the Sepolia deployment
PR to make the site available on the repository's normal production branch.
Only the read RPC is stored as a Vercel secret.
