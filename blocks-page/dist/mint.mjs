import {ensureChain,isAddress,decodeString} from './wallet.mjs';
import {networkOf} from './networks.mjs';
export const ART_VERSION='BLOCKS_VIDEO_V4';
export async function mintBlock(provider,network,onStage=()=>{}){
 if(!network?.deployed||!network.mintEnabled)throw Error('Minting is not open yet.');
 if(!networkOf(network)||network.artVersion!==ART_VERSION||!isAddress(network.collectionAddress)||!isAddress(network.rendererAddress))throw Error('Invalid single-block collection settings.');
 onStage('connect');
 const accounts=await provider.request({method:'eth_requestAccounts'}),account=accounts?.[0];
 if(!isAddress(account))throw Error('No wallet account selected.');
 await ensureChain(provider,network);const request=(method,params=[])=>provider.request({method,params});
 onStage('checking');
 const call=data=>request('eth_call',[{to:network.collectionAddress,data,gas:'0x186a0'},'latest']);
 const [name,symbol,renderer,version,code]=await Promise.all([call('0x06fdde03'),call('0x95d89b41'),call('0x8ada6b0f'),call('0xacaaa87e'),request('eth_getCode',[network.collectionAddress,'latest'])]);
 if(decodeString(name)!=='blocks'||decodeString(symbol)!=='blocks'||decodeString(version)!==ART_VERSION||!/^0x[0-9a-f]{64}$/i.test(renderer)||'0x'+renderer.slice(-40).toLowerCase()!==network.rendererAddress.toLowerCase()||!/^0x[0-9a-f]+$/i.test(code)||/^0x0*$/.test(code))throw Error('The collection does not match its settings.');
 const transaction={from:account,to:network.collectionAddress,data:'0x1249c58b',value:'0x0',chainId:network.chainHex};
 const estimate=BigInt(await request('eth_estimateGas',[transaction]));if(estimate<21000n||estimate>5000000n)throw Error('Unexpected mint estimate. No transaction was sent.');
 // Fees are left to the wallet, which prices them at the network's current rate.
 transaction.gas='0x'+((estimate*120n+99n)/100n).toString(16);
 const [chain,current]=await Promise.all([request('eth_chainId'),request('eth_accounts')]);if(BigInt(chain)!==BigInt(network.chainId)||current?.[0]?.toLowerCase()!==account.toLowerCase())throw Error('Wallet changed. Please try again.');
 onStage('wallet');const hash=await request('eth_sendTransaction',[transaction]);if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Invalid transaction hash.');return {hash,account};
}
// The ticket gate connects a wallet and selects the network without sending anything.
export async function connectWallet(provider,network){
 if(!networkOf(network))throw Error('Invalid single-block collection settings.');
 const accounts=await provider.request({method:'eth_requestAccounts'}),account=accounts?.[0];
 if(!isAddress(account))throw Error('No wallet account selected.');
 await ensureChain(provider,network);return account;
}
