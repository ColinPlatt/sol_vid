import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {HEADER_FIELDS,encodeHeader,encodeMint,latestEpoch,checkWindow,mintEpoch} from '../dist/epoch.mjs';
const source=readFileSync(new URL('../../test/blockart/BaseEpochs.sol',import.meta.url),'utf8');
const vectors=Array.from(source.matchAll(/h\[\d+\]\s*=\s*hex"([0-9a-f]+)"/g),m=>'0x'+m[1]);
function unpack(hex){
 const b=Buffer.from(hex.slice(2),'hex');let p=0;
 function item(){const prefix=b[p++];if(prefix<128)return b.subarray(p-1,p);let length;if(prefix<184)length=prefix-128;else{const n=prefix-183;length=parseInt(b.subarray(p,p+n).toString('hex'),16);p+=n;}const out=b.subarray(p,p+length);p+=length;return out;}
 const n=b[0]-247; p=1+n;
 const fields={};for(const field of HEADER_FIELDS){if(p>=b.length)break;const value=item().toString('hex');fields[field]='0x'+value;}
 for(const name of ['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas','blobGasUsed','excessBlobGas'])if(fields[name]==='0x')fields[name]='0x0';
 return fields;
}
test('rebuild all 20 recorded Base headers byte-for-byte',()=>{assert.equal(vectors.length,20);for(const vector of vectors)assert.equal(encodeHeader(unpack(vector)),vector);});
test('epoch mint calldata matches Foundry ABI encoding',()=>{
 const headers=vectors.slice(0,10);const result=spawnSync(process.env.CAST??'cast',['calldata','mint(uint256,bytes[])','5254696','['+headers.join(',')+']'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(encodeMint(5254696,headers),result.stdout.trim());
});
test('epoch selection and exact blockhash boundaries',()=>{
 assert.equal(latestEpoch(52546969),5254695n);assert.equal(latestEpoch(52546970),5254696n);
 assert.doesNotThrow(()=>checkWindow(5254696,52547225));
 assert.throws(()=>checkWindow(5254696,52547226),/window/);
 assert.throws(()=>checkWindow(5254696,52546969),/window/);
});
const account='0x'+'a'.repeat(40),collection='0x'+'b'.repeat(40),renderer='0x'+'c'.repeat(40);
const network={name:'Ethereum Sepolia',chainId:11155111,chainHex:'0xaa36a7',rpcUrl:'https://mainnet.base.org',explorerUrl:'https://basescan.org',deployed:true,mintEnabled:true,collectionAddress:collection,rendererAddress:renderer};
const abiString=s=>'0x'+(32n).toString(16).padStart(64,'0')+BigInt(s.length).toString(16).padStart(64,'0')+Buffer.from(s).toString('hex').padEnd(64,'0');
function wallet({expired=false,changed=false,reject=false}={}){
 const sent=[];let blockReads=0;
 return{sent,async request({method,params}){
  if(method==='eth_chainId')return '0xaa36a7';
  if(method==='eth_accounts')return [changed?'0x'+'d'.repeat(40):account];
  if(method==='eth_blockNumber')return '0x'+BigInt(expired&&++blockReads>1?52547226:52546970).toString(16);
  if(method==='eth_getCode')return '0x6000';
  if(method==='eth_call')return params[0].data==='0x8ada6b0f'?'0x'+renderer.slice(2).padStart(64,'0'):abiString('blocks');
  if(method==='eth_gasPrice')return '0x13';
  if(method==='eth_estimateGas'){if(reject)throw Error('epoch already minted');return '0x650000';}
  if(method==='eth_sendTransaction'){sent.push(params[0]);return '0x'+'e'.repeat(64);}
  throw Error(method);
 }};
}
test('closed release cannot touch a wallet',async()=>{let calls=0;await assert.rejects(mintEpoch({request(){++calls;}},{...network,mintEnabled:false},account,5254696,vectors.slice(0,10)),/not open/);assert.equal(calls,0);});
test('mocked mint submits authenticated epoch calldata with zero value',async()=>{const provider=wallet();await mintEpoch(provider,network,account,5254696,vectors.slice(0,10));assert.equal(provider.sent.length,1);assert.equal(provider.sent[0].value,'0x0');assert.equal(provider.sent[0].data,encodeMint(5254696,vectors.slice(0,10)));});
test('changed wallet, claimed epoch or expired proof prevents sending',async()=>{for(const option of [{changed:true},{reject:true},{expired:true}]){const provider=wallet(option);await assert.rejects(mintEpoch(provider,network,account,5254696,vectors.slice(0,10)));assert.equal(provider.sent.length,0);}});

test('Amsterdam header encoding hashes to the recorded Sepolia block',()=>{
 const block=JSON.parse(readFileSync(new URL('../../fixtures/blockart/sepolia-header.json',import.meta.url),'utf8'));
 const result=spawnSync(process.env.CAST??'cast',['keccak',encodeHeader(block)],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),block.hash);
});
test('Base settings cannot submit a Sepolia mint',async()=>{const provider=wallet();await assert.rejects(mintEpoch(provider,{...network,chainId:8453,chainHex:'0x2105'},account,5254696,vectors.slice(0,10)),/Sepolia/);assert.equal(provider.sent.length,0);});
test('standalone settings match the confirmed Sepolia deployment',()=>{
 const config=JSON.parse(readFileSync(new URL('../dist/config.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(readFileSync(new URL('../../deployments/blocks-sepolia.json',import.meta.url),'utf8'));
 assert.equal(config.chainId,11155111);assert.equal(config.chainHex,'0xaa36a7');
 assert.equal(config.collectionAddress,manifest.collection);assert.equal(config.rendererAddress,manifest.renderer);
 assert.equal(manifest.runtime_verified,true);assert.equal(manifest.receipts.filter(r=>r.status==='0x1').length,11);
});
test('mint uses bounded testnet fees and rejects a gas-price spike',async()=>{
 const provider=wallet();await mintEpoch(provider,network,account,5254696,vectors.slice(0,10));
 assert.equal(provider.sent[0].chainId,'0xaa36a7');assert.equal(provider.sent[0].maxFeePerGas,'0x3e8');assert.equal(provider.sent[0].maxPriorityFeePerGas,'0x1');
 const spiked=wallet(),original=spiked.request.bind(spiked);spiked.request=req=>req.method==='eth_gasPrice'?'0x10000000':original(req);
 await assert.rejects(mintEpoch(spiked,network,account,5254696,vectors.slice(0,10)),/Gas prices changed/);assert.equal(spiked.sent.length,0);
});
