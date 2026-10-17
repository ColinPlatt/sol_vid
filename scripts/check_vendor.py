#!/usr/bin/env python3
"""Verify vendored source hashes and reproduce the compatibility compilation unit."""
import hashlib
import json
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "vendor" / "openzeppelin"
manifest = json.loads((ROOT / "manifest.json").read_text())
assert manifest["version"] == "v5.4.0"
for path, checksum in manifest["sha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == checksum, path
    assert checksum == manifest["upstream_sha256"][path], "Original source was modified"
visited, ordered = set(), []


def visit(path):
    if path in visited:
        return
    visited.add(path)
    for dependency in re.findall(r'import[^;]*["\']([^"\']+)["\']\s*;', (ROOT / path).read_text()):
        visit(posixpath.normpath(posixpath.join(posixpath.dirname(path), dependency)))
    ordered.append(path)


for path in sorted(manifest["sha256"]):
    if path.endswith(".sol"):
        visit(path)
parts = [f"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.30;\n// Derived from OpenZeppelin {manifest['version']}. See manifest.json and README.md.\n"]
for path in ordered:
    source = (ROOT / path).read_text()
    source = re.sub(r"^// SPDX-License-Identifier:.*\n", "", source, flags=re.M)
    source = re.sub(r"^[ \t]*import\b[^;]+;[ \t]*\n?", "", source, flags=re.M)
    source = re.sub(r"^[ \t]*pragma solidity[^;]+;[ \t]*\n?", "", source, flags=re.M)
    source = re.sub(r"\baddress\((0x[0-9a-fA-F]+|[0-9]+)\)", r"address(uint160(\1))", source)
    source = re.sub(r"\b(2|10)\s*\*\*\s*(\d+)\b", lambda m: str(int(m.group(1)) ** int(m.group(2))), source)
    parts.append("\n// Source: " + path + "\n" + source)
derived = "\n".join(parts).encode()
if "--write-derived" in sys.argv:
    (ROOT / manifest["derived_file"]).write_bytes(derived)
    manifest["derived_sha256"] = hashlib.sha256(derived).hexdigest()
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
assert (ROOT / manifest["derived_file"]).read_bytes() == derived, "Derived source differs"
assert hashlib.sha256(derived).hexdigest() == manifest["derived_sha256"]
print(f"Verified {len(manifest['sha256'])} pristine upstream files and the derived compilation unit.")
