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
  protocol fees; network gas still applies. The NFT artwork is the GIF only (no `animation_url`);
  at most 6,667 tokens, one mint per caller address. The AVI/MPEG HTML-player
  version is parked on the `avi-mpeg-players` branch; do not merge it into `main`
  without an explicit request.
- Deployment scripts mint the first set to the deployer immediately after deploying
  the collection, in the same broadcast; keep that in new deployment scripts.
- `deployments/sepolia.json` records deployment status. Keep simulation addresses
  separate from real deployments; preparation does not authorize broadcasting.
- Check the vendored OpenZeppelin snapshot with `python3 scripts/check_vendor.py`.
  Do not format `vendor/**`; regenerate its derived file using the documented script.
- Ignore `out/` and `cache/`. Do not commit credentials or local tool settings.

Before pushing code changes, run `forge fmt --check` and `forge test --offline -vv`.
When media generation changes, also run `python3 scripts/validate.py` and update
the README's measurements and examples. The compiler is pinned in `foundry.toml`;
the default target is Solidity 0.8.37 / Amsterdam with Foundry >=1.8.5.
Use a matching compiler override, not the old `/usr/bin/solc` (0.8.30).
Base uses `FOUNDRY_PROFILE=base` or `base_sepolia` with Solidity 0.8.30 / Cancun.
For NFT metadata changes also run `python3 scripts/validate_nft.py` and measure
the complete `tokenURI`, including both media files, JSON and base64 layers.

- Base and Base Sepolia manifests follow the same no-broadcast preparation rule.
- The static mint page lives in `mint-page/`; run `npm test` and `npm run check`
  there after wallet changes. Browser QA uses a mocked wallet and sends no real transactions.
- Rebuild page deployment settings with `python3 scripts/sync_mint_config.py`
  after updating confirmed deployment manifests. Never put signing keys in page files.

- Current seed-only artwork is `GHOULBALLS_VAPOR_V3` (scenes 7–10; per-ball HSV
  colours). Preserve the original scenes 0–6. Update `scripts/vapor_reference.py`
  independently when the recipe changes; refresh mint-page media using
  `scripts/sync_mint_art.py`.
