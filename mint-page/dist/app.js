import { validateConfig, shortAddress, rpc, submitMint, mintedToken, friendlyError, isAddress } from "./wallet.mjs";

const $ = id => document.getElementById(id);
const state = { config: null, network: null, provider: null, account: null, chainId: null, busy: false, connecting: false, soldOut: false };
const wallets = new Map();
let subscription = null;
let supplyRequest = 0;
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const examples = [{ seed: 42, count: 2, motion: "Ricochet" }, { seed: 2, count: 1, motion: "Orbit" }, { seed: 6, count: 6, motion: "Figure Eight" }, { seed: 2026, count: 4, motion: "Float" }, { seed: 4, count: 6, motion: "Orbit" }, { seed: 99, count: 1, motion: "Float" }];
let example = 0;

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
  setButton($("connect-wallet"), state.connecting ? "Connecting…" : account ? shortAddress(account) : "Connect wallet", !account && !state.connecting);
  $("connect-wallet").title = account ? "Disconnect wallet" : "Connect wallet";
  $("connect-wallet").setAttribute("aria-label", account ? "Disconnect wallet " + account : "Connect wallet");
  const button = $("mint-button");
  if (!n) { button.disabled = true; setButton(button, "Mint unavailable", true); return; }
  $("availability-text").textContent = n.deployed ? `Minting is open on ${n.name}.` : `${n.name} mint opens after deployment.`;
  $("availability").classList.toggle("open", n.deployed);
  document.querySelector(".gas-note").textContent = n.testnet ? "Free to mint. Testnet ETH covers gas." : "Free to mint. Network gas applies.";
  const link = $("contract-link");
  link.href = n.deployed ? n.explorerUrl + "/address/" + n.collectionAddress : "https://github.com/ColinPlatt/sol_vid";
  link.textContent = n.deployed ? "View contract ↗" : "View source ↗";
  button.disabled = busy || state.connecting || !n.deployed || state.soldOut;
  if (busy) setButton(button, "Mint in progress…");
  else if (state.soldOut) setButton(button, "Sold out");
  else if (!n.deployed) setButton(button, "Mint opens soon", true);
  else if (!account) setButton(button, "Connect to mint", true);
  else setButton(button, state.chainId === n.chainId ? "Mint a ghoulball" : "Switch & mint", true);
}

function drawExample() {
  const selected = examples[example];
  $("hero-image").src = `assets/seed-${selected.seed}.${motion.matches ? "png" : "gif"}`;
  $("hero-image").alt = `${selected.count} shaded neon ${selected.count === 1 ? "ball" : "balls"} in a vaporwave sunset, ${selected.motion} motion, example seed ${selected.seed}`;
  $("seed-label").textContent = `Seed ${selected.seed} · ${selected.count} ${selected.count === 1 ? "ball" : "balls"} · ${selected.motion}`;
  for (const img of document.querySelectorAll("img[data-motion]")) img.src = motion.matches ? img.dataset.motion.replace(/\.gif$/, ".png") : img.dataset.motion;
}
motion.addEventListener("change", drawExample);
$("shuffle").addEventListener("click", () => {
  const random = new Uint32Array(1); crypto.getRandomValues(random);
  example = (example + 1 + random[0] % (examples.length - 1)) % examples.length;
  drawExample();
});
drawExample();

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
    const accountsChanged = values => { state.account = isAddress(values?.[0]) ? values[0] : null; render(); };
    const chainChanged = chain => { try { state.chainId = Number(BigInt(chain)); } catch { state.chainId = null; } render(); };
    const disconnected = () => { state.account = null; render(); };
    provider.on?.("accountsChanged", accountsChanged); provider.on?.("chainChanged", chainChanged); provider.on?.("disconnect", disconnected);
    subscription = { provider, accounts: accountsChanged, chain: chainChanged, disconnect: disconnected };
    status("");
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
    const p = document.createElement("p"); p.textContent = "No wallet was detected. Open this page in a browser with an Ethereum wallet, then try again."; list.append(p);
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
  else { clearSubscription(); state.provider = null; state.account = null; state.chainId = null; status(""); render(); }
});

async function updateSupply() {
  const n = state.network; const request = ++supplyRequest;
  $("minted-count").textContent = "6,667 editions. No per-wallet limit.";
  if (!n?.deployed) return;
  try {
    const result = await rpc(n, "eth_call", [{ to: n.collectionAddress, data: "0x18160ddd", gas: "0x186a0" }, "latest"]);
    if (request === supplyRequest && /^0x[0-9a-f]+$/i.test(result)) {
      state.soldOut = BigInt(result) >= 6667n;
      $("minted-count").textContent = `${new Intl.NumberFormat().format(BigInt(result))} / 6,667 minted.`;
      render();
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
  status("Your mint is on its way. Waiting for the network…");
  for (let attempt = 0; attempt < 120; ++attempt) {
    let receipt;
    try { receipt = await rpc(n, "eth_getTransactionReceipt", [snapshot.hash]); }
    catch { if (attempt === 119) break; await new Promise(resolve => setTimeout(resolve, 5000)); continue; }
    if (receipt) {
      savePending(null);
      const tokenId = mintedToken(receipt, n, snapshot.account);
      status(`Hello, ghoulball #${tokenId}. It’s in your wallet.`, "success");
      await updateSupply();
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
  const messages = { network: `Select ${n.name} in your wallet if asked.`, checking: "Getting your free mint ready…", wallet: "Confirm the mint in your wallet. Only network gas is charged." };
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
  status(""); $("transaction-link").hidden = true; render(); void updateSupply();
});

async function init() {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Mint settings are unavailable. Please try again later.");
    state.config = validateConfig(await response.json());
    state.network = state.config.networks.find(n => n.chainId === state.config.defaultChainId);
    $("network").replaceChildren(...state.config.networks.map(n => { const option = document.createElement("option"); option.value = String(n.chainId); option.textContent = n.name; return option; }));
    $("network").value = String(state.network.chainId); render(); void updateSupply();
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
  } catch (error) { $("availability-text").textContent = "Mint settings are temporarily unavailable."; status(friendlyError(error), "error"); render(); }
}
void init();
