// Shared EIP-1193 and read helpers for the standalone blocks collection.
export const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);
export const isAddress = value => /^0x[0-9a-f]{40}$/i.test(value ?? "") && !/^0x0{40}$/i.test(value);

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
