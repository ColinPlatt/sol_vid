import test from "node:test";
import assert from "node:assert/strict";
import { MINT, TRANSFER, validateConfig, ensureChain, submitMint, mintedToken, friendlyError } from "../dist/wallet.mjs";

const account = "0x" + "a".repeat(40);
const collection = "0x" + "b".repeat(40);
const renderer = "0x" + "c".repeat(40);
const hash = "0x" + "d".repeat(64);
const network = { chainId: 11155111, chainHex: "0xaa36a7", name: "Sepolia", rpcUrl: "https://rpc.example", explorerUrl: "https://explorer.example", deployed: true, collectionAddress: collection, rendererAddress: renderer };
function abiString(value) { return "0x" + (32n).toString(16).padStart(64, "0") + BigInt(value.length).toString(16).padStart(64, "0") + Buffer.from(value).toString("hex").padEnd(64, "0"); }

function wallet(overrides = {}) {
  const calls = [];
  let chain = network.chainHex;
  const provider = { calls, async request({ method, params }) {
    calls.push({ method, params });
    if (Object.hasOwn(overrides, method)) return overrides[method]({ method, params, calls });
    if (method === "eth_chainId") return chain;
    if (method === "eth_accounts") return [account];
    if (method === "wallet_switchEthereumChain") { chain = params[0].chainId; return null; }
    if (method === "eth_getCode") return "0x60006000";
    if (method === "eth_call") {
      if (["0x06fdde03", "0x95d89b41"].includes(params[0].data)) return abiString("ghoulballs");
      if (params[0].data === "0x8ada6b0f") return "0x" + renderer.slice(2).padStart(64, "0");
      return "0x" + "1".padStart(64, "0");
    }
    if (method === "eth_estimateGas") return "0x186a0";
    if (method === "eth_sendTransaction") return hash;
    throw new Error("Unexpected wallet method " + method);
  } };
  return provider;
}

test("mint sends only the ERC721 mint selector, zero value, selected chain and bounded estimated gas", async () => {
  const provider = wallet();
  assert.equal(await submitMint(provider, network, account), hash);
  const sends = provider.calls.filter(c => c.method === "eth_sendTransaction");
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].params[0], { from: account, to: collection, data: MINT, value: "0x0", chainId: network.chainHex, gas: "0x1d4c0" });
  assert(!provider.calls.some(c => c.method === "personal_sign" || c.method === "eth_signTypedData_v4"));
  assert(!provider.calls.some(c => c.method === "eth_call" && c.params[0].data.startsWith("0xc87b56dd")), "No expensive tokenURI read");
});

test("undeployed networks cannot send transactions", async () => {
  const provider = wallet();
  await assert.rejects(submitMint(provider, { ...network, deployed: false }, account), /not opened/);
  assert.equal(provider.calls.length, 0);
});

test("network switch is checked before any mint transaction", async () => {
  let chain = "0x1";
  const provider = wallet({ eth_chainId: () => chain, wallet_switchEthereumChain: ({ params }) => { chain = params[0].chainId; return null; } });
  await submitMint(provider, network, account);
  assert(provider.calls.findIndex(c => c.method === "wallet_switchEthereumChain") < provider.calls.findIndex(c => c.method === "eth_sendTransaction"));
});

test("unknown network is added using its configured ETH network details, then switched", async () => {
  let chain = "0x1", known = false;
  const provider = wallet({ eth_chainId: () => chain,
    wallet_switchEthereumChain: ({ params }) => { if (!known) throw Object.assign(new Error("Unknown chain"), { code: 4902 }); chain = params[0].chainId; return null; },
    wallet_addEthereumChain: ({ params }) => { assert.equal(params[0].nativeCurrency.symbol, "ETH"); assert.deepEqual(params[0].rpcUrls, [network.rpcUrl]); known = true; return null; } });
  await ensureChain(provider, network);
  assert.equal(chain, network.chainHex);
});

test("cancelled network switch never submits a mint", async () => {
  const provider = wallet({ eth_chainId: () => "0x1", wallet_switchEthereumChain: () => { throw Object.assign(new Error("Rejected"), { code: 4001 }); } });
  await assert.rejects(submitMint(provider, network, account));
  assert(!provider.calls.some(c => c.method === "eth_sendTransaction"));
});

test("wrong deployment identity or missing code blocks minting", async () => {
  const wrongName = wallet({ eth_call: () => abiString("a different collection") });
  await assert.rejects(submitMint(wrongName, network, account), /does not match/);
  const noCode = wallet({ eth_getCode: () => "0x" });
  await assert.rejects(submitMint(noCode, network, account), /not deployed/);
  assert(!wrongName.calls.some(c => c.method === "eth_sendTransaction"));
  assert(!noCode.calls.some(c => c.method === "eth_sendTransaction"));
});

test("account change or unreasonable gas estimate blocks the send", async () => {
  const changed = wallet({ eth_accounts: () => [renderer] });
  await assert.rejects(submitMint(changed, network, account), /wallet changed/);
  const expensive = wallet({ eth_estimateGas: () => "0x1000000" });
  await assert.rejects(submitMint(expensive, network, account), /Unexpected mint gas/);
  assert(!changed.calls.some(c => c.method === "eth_sendTransaction"));
  assert(!expensive.calls.some(c => c.method === "eth_sendTransaction"));
});

test("receipt parsing requires a zero-address ERC721 Transfer to the connected recipient", () => {
  const id = (2n ** 200n + 7n).toString();
  const log = { address: collection, topics: [TRANSFER, "0x" + "0".repeat(64), "0x" + account.slice(2).padStart(64, "0"), "0x" + BigInt(id).toString(16).padStart(64, "0")] };
  assert.equal(mintedToken({ status: "0x1", logs: [log] }, network, account), id);
  assert.equal(mintedToken(null, network, account), null);
  assert.throws(() => mintedToken({ status: "0x0", logs: [] }, network, account), /reverted/);
  assert.throws(() => mintedToken({ status: "0x1", logs: [{ ...log, address: renderer }] }, network, account), /no matching mint/);
  assert.throws(() => mintedToken({ status: "0x1", logs: [log] }, network, renderer), /no matching mint/);
});

test("configuration fails closed for invalid, duplicate or unconfirmed deployment addresses", () => {
  assert.equal(validateConfig({ collectionName: "ghoulballs", defaultChainId: 11155111, networks: [network] }).networks[0].chainId, 11155111);
  const config = networks => ({ collectionName: "ghoulballs", defaultChainId: 11155111, networks });
  assert.throws(() => validateConfig(config([{ ...network, collectionAddress: "0x" + "0".repeat(40) }])));
  assert.throws(() => validateConfig(config([network, network])));
  assert.throws(() => validateConfig(config([{ ...network, deployed: false }])));
  assert.throws(() => validateConfig(config([{ ...network, rpcUrl: "http://unsafe.example" }])));
});

test("wallet cancellation, pending request and insufficient funds get useful messages", () => {
  assert.match(friendlyError({ code: 4001 }), /Cancelled/);
  assert.match(friendlyError({ code: -32002 }), /waiting in your wallet/);
  assert.match(friendlyError(new Error("insufficient funds")), /mint itself is free/);
});
