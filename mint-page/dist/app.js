import { validateConfig, shortAddress, rpc, submitMint, mintedToken, friendlyError, isAddress } from "./wallet.mjs";
import { showGallery, tokenImage } from "./gallery.js";
import { hasMintedCall } from "./gallery.mjs";

const $ = id => document.getElementById(id);
const state = { config: null, network: null, provider: null, account: null, chainId: null, busy: false, connecting: false, soldOut: false, minted: false };
const wallets = new Map();
let subscription = null;
let supplyRequest = 0;

function setButton(button, text, arrow = false) {
  button.replaceChildren(document.createTextNode(text));
  if (arrow) { const span = document.createElement("span"); span.textContent = "↗"; span.setAttribute("aria-hidden", "true"); button.append(span); }
}

function status(text, kind = "") {
  $("mint-status").textContent = text;
  $("mint-status").className = "mint-status " + kind;
  $("mint-status").hidden = !text;
}

function render() {
  const { network: n, account, busy, config } = state;
  $("network").disabled = busy || state.connecting || !config;
  $("connect-wallet").disabled = busy || state.connecting;
  setButton($("connect-wallet"), state.connecting ? "…" : account ? shortAddress(account) : "Connect");
  $("connect-wallet").title = account ? "Disconnect wallet" : "Connect wallet";
  $("connect-wallet").setAttribute("aria-label", account ? "Disconnect wallet " + account : "Connect wallet");
  const button = $("mint-button");
  if (!n) { button.disabled = true; setButton(button, "MINT"); return; }
  $("availability-text").textContent = n.deployed ? "FREE" : "NOT LIVE";
  const link = $("contract-link");
  link.hidden = !n.deployed;
  if (n.deployed) link.href = n.explorerUrl + "/address/" + n.collectionAddress;
  button.disabled = busy || state.connecting || !n.deployed || state.soldOut || state.minted;
  setButton(button, busy ? "MINTING…" : state.soldOut ? "SOLD OUT" : state.minted ? "MINTED" : "MINT");
}

// The screen shows the newest token of the current collection, straight from its tokenURI.
let heroRequest = 0;
async function showLatest(n, supply) {
  const request = ++heroRequest;
  if (!n?.deployed || !supply) return;
  try {
    const token = await tokenImage(n, n.collectionAddress, supply);
    if (request === heroRequest && state.network === n) { $("hero-image").src = token.image; $("hero-image").alt = token.name; }
  } catch { /* Keep the placeholder. */ }
}

function rememberWallet(detail) {
  if (detail?.provider && typeof detail.provider.request === "function" && typeof detail.info?.uuid === "string") {
    wallets.set(detail.info.uuid, { provider: detail.provider, name: String(detail.info.name ?? "Browser wallet").slice(0, 80) });
  }
}
window.addEventListener("eip6963:announceProvider", e => rememberWallet(e.detail));
window.dispatchEvent(new Event("eip6963:requestProvider"));

function clearSubscription() {
  if (subscription) {
    subscription.provider.removeListener?.("accountsChanged", subscription.accounts);
    subscription.provider.removeListener?.("chainChanged", subscription.chain);
    subscription.provider.removeListener?.("disconnect", subscription.disconnect);
  }
  subscription = null;
}

async function connect(provider) {
  if (state.connecting || state.busy) return;
  $("wallet-dialog").close();
  state.connecting = true; render();
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!isAddress(accounts?.[0])) throw new Error("Your wallet did not provide an account.");
    const chainId = Number(BigInt(await provider.request({ method: "eth_chainId" })));
    clearSubscription();
    state.provider = provider; state.account = accounts[0]; state.chainId = chainId;
    const accountsChanged = values => { state.account = isAddress(values?.[0]) ? values[0] : null; render(); void checkMinted(); };
    const chainChanged = chain => { try { state.chainId = Number(BigInt(chain)); } catch { state.chainId = null; } render(); };
    const disconnected = () => { state.account = null; render(); };
    provider.on?.("accountsChanged", accountsChanged); provider.on?.("chainChanged", chainChanged); provider.on?.("disconnect", disconnected);
    subscription = { provider, accounts: accountsChanged, chain: chainChanged, disconnect: disconnected };
    status("");
    void checkMinted();
  } catch (error) { status(friendlyError(error), "error"); }
  finally { state.connecting = false; render(); }
}

