# Working on sol_vid

The GitHub home is https://github.com/ColinPlatt/sol_vid. Keep source, tests,
measurements and example media in sync as this experiment develops.

- Every native video or GIF example must be produced by one Solidity static call.
- The render budget is 500,000,000 gas. Measure it using an actual capped
  `STATICCALL`; distinguish binary output from base64 or NFT metadata overhead.
- Keep AVI/GIF lossless output separate from MPEG's DC-only and chroma approximations.
- MP4s and preview montages are offchain viewing copies. Label them accordingly.
- Preserve deterministic seed behaviour; changing the generative recipe requires
  an explicit version change and updated independent reference validation.
- Do not modify sibling inspiration repositories without an explicit request.
- The NFT collection name and symbol are both `ghoulballs`. Minting is free of
  protocol fees, with no supply or wallet limit. Network gas still applies.
- `deployments/sepolia.json` records deployment status. Keep simulation addresses
  separate from real deployments; preparation does not authorize broadcasting.
- Check the vendored OpenZeppelin snapshot with `python3 scripts/check_vendor.py`.
  Do not format `vendor/**`; regenerate its derived file using the documented script.
- Ignore `out/` and `cache/`. Do not commit credentials or local tool settings.

Before pushing code changes, run `forge fmt --check` and `forge test --offline -vv`.
When media generation changes, also run `python3 scripts/validate.py` and update
the README's measurements and examples. The compiler is pinned in `foundry.toml`;
`FOUNDRY_SOLC=/usr/bin/solc` is the local override in this workspace.
For NFT metadata changes also run `python3 scripts/validate_nft.py` and measure
the complete `tokenURI`, including both media files, JSON and base64 layers.
