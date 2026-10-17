#!/usr/bin/env python3
"""Fetch a pinned OpenZeppelin closure, recording upstream and local checksums."""
import hashlib
import json
import posixpath
import re
from pathlib import Path
from urllib.request import urlopen

VERSION = "v5.4.0"
ROOT = Path(__file__).resolve().parents[1] / "vendor" / "openzeppelin"
BASE = f"https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/{VERSION}/"
pending = ["contracts/token/ERC721/ERC721.sol", "contracts/utils/Base64.sol", "contracts/utils/Strings.sol", "LICENSE"]
checksums = {}
upstream_checksums = {}
while pending:
    path = pending.pop()
    if path in checksums:
        continue
    with urlopen(BASE + path, timeout=30) as response:
        data = response.read()
    upstream_checksums[path] = hashlib.sha256(data).hexdigest()
    destination = ROOT / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    checksums[path] = hashlib.sha256(data).hexdigest()
    for dependency in re.findall(r'import[^;]*["\']([^"\']+)["\']\s*;', data.decode()):
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), dependency))
        if not resolved.startswith("contracts/"):
            raise ValueError(resolved)
        pending.append(resolved)
visited = set()
ordered = []


def visit(path):
    if path in visited:
        return
    visited.add(path)
    for dependency in re.findall(r'import[^;]*["\']([^"\']+)["\']\s*;', (ROOT / path).read_text()):
        visit(posixpath.normpath(posixpath.join(posixpath.dirname(path), dependency)))
    ordered.append(path)


for path in sorted(checksums):
    if path.endswith(".sol"):
        visit(path)
parts = [f"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.30;\n// Derived from OpenZeppelin {VERSION}. See manifest.json and README.md.\n"]
for path in ordered:
    source = (ROOT / path).read_text()
    source = re.sub(r"^// SPDX-License-Identifier:.*\n", "", source, flags=re.M)
    source = re.sub(r"^[ \t]*import\b[^;]+;[ \t]*\n?", "", source, flags=re.M)
    source = re.sub(r"^[ \t]*pragma solidity[^;]+;[ \t]*\n?", "", source, flags=re.M)
    # Preserve runtime semantics while avoiding the local compiler's pathological
    # untyped numeric-literal inference and constant-exponentiation cases.
    source = re.sub(r"\baddress\((0x[0-9a-fA-F]+|[0-9]+)\)", r"address(uint160(\1))", source)
    source = re.sub(r"\b(2|10)\s*\*\*\s*(\d+)\b", lambda m: str(int(m.group(1)) ** int(m.group(2))), source)
    parts.append("\n// Source: " + path + "\n" + source)
flattened = "\n".join(parts).encode()
(ROOT / "Flattened.sol").write_bytes(flattened)
(ROOT / "manifest.json").write_text(json.dumps({"repository": "OpenZeppelin/openzeppelin-contracts", "version": VERSION,
    "upstream_sha256": dict(sorted(upstream_checksums.items())), "sha256": dict(sorted(checksums.items())),
    "derived_file": "Flattened.sol", "derived_sha256": hashlib.sha256(flattened).hexdigest(),
    "transforms": ["Flatten dependency order and consolidate MIT/pragma declarations", "Explicit uint160 intermediate in numeric address casts", "Expand constant powers of two and ten into equivalent decimal literals"]}, indent=2) + "\n")
print(f"Vendored {len(checksums)} files from OpenZeppelin {VERSION}")
