import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTipAmount, sendTip, tipRecipient } from '../dist/tip.mjs';

const account = '0x' + 'a'.repeat(40);
const hash = '0x' + 'e'.repeat(64);
const base = { chainId: 8453, chainHex: '0x2105', name: 'Base' };
const sepolia = { chainId: 11155111, chainHex: '0xaa36a7', name: 'Ethereum Sepolia' };
const baseRecipient = '0xBb789F9508DFBDd31De814E7A13ee1B549703D68';
const sepoliaRecipient = '0xa59523b0eB18415151307b57D5675480A3DEca38';

function wallet({ chain = '0x2105', finalChain = chain, changedAccount = false, reject = false,
  estimate = '0x5208', hashResult = hash, switchFailure = false } = {}) {
  const calls = [];
  const sent = [];
  return {
    calls, sent,
    async request({ method, params = [] }) {
      calls.push({ method, params });
      if (method === 'eth_requestAccounts') return [account];
      if (method === 'eth_accounts') return [changedAccount ? '0x' + 'd'.repeat(40) : account];
      if (method === 'eth_chainId') return calls.filter(call => call.method === method).length > 1 ? finalChain : chain;
      if (method === 'wallet_switchEthereumChain') {
        if (switchFailure) throw new Error('switch rejected');
        return null;
      }
      if (method === 'eth_estimateGas') return estimate;
      if (method === 'eth_sendTransaction') {
        if (reject) { const error = new Error('User rejected'); error.code = 4001; throw error; }
        sent.push(params[0]);
        return hashResult;
      }
      throw new Error(`Unexpected method ${method}`);
    }
  };
}

test('amount parser converts exact decimal ETH to positive wei', () => {
  assert.equal(parseTipAmount('1'), 10n ** 18n);
  assert.equal(parseTipAmount('0.000000000000000001'), 1n);
  assert.equal(parseTipAmount('12.3400'), 12340000000000000000n);
  for (const invalid of ['', '0', '0.0', '-1', '+1', '1e-3', '.5', '1.', '0.0000000000000000001', 'NaN']) {
    assert.throws(() => parseTipAmount(invalid));
  }
});

test('recipient lookup accepts only known, internally consistent chain settings', () => {
  assert.equal(tipRecipient(base), baseRecipient);
  assert.equal(tipRecipient(sepolia), sepoliaRecipient);
  for (const invalid of [{ ...base, chainId: 11155111 }, { ...base, chainId: 1, chainHex: '0x1' }, null]) {
    assert.throws(() => tipRecipient(invalid));
  }
});

test('Base tip sends one native transfer with the fixed recipient, exact value, and chain id', async () => {
  const provider = wallet();
  const stages = [];
  const result = await sendTip(provider, base, '0.025', stage => stages.push(stage));
  assert.deepEqual(result, { hash, account, recipient: baseRecipient, wei: 25000000000000000n });
  assert.deepEqual(stages, ['connect', 'checking', 'wallet', 'sending']);
  assert.equal(provider.sent.length, 1);
  assert.deepEqual(provider.sent[0], { from: account, to: baseRecipient, value: '0x58d15e17628000', chainId: '0x2105' });
  assert.equal(provider.calls.some(call => call.method === 'eth_estimateGas'), true);
  assert.equal(Object.hasOwn(provider.sent[0], 'data'), false);
  assert.equal(Object.hasOwn(provider.sent[0], 'gas'), false);
});

test('Sepolia tip uses its confirmed recipient and chain', async () => {
  const provider = wallet({ chain: '0xaa36a7' });
  const result = await sendTip(provider, sepolia, '0.1');
  assert.equal(result.recipient, sepoliaRecipient);
  assert.equal(provider.sent[0].to, sepoliaRecipient);
  assert.equal(provider.sent[0].chainId, '0xaa36a7');
  assert.equal(provider.sent[0].value, '0x16345785d8a0000');
});

test('bad settings and amount reject before requesting wallet access', async () => {
  const provider = wallet();
  await assert.rejects(sendTip(provider, { ...base, chainHex: '0xaa36a7' }, '0.01'));
  await assert.rejects(sendTip(provider, base, '1e-3'));
  assert.equal(provider.calls.length, 0);
});

test('chain races, account races, estimates, switch failures, and rejection never produce a successful send', async () => {
  const options = [
    { finalChain: '0xaa36a7' },
    { changedAccount: true },
    { estimate: '0x1000' },
    { switchFailure: true, chain: '0xaa36a7' },
    { reject: true }
  ];
  for (const option of options) {
    const provider = wallet(option);
    await assert.rejects(sendTip(provider, base, '0.01'));
    assert.equal(provider.sent.length, 0);
  }
});

test('malformed hash is rejected and a supplied recipient cannot redirect the tip', async () => {
  const provider = wallet({ hashResult: '0x1234' });
  await assert.rejects(sendTip(provider, { ...base, recipient: account }, '0.01'), /hash/);
  assert.equal(provider.sent[0].to, baseRecipient);
});
