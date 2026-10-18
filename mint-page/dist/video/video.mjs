import { validateConfig, submitMint, isAddress } from '../wallet.mjs';
import { decodeBytes, renderRpcs, tokenURICall, RENDER_GAS } from '../gallery.mjs';
export function validateVideoConfig(config) {
  validateConfig(config);
  if (typeof config.mintEnabled !== 'boolean' || typeof config.playbackVerified !== 'boolean' || config.networks.length !== 1 || config.defaultChainId !== 8453) throw Error('Invalid video settings.');
  const network = config.networks[0];
  if (network.tokensPerMint !== 1 || network.mintLimit !== 1 || (config.mintEnabled && (!network.deployed || !config.playbackVerified))) throw Error('Video release has not passed its checks.');
  return config;
}
export function tokenId(value) {
  if (!/^[1-9]\d{0,3}$/.test(String(value)) || BigInt(value) > 6667n) throw Error('Choose a token from 1 to 6667.');
  return String(value);
}
export function parseVideoURI(uri) {
  const prefix = 'data:application/json;base64,';
  if (!uri.startsWith(prefix) || uri.length > 4000000) throw Error('Unsupported video metadata.');
  const metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(uri.slice(prefix.length)), c => c.charCodeAt(0))));
  if (typeof metadata.name !== 'string' || !metadata.image?.startsWith('data:image/svg+xml;base64,') || !metadata.animation_url?.startsWith('data:text/html,')) throw Error('The token has no self-contained video.');
  const attributes = Object.fromEntries((metadata.attributes ?? []).filter(a => typeof a.trait_type === 'string').map(a => [a.trait_type, a.value]));
  if (attributes.Format !== 'AVI BI_RLE8' || attributes.FPS !== 25 || attributes['Duration Seconds'] !== 2 || ![256, 512].includes(attributes.Width) || attributes.Width !== attributes.Height) throw Error('Unexpected video format.');
  const html = decodeURIComponent(metadata.animation_url.slice('data:text/html,'.length));
  const encoded = html.match(/const encoded="([A-Za-z0-9+/]+={0,2})";/)?.[1];
  if (!encoded) throw Error('The original video is missing.');
  const avi = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  if (String.fromCharCode(...avi.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...avi.slice(8, 12)) !== 'AVI ') throw Error('Invalid AVI file.');
  return { name: metadata.name, image: metadata.image, animation: metadata.animation_url, attributes, avi };
}
export async function readVideoCall(network, data, fetcher = fetch) {
  if (!network.deployed || !isAddress(network.collectionAddress)) throw Error('The video collection has not launched.');
  let error;
  for (const url of renderRpcs(network)) {
    try {
      const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: network.collectionAddress, data, gas: RENDER_GAS }, 'latest'] }), signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error('Video read failed (' + response.status + ').');
      const body = await response.json();
      if (body.error || typeof body.result !== 'string') throw Error(body.error?.message ?? 'Missing contract response.');
      return body.result;
    } catch (e) { error = e; }
  }
  throw Error('Unable to read this video. Try again shortly. ' + String(error?.message ?? '').slice(0, 100));
}
export async function loadVideo(network, id, fetcher = fetch) {
  return parseVideoURI(new TextDecoder('utf-8', { fatal: true }).decode(decodeBytes(await readVideoCall(network, tokenURICall(tokenId(id)), fetcher))));
}
export async function submitVideoMint(provider, config, account, onStage) {
  validateVideoConfig(config);
  if (!config.mintEnabled) throw Error('Video minting is awaiting confirmed deployment and OpenSea playback.');
  return submitMint(provider, config.networks[0], account, onStage);
}
