// Small EIP-1193 client. This page only sends mint(), with zero ETH value.
export const MINT = "0x1249c58b";
export const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);
export const isAddress = value => /^0x[0-9a-f]{40}$/i.test(value ?? "") && !/^0x0{40}$/i.test(value);
export const shortAddress = value => `${value.slice(0, 6)}…${value.slice(-4)}`;

export function validateConfig(config) {
  if (config?.collectionName !== "ghoulballs" || !Array.isArray(config.networks)) throw new Error("Mint settings are unavailable.");
  const seen = new Set();
  for (const n of config.networks) {
    if (![11155111, 8453, 84532].includes(n.chainId) || seen.has(n.chainId) || n.chainHex !== "0x" + n.chainId.toString(16)) throw new Error("Invalid network settings.");
    seen.add(n.chainId);
    for (const key of ["rpcUrl", "explorerUrl", ...(n.renderRpcUrl === undefined ? [] : ["renderRpcUrl"])]) if (new URL(n[key]).protocol !== "https:") throw new Error("Network URLs must use HTTPS.");
    if (n.deployed && (!isAddress(n.collectionAddress) || !isAddress(n.rendererAddress))) throw new Error("Invalid collection settings.");
    if (!n.deployed && (n.collectionAddress !== null || n.rendererAddress !== null)) throw new Error("Unconfirmed deployment settings.");
    if (n.collections !== undefined && (!Array.isArray(n.collections) || n.collections.some(c => !isAddress(c?.address)) ||
        (n.deployed ? n.collections.filter(c => c.current).map(c => c.address.toLowerCase()).join() !== n.collectionAddress.toLowerCase() : n.collections.length))) {
      throw new Error("Invalid collection history.");
    }
  }
  if (!seen.has(config.defaultChainId)) throw new Error("Default network is unavailable.");
  return config;
}

export function decodeString(hex) {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(hex ?? "")) throw new Error("Invalid contract response.");
  const raw = hex.slice(2);
  const offset = Number(BigInt("0x" + raw.slice(0, 64))) * 2;
  if (!Number.isSafeInteger(offset) || offset < 64 || offset + 64 > raw.length) throw new Error("Invalid string offset.");
  const length = Number(BigInt("0x" + raw.slice(offset, offset + 64)));
  if (!Number.isSafeInteger(length) || length > 256 || offset + 64 + length * 2 > raw.length) throw new Error("Invalid string length.");
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(raw.slice(offset + 64, offset + 64 + length * 2).match(/../g) ?? [], b => parseInt(b, 16)));
}

export async function rpc(network, method, params, fetcher = fetch) {
  const response = await fetcher(network.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("The network is busy. Try again shortly.");
  const body = await response.json();
  if (body.error || !Object.hasOwn(body, "result")) throw new Error(body.error?.message ?? "The network did not respond.");
  return body.result;
}

export async function ensureChain(provider, network) {
  const current = Number(BigInt(await provider.request({ method: "eth_chainId" })));
  if (current === network.chainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainHex }] });
  } catch (error) {
    if (Number(error.code) !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: network.chainHex,
      chainName: network.name, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [network.rpcUrl], blockExplorerUrls: [network.explorerUrl] }] });
    // Some wallets add a network without switching to it.
    if (Number(BigInt(await provider.request({ method: "eth_chainId" }))) !== network.chainId) {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainHex }] });
    }
  }
  if (Number(BigInt(await provider.request({ method: "eth_chainId" }))) !== network.chainId) throw new Error("Please select " + network.name + " in your wallet.");
}

export async function submitMint(provider, network, account, onStage = () => {}) {
  if (!network.deployed || !isAddress(network.collectionAddress) || !isAddress(network.rendererAddress)) throw new Error("Minting has not opened on this network yet.");
  if (!isAddress(account)) throw new Error("Connect your wallet first.");
  onStage("network");
  await ensureChain(provider, network);
  const request = (method, params) => provider.request({ method, params });
  onStage("checking");
  const code = await request("eth_getCode", [network.collectionAddress, "latest"]);
  if (!/^0x[0-9a-f]+$/i.test(code ?? "") || /^0x0*$/i.test(code)) throw new Error("The collection is not deployed at the configured address.");
  const call = data => request("eth_call", [{ to: network.collectionAddress, data, gas: "0x186a0" }, "latest"]);
  const [name, symbol, renderer, supported] = await Promise.all([
    call("0x06fdde03"), call("0x95d89b41"), call("0x8ada6b0f"), call("0x01ffc9a7" + "80ac58cd".padEnd(64, "0"))
  ]);
  if (decodeString(name) !== "ghoulballs" || decodeString(symbol) !== "ghoulballs" ||
      !/^0x[0-9a-f]{64}$/i.test(renderer ?? "") || "0x" + renderer.slice(-40).toLowerCase() !== network.rendererAddress.toLowerCase() || BigInt(supported) !== 1n) {
    throw new Error("The collection does not match its deployment settings.");
  }
  const transaction = { from: account, to: network.collectionAddress, data: MINT, value: "0x0", chainId: network.chainHex };
  const estimate = BigInt(await request("eth_estimateGas", [transaction]));
  if (estimate < 21000n || estimate > 500000n) throw new Error("Unexpected mint gas estimate. No transaction was sent.");
  transaction.gas = "0x" + ((estimate * 120n + 99n) / 100n).toString(16);
  const [chain, accounts] = await Promise.all([request("eth_chainId"), request("eth_accounts")]);
  if (Number(BigInt(chain)) !== network.chainId || accounts?.[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Your wallet changed. Please try minting again.");
  onStage("wallet");
  const hash = await request("eth_sendTransaction", [transaction]);
  if (!/^0x[0-9a-f]{64}$/i.test(hash ?? "")) throw new Error("Your wallet returned an invalid transaction hash.");
  return hash;
}

export function mintedToken(receipt, network, recipient) {
  if (!receipt) return null;
  if (BigInt(receipt.status ?? "0x0") !== 1n) throw new Error("The transaction reverted. No token was minted.");
  const toTopic = "0x" + recipient.slice(2).toLowerCase().padStart(64, "0");
  const event = receipt.logs?.find(log => log.address?.toLowerCase() === network.collectionAddress.toLowerCase() &&
    log.topics?.length === 4 && log.topics[0].toLowerCase() === TRANSFER && log.topics[1].toLowerCase() === ZERO_TOPIC &&
    log.topics[2].toLowerCase() === toTopic && /^0x[0-9a-f]{64}$/i.test(log.topics[3]));
  if (!event) throw new Error("The transaction has no matching mint event. Check the transaction on the explorer.");
  return BigInt(event.topics[3]).toString();
}

export function friendlyError(error) {
  if (Number(error?.code) === 4001 || /user rejected|user denied/i.test(error?.message ?? "")) return "Cancelled in your wallet. You can try again whenever you like.";
  if (Number(error?.code) === -32002) return "There’s already a request waiting in your wallet. Open it to continue.";
  if (/insufficient funds/i.test(error?.message ?? "")) return "You’ll need a little ETH on this network to cover gas. The mint itself is free.";
  return String(error?.message ?? "Something went wrong. Please try again.").slice(0, 220);
}