function chooseWallet() {
  const choices = [...wallets.values()];
  const injected = window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : []);
  for (const provider of injected) {
    if (typeof provider?.request === "function" && !choices.some(c => c.provider === provider)) {
      choices.push({ provider, name: provider.isCoinbaseWallet ? "Coinbase Wallet" : provider.isMetaMask ? "MetaMask" : "Browser wallet" });
    }
  }
  if (choices.length === 1) { void connect(choices[0].provider); return; }
  const list = $("wallet-list"); list.replaceChildren();
  if (!choices.length) {
    const p = document.createElement("p"); p.textContent = "No wallet found."; list.append(p);
  } else {
    for (const choice of choices) { const b = document.createElement("button"); b.type = "button"; b.textContent = choice.name; b.addEventListener("click", () => connect(choice.provider)); list.append(b); }
  }
  $("wallet-dialog").showModal();
}
$("close-wallet-dialog").addEventListener("click", () => $("wallet-dialog").close());
$("wallet-dialog").addEventListener("click", event => { if (event.target === $("wallet-dialog")) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$("connect-wallet").addEventListener("click", () => {
  if (state.busy || state.connecting) return;
  if (!state.account) chooseWallet();
  else { clearSubscription(); state.provider = null; state.account = null; state.chainId = null; state.minted = false; status(""); render(); }
});

// One mint per wallet: show MINTED once the connected wallet has used it.
let mintedRequest = 0;
async function checkMinted() {
  const n = state.network, account = state.account, request = ++mintedRequest;
  state.minted = false; render();
  if (!n?.deployed || !isAddress(account) || n.mintLimit !== 1) return;
  try {
    const result = await rpc(n, "eth_call", [{ to: n.collectionAddress, data: hasMintedCall(account), gas: "0x186a0" }, "latest"]);
    if (request === mintedRequest) { state.minted = BigInt(result) !== 0n; render(); }
  } catch { /* The contract still enforces the limit. */ }
}

async function updateSupply() {
  const n = state.network; const request = ++supplyRequest;
  $("minted-count").textContent = "— / 6,667";
  if (!n?.deployed) return;
  try {
    const result = await rpc(n, "eth_call", [{ to: n.collectionAddress, data: "0x18160ddd", gas: "0x186a0" }, "latest"]);
    if (request === supplyRequest && /^0x[0-9a-f]+$/i.test(result)) {
      // Each mint is a set of tokensPerMint tokens; count sets, and show the newest set's first (GIF) token.
      const per = BigInt(n.tokensPerMint ?? 1), mints = BigInt(result) / per;
      state.soldOut = mints >= 6667n;
      $("minted-count").textContent = `${new Intl.NumberFormat().format(mints)} / 6,667`;
      render();
      if (mints) void showLatest(n, Number((mints - 1n) * per + 1n));
    }
  } catch { /* Supply is optional and never blocks minting. */ }
}

function transactionLink(n, hash) {
  $("transaction-link").href = n.explorerUrl + "/tx/" + hash;
  $("transaction-link").hidden = false;
}

function savePending(value) { try { if (value) sessionStorage.setItem("ghoulballs.pending", JSON.stringify(value)); else sessionStorage.removeItem("ghoulballs.pending"); } catch {} }

async function waitForMint(snapshot) {
  const n = state.config.networks.find(n => n.chainId === snapshot.chainId);
  transactionLink(n, snapshot.hash);
  status("CONFIRMING…");
  for (let attempt = 0; attempt < 120; ++attempt) {
    let receipt;
    try { receipt = await rpc(n, "eth_getTransactionReceipt", [snapshot.hash]); }
    catch { if (attempt === 119) break; await new Promise(resolve => setTimeout(resolve, 5000)); continue; }
    if (receipt) {
      savePending(null);
      const tokenId = mintedToken(receipt, n, snapshot.account);
      status(`MINTED #${Math.ceil(Number(tokenId) / (n.tokensPerMint ?? 1))}`, "success");
      await updateSupply();
      void checkMinted();
      void showGallery(state.network);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error("Your transaction is still pending. Follow it on the explorer; refreshing this page will resume checking.");
}

$("mint-button").addEventListener("click", async () => {
  if (state.busy || state.connecting || state.soldOut || !state.network?.deployed) return;
  if (!state.account) { chooseWallet(); return; }
  const n = state.network, account = state.account, provider = state.provider;
  state.busy = true; $("transaction-link").hidden = true; render();
  const messages = { network: `SWITCH TO ${n.name.toUpperCase()}`, checking: "CHECKING…", wallet: "CONFIRM IN WALLET" };
  try {
    const hash = await submitMint(provider, n, account, stage => status(messages[stage]));
    const snapshot = { hash, chainId: n.chainId, collection: n.collectionAddress, account };
    savePending(snapshot);
    await waitForMint(snapshot);
  } catch (error) { status(friendlyError(error), "error"); }
  finally { state.busy = false; render(); }
});

$("network").addEventListener("change", () => {
  if (state.busy) return;
  state.network = state.config.networks.find(n => n.chainId === Number($("network").value));
  state.soldOut = false;
  status(""); $("transaction-link").hidden = true; $("hero-image").src = "assets/seed-42.gif"; render(); void updateSupply(); void checkMinted(); void showGallery(state.network);
});

async function init() {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Mint settings are unavailable. Please try again later.");
    state.config = validateConfig(await response.json());
    state.network = state.config.networks.find(n => n.chainId === state.config.defaultChainId);
    $("network").replaceChildren(...state.config.networks.map(n => { const option = document.createElement("option"); option.value = String(n.chainId); option.textContent = n.name; return option; }));
    $("network").value = String(state.network.chainId); render(); void updateSupply(); void showGallery(state.network);
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem("ghoulballs.pending") ?? "null"); } catch {}
    if (pending) {
      const n = state.config.networks.find(n => n.chainId === pending.chainId);
      if (n?.deployed && n.collectionAddress.toLowerCase() === pending.collection?.toLowerCase() && isAddress(pending.account) && /^0x[0-9a-f]{64}$/i.test(pending.hash)) {
        state.network = n; $("network").value = String(n.chainId); state.busy = true; render();
        try { await waitForMint(pending); } catch (error) { status(friendlyError(error), "error"); }
        finally { state.busy = false; render(); }
      } else savePending(null);
    }
  } catch (error) { $("availability-text").textContent = "UNAVAILABLE"; status(friendlyError(error), "error"); render(); }
}
void init();
