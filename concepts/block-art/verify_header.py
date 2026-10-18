"""Rebuild a Base block header (RLP) from eth_getBlockByNumber JSON and check keccak(header) == block hash."""
import json, subprocess, sys
FIELDS = ["parentHash","sha3Uncles","miner","stateRoot","transactionsRoot","receiptsRoot","logsBloom","difficulty","number",
          "gasLimit","gasUsed","timestamp","extraData","mixHash","nonce","baseFeePerGas","withdrawalsRoot","blobGasUsed",
          "excessBlobGas","parentBeaconBlockRoot","requestsHash"]
INTS = {"difficulty","number","gasLimit","gasUsed","timestamp","baseFeePerGas","blobGasUsed","excessBlobGas"}
def item(b):
    if len(b) == 1 and b[0] < 0x80: return b
    return length(len(b), 0x80) + b
def length(n, off):
    if n < 56: return bytes([off + n])
    nb = n.to_bytes((n.bit_length() + 7) // 8, "big"); return bytes([off + 55 + len(nb)]) + nb
def header(b):
    out = b""
    for f in FIELDS:
        if f not in b: continue
        v = b[f]
        raw = (int(v, 16).to_bytes((int(v, 16).bit_length() + 7) // 8, "big") if f in INTS else bytes.fromhex(v[2:]))
        out += item(raw)
    return length(len(out), 0xc0) + out
if __name__ == "__main__":
    b = json.load(open(sys.argv[1]))["result"]
    h = header(b)
    k = subprocess.check_output(["cast", "keccak", "0x" + h.hex()]).decode().strip()
    print(f"block {int(b['number'],16)}: header {len(h)} bytes, keccak {'==' if k == b['hash'] else '!='} block hash")
