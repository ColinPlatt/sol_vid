import { ensureChain, isAddress } from './wallet.mjs';
import { networkOf } from './networks.mjs';

// Confirmed deployment wallets: Base V3/V4 and Ethereum Sepolia V3 manifests.
// Recipients are never taken from query strings, saved state or caller overrides.
const RECIPIENTS = Object.freeze({
  8453: '0xBb789F9508DFBDd31De814E7A13ee1B549703D68',
  11155111: '0xa59523b0eB18415151307b57D5675480A3DEca38'
});
const WEI_PER_ETH = 10n ** 18n;

function validChain(network) {
  const known = networkOf(network);
  if (!known || !Number.isSafeInteger(network.chainId) || !RECIPIENTS[network.chainId]) {
    throw new Error('Invalid single-block network settings.');
  }
  return network.chainId;
}

export function tipRecipient(network) {
  const chainId = validChain(network);
  const recipient = RECIPIENTS[chainId];
  if (!isAddress(recipient)) throw new Error('Invalid tip recipient settings.');
  return recipient;
}

export function parseTipAmount(decimalString) {
  if (typeof decimalString !== 'string' || !/^\d+(?:\.\d{1,18})?$/.test(decimalString)) {
    throw new Error('Enter a positive ETH amount with up to 18 decimal places.');
  }
  const [whole, fraction = ''] = decimalString.split('.');
  const wei = BigInt(whole) * WEI_PER_ETH + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
  if (wei <= 0n) throw new Error('Tip amount must be greater than zero.');
  return wei;
}

export async function sendTip(provider, network, amountString, onStage = () => {}) {
  const chainId = validChain(network);
  const recipient = tipRecipient(network);
  const wei = parseTipAmount(amountString);
  const value = '0x' + wei.toString(16);
  const request = (method, params = []) => provider.request({ method, params });

  onStage('connect');
  const accounts = await request('eth_requestAccounts');
  const account = accounts?.[0];
  if (!isAddress(account)) throw new Error('No wallet account selected.');
  await ensureChain(provider, network);

  const transaction = { from: account, to: recipient, value, chainId: network.chainHex };
  onStage('checking');
  const estimate = BigInt(await request('eth_estimateGas', [transaction]));
  if (estimate < 21000n || estimate > 5000000n) throw new Error('Unexpected tip estimate. No transaction was sent.');

  onStage('wallet');
  const [currentChain, currentAccounts] = await Promise.all([
    request('eth_chainId'), request('eth_accounts')
  ]);
  if (BigInt(currentChain) !== BigInt(network.chainId) ||
      currentAccounts?.[0]?.toLowerCase() !== account.toLowerCase()) {
    throw new Error('Wallet changed. Please try again.');
  }
  onStage('sending');
  const hash = await request('eth_sendTransaction', [transaction]);
  if (!/^0x[0-9a-f]{64}$/i.test(hash ?? '')) throw new Error('Invalid transaction hash.');
  return { hash, account, recipient, wei };
}
