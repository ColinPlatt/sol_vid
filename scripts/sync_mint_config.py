#!/usr/bin/env python3
"""Create the public mint configuration from checked-in deployment manifests."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Render RPCs serve full tokenURI reads, which need more eth_call gas than 50M-capped public RPCs allow. Base's own
# RPC grants the full amount and took 18 simultaneous reads; the Tenderly gateway (500M) rate-limits bursts, so it is
# the fallback.
networks = [
    ("base", 8453, "Base", "Mainnet", "https://mainnet.base.org", ["https://mainnet.base.org", "https://base.gateway.tenderly.co"], "https://basescan.org", False),
]


def address(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", value) or int(value, 16) == 0:
        raise ValueError(f"Invalid deployed address: {value!r}")
    return value


# The page is Base only; Sepolia and Base Sepolia stay in their manifests.
output = {"collectionName": "ghoulballs", "defaultChainId": 8453, "networks": []}
for slug, chain_id, name, subtitle, rpc, render_rpc, explorer, testnet in networks:
    manifest = json.loads((ROOT / "deployments" / f"{slug}.json").read_text())
    assert manifest["chain_id"] == chain_id
    assert manifest["collection_name"] == manifest["collection_symbol"] == "ghoulballs"
    if manifest["supply_cap"] != 6667:
        raise ValueError(f"{slug}: expected a supply cap of 6,667")
    deployed = manifest["status"] == "deployed"
    if deployed:
        collection = address(manifest["collection"])
        renderer = address(manifest["renderer"])
        hashes = manifest["transaction_hashes"]
        if len(hashes) < 2 or any(not re.fullmatch(r"0x[0-9a-fA-F]{64}", h) for h in hashes):
            raise ValueError(f"{slug}: successful deployment transaction hashes are required")
        # The page mints from and shows only the current collection; older versions stay in the manifest.
        versions = manifest.get("collections") or [dict(version=1, address=collection, status="current")]
        versions = [dict(version=v["version"], address=address(v["address"]), current=v["status"] == "current",
                         tokensPerMint=v.get("tokens_per_mint", 1), mintLimit=v.get("mint_limit")) for v in versions]
        if any(v["tokensPerMint"] not in (1, 3) for v in versions):
            raise ValueError(f"{slug}: tokens_per_mint must be 1 or 3")
        if [v["address"].lower() for v in versions if v["current"]] != [collection.lower()]:
            raise ValueError(f"{slug}: exactly one current collection must match the manifest collection")
        versions = [v for v in versions if v["current"]]
    else:
        collection = renderer = None
        versions = []
    tokens_per_mint = next((v["tokensPerMint"] for v in versions if v["current"]), 1)
    mint_limit = next((v["mintLimit"] for v in versions if v["current"]), None)
    output["networks"].append(dict(chainId=chain_id, chainHex=hex(chain_id), name=name,
        subtitle=subtitle, testnet=testnet, rpcUrl=rpc, renderRpcUrl=render_rpc[0], renderRpcUrls=render_rpc, explorerUrl=explorer,
        collectionAddress=collection, rendererAddress=renderer, deployed=deployed, tokensPerMint=tokens_per_mint, mintLimit=mint_limit,
        collections=versions))
destination = ROOT / "mint-page" / "dist" / "config.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(output, indent=2) + "\n")
print("Mint config synced; no undeployed address can enable minting.")
