#!/usr/bin/env python3
"""Create the public mint configuration from checked-in deployment manifests."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# The render RPC serves the gallery's full tokenURI reads, which need a ~500M eth_call gas cap (most public RPCs stop at 50M).
networks = [
    ("sepolia", 11155111, "Sepolia", "Ethereum testnet", "https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.gateway.tenderly.co", "https://sepolia.etherscan.io", True),
    ("base", 8453, "Base", "Mainnet", "https://mainnet.base.org", "https://base.gateway.tenderly.co", "https://basescan.org", False),
    ("base-sepolia", 84532, "Base Sepolia", "Base testnet", "https://sepolia.base.org", "https://base-sepolia.gateway.tenderly.co", "https://sepolia.basescan.org", True),
]


def address(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", value) or int(value, 16) == 0:
        raise ValueError(f"Invalid deployed address: {value!r}")
    return value


output = {"collectionName": "ghoulballs", "defaultChainId": 11155111, "networks": []}
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
        # Every collection version ever deployed, for the onchain gallery; the current one is the mint target.
        versions = manifest.get("collections") or [dict(version=1, address=collection, status="current")]
        versions = [dict(version=v["version"], address=address(v["address"]), current=v["status"] == "current") for v in versions]
        if [v["address"].lower() for v in versions if v["current"]] != [collection.lower()]:
            raise ValueError(f"{slug}: exactly one current collection must match the manifest collection")
    else:
        collection = renderer = None
        versions = []
    output["networks"].append(dict(chainId=chain_id, chainHex=hex(chain_id), name=name,
        subtitle=subtitle, testnet=testnet, rpcUrl=rpc, renderRpcUrl=render_rpc, explorerUrl=explorer,
        collectionAddress=collection, rendererAddress=renderer, deployed=deployed, collections=versions))
destination = ROOT / "mint-page" / "dist" / "config.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(output, indent=2) + "\n")
print("Mint config synced; no undeployed address can enable minting.")
