import { friendlyError, shortAddress, rpc, mintedToken } from '../wallet.mjs';
import { validateVideoConfig, loadVideo, readVideoCall, submitVideoMint, tokenId } from './video.mjs';
const $ = id => document.getElementById(id);
let config, network, account, busy = false, downloadURL, viewing = 0, nextGallery = null;
const provider = window.ethereum;
const status = (id, text) => { $(id).textContent = text; };
const controls = () => { $('connect').disabled = busy || !config?.mintEnabled; $('mint').disabled = busy || !account || !config?.mintEnabled; };
async function view(id) {
  const request = ++viewing;
  status('view-status', 'Rendering your onchain video…');
  try {
    const video = await loadVideo(network, tokenId(id));
    if (request !== viewing) return;
    const iframe = document.createElement('iframe');
    iframe.title = video.name; iframe.setAttribute('sandbox', 'allow-scripts'); iframe.src = video.animation;
    $('screen').replaceChildren(iframe);
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(new Blob([video.avi], { type: 'video/x-msvideo' }));
    $('download').href = downloadURL; $('download').download = 'ghoulballs-' + id + '.avi'; $('download').hidden = false;
    $('traits').replaceChildren();
    for (const [key, value] of Object.entries(video.attributes)) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = key; dd.textContent = String(value); $('traits').append(dt, dd);
    }
    status('view-status', video.name + ' · onchain player loaded');
    const url = new URL(location.href); url.searchParams.set('id', id); history.replaceState(null, '', url);
  } catch (e) { if (request === viewing) status('view-status', friendlyError(e)); }
}
$('token-form').addEventListener('submit', e => { e.preventDefault(); view($('token-id').value); });
$('connect').onclick = async () => {
  try {
    if (!provider) throw Error('Open this page in a wallet browser or install an Ethereum wallet.');
    [account] = await provider.request({ method: 'eth_requestAccounts' });
    $('connect').textContent = account ? shortAddress(account) : 'Connect wallet'; controls();
  } catch (e) { status('mint-status', friendlyError(e)); }
};
provider?.on?.('accountsChanged', () => { account = null; $('connect').textContent = 'Connect wallet'; controls(); });
provider?.on?.('chainChanged', () => { account = null; $('connect').textContent = 'Connect wallet'; controls(); });
$('mint').onclick = async () => {
  busy = true; controls(); const recipient = account;
  try {
    const hash = await submitVideoMint(provider, config, recipient, stage => status('mint-status', stage === 'wallet' ? 'Confirm the free mint in your wallet.' : 'Checking the collection and wallet…'));
    status('mint-status', 'Transaction sent. Waiting for confirmation…');
    const link = document.createElement('a'); link.href = network.explorerUrl + '/tx/' + hash; link.textContent = 'View transaction ↗'; link.target = '_blank'; link.rel = 'noopener'; $('mint-status').append(' ', link);
    let receipt;
    for (let i = 0; i < 60; ++i) {
      receipt = await rpc(network, 'eth_getTransactionReceipt', [hash]);
      if (receipt) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!receipt) throw Error('Confirmation is taking longer than usual. Check your transaction on the explorer before retrying.');
    const id = mintedToken(receipt, network, recipient);
    status('mint-status', 'Minted ghoulballs #' + id + '.'); $('token-id').value = id; await view(id);
  } catch (e) { status('mint-status', friendlyError(e)); }
  finally { busy = false; controls(); }
};
async function gallery(reset = false) {
  $('refresh').disabled = true; $('more').disabled = true;
  try {
    if (reset || nextGallery === null) {
      const supply = BigInt(await readVideoCall(network, '0x18160ddd'));
      if (supply > 6667n) throw Error('Unexpected video supply.');
      nextGallery = Number(supply); $('gallery').replaceChildren();
      if (!nextGallery) status('view-status', 'No videos have been minted yet.');
    }
    const end = Math.max(0, nextGallery - 8);
    while (nextGallery > end) {
      const id = String(nextGallery);
      const video = await loadVideo(network, id);
      const button = document.createElement('button'), image = document.createElement('img'), name = document.createElement('span');
      button.type = 'button'; button.className = 'tile'; image.src = video.image; image.alt = video.name; image.loading = 'lazy'; name.textContent = video.name;
      button.append(image, name); button.onclick = () => { $('token-id').value = id; view(id); }; $('gallery').append(button); --nextGallery;
    }
  } catch (e) { status('view-status', friendlyError(e)); }
  finally { $('refresh').disabled = !network?.deployed; $('more').disabled = false; $('more').hidden = !nextGallery; }
}
$('refresh').onclick = () => gallery(true); $('more').onclick = () => gallery();
try {
  const response = await fetch('/video-config.json', { cache: 'no-store' }); if (!response.ok) throw Error('Video settings are unavailable.');
  config = validateVideoConfig(await response.json()); network = config.networks[0];
  status('release', config.mintEnabled ? 'Video mint is open on Base.' : 'Video mint is not open yet. Onchain rendering and marketplace playback are being validated.');
  $('view').disabled = $('refresh').disabled = !network.deployed; controls();
  const id = new URL(location.href).searchParams.get('id') ?? (network.deployed ? '1' : null);
  if (id && network.deployed) { $('token-id').value = tokenId(id); await view(id); }
} catch (e) { status('release', friendlyError(e)); }
window.addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); });
