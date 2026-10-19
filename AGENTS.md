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
- Private research notes live in `docs/research/` (gitignored, never commit them).
  `docs/research/marketplace-video.md` covers getting the AVI/MPEG versions onto
  marketplaces: measurements, hypotheses, probe experiments and codec options.
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

- The separate video edition is authorized in `docs/VIDEO.md`; `VideoNFT` uses AVI
  and a static poster, while the live GIF collection and its page stay unchanged.
  Keep video release settings separate and disabled until confirmed deployment
  and production OpenSea playback evidence. MPEG/MP4 fallback work is conditional.
  The Base marketplace probe broadcast was authorized on 2026-10-17.
- The user also authorized the Base AVI canary and gated edition launch on
  2026-10-17. Both are deployed and their actual OpenSea players pass; confirmed
  receipts and evidence are in `deployments/video-base.json`. This authorization
  does not imply permission for unrelated redeployments.
- For future deployments, the user prefers Foundry's `--verify` alongside
  `--broadcast` when explorer publication is authorized. Confirm the installed
  Foundry version's verifier destinations first; this version also submits to
  Sourcify even when Etherscan is selected.

- `src/blockart/` is a separate authorized collection, named/symbolled `blocks`,
  with verified ten-block epochs and `NEO_TOKYO_BLOCKS_V1` artwork. Preserve the
  existing ghoulballs contracts and page. Base block-art work has no broadcast approval.
- Block-art media changes require capped GIF/AVI/metadata measurements and
  `scripts/validate_blockart.py`; gallery generation is `scripts/blockart_gallery.py`.
  The `/blocks/` mint route stays disabled until its own deployment/playback gates.
- New `blocks` Base builds use `FOUNDRY_PROFILE=blocks_base` (Solidity 0.8.37,
  Cancun). The legacy base/base_sepolia compiler pins and live deployments stay
  unchanged. Record the compiler and profile with all new measurements.

- The user authorized the revised single-block Ethereum Sepolia deployment and
  site update on 2026-10-18. Confirmed receipts and exact-source verification are
  in `deployments/blocks-single-sepolia.json`. The standalone `blocks-page/` uses
  this collection; its zero-argument mint captures one current execution block.
  Further deployments still need their own authorization.
- The user requested working directly on `main`; do not create routine feature branches.

- The user requested cheaper-model subagent delegation when useful. For substantial
  work with independent subtasks, read
  `.agents/skills/cost-aware-delegation/SKILL.md` and use its assignment, model,
  ownership and verification workflow. Prefer GPT-6 Luna for bounded tasks;
  keep small or tightly coupled work local. This does not authorize deployments
  or edits outside the user's task, and workers must preserve concurrent work.

- Taste is maintained in the private `ColinPlatt/taste` template repository and
  installed at `~/.agents/skills/taste/SKILL.md`. Use the installed skill for
  aesthetic work or recording explicit design feedback. Keep personal profile
  updates in that private repository rather than copying them into this public
  project. Distinguish confirmed preferences from observed implementations and
  preserve project-specific counterexamples. If Taste is unavailable, use the
  current brief; do not require private repository access to work on sol_vid.

- `BlockVideoNFT` / `BlockVideoRenderer` are the prepared `BLOCKS_VIDEO_V2`
  revision: native SVG first-frame poster plus a self-contained AVI player,
  without GIF metadata. Do not replace the deployed V1 page/config until a new
  deployment is authorized, confirmed and its own marketplace gate passes.
  Run `scripts/validate_blocks_video.py` and
  `scripts/blocks_video_browser_qa.mjs` after video-revision media changes.

- `BLOCKS_VIDEO_V3` is a separate undeployed diversity experiment in
  `BlockVideoNFTV3` / `BlockVideoRendererV3`; preserve V1/V2 and the live page.
  `docs/BLOCK_DIVERSITY.md` describes its 100k native-frame audit and its limits.
  Use `scripts/export_blocks_diversity.py`, `scripts/audit_blocks_diversity.py`,
  and `scripts/validate_blocks_video_v3.py` for recipe changes. Do not claim
  uniqueness from seed/trait counts, serial labels, phase, or camera transforms.
  No deployment authorization is implied by this prototype or its audit.
