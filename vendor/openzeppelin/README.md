# OpenZeppelin dependency

Pinned upstream: `OpenZeppelin/openzeppelin-contracts`, tag **v5.4.0**, MIT license.
Only the ERC-721, Base64, Strings and their transitive dependencies are included.
The files under `contracts/` are unmodified upstream sources; `manifest.json`
records each SHA-256 hash. `LICENSE` is the upstream license.

`SolVideoNFT` imports the reproducibly derived `Flattened.sol`. Generation:

```bash
python3 scripts/vendor_openzeppelin.py
```

The derived file orders dependencies, removes import directives and consolidates
the MIT license identifier and pragma. It also spells numeric address casts as
`address(uint160(value))` and constant numeric powers as their exact decimal
values. These transformations avoid pathological numeric-literal inference in
the workspace's solc 0.8.30 binary. They preserve runtime arithmetic and ERC-721
logic. No minting, authorization, receiver or storage logic is patched.

The generated file's checksum and transformation list are in `manifest.json`.
Do not format vendored files; the project's formatter ignores `vendor/**`.
Verify the complete dependency snapshot and derived file with:

```bash
python3 scripts/check_vendor.py
```

Regenerate just the derived file from the verified local snapshot without network
access using `python3 scripts/check_vendor.py --write-derived`.
