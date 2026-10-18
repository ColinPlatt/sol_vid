import {rpc,friendlyError,mintedToken} from '../wallet.mjs';
import {latestEpoch,loadProof,mintEpoch} from './epoch.mjs';
const $=id=>document.getElementById(id);
const names=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama'];
let network,account,busy=false;
function render(){ $('mint').disabled=busy||!network?.mintEnabled||!network?.deployed; $('connect').disabled=busy; $('refresh').disabled=busy; $('epoch').disabled=busy; $('mint').textContent=busy?'Minting…':network?.mintEnabled?'Mint epoch':'Not open yet'; }
for(const name of names){const card=document.createElement('button');const image=document.createElement('img');image.src=`assets/${name}.gif`;image.loading='lazy';image.alt=`${name} animation`;const label=document.createElement('span');label.textContent=name.toUpperCase();card.append(image,label);card.onclick=()=>{$('hero').src=image.src;$('hero').alt=image.alt;};$('scenes').append(card);}
async function refresh(){if(!network)return;try{$('epoch').value=latestEpoch(await rpc(network,'eth_blockNumber',[])).toString();}catch(error){$('status').textContent=friendlyError(error);}}
$('refresh').onclick=refresh;
$('connect').onclick=async()=>{try{if(!window.ethereum)throw Error('Open this page in a wallet-enabled browser');const accounts=await window.ethereum.request({method:'eth_requestAccounts'});account=accounts[0];$('connect').textContent=account.slice(0,6)+'…'+account.slice(-4);}catch(error){$('status').textContent=friendlyError(error);}};
window.ethereum?.on?.('accountsChanged',()=>{account=null;$('connect').textContent='Connect wallet';});
$('mint').onclick=async()=>{
 if(busy)return;
 busy=true;render();$('transaction').hidden=true;
 try{
  if(!account)throw Error('Connect your wallet first');
  if(!/^\d+$/.test($('epoch').value))throw Error('Enter an epoch number');
  const recipient=account;const epoch=BigInt($('epoch').value);$('status').textContent='Reading the ten block headers…';
  const headers=await loadProof(network,epoch,(method,params)=>rpc(network,method,params));
  $('status').textContent='Checking the epoch and requesting your wallet…';
  const hash=await mintEpoch(window.ethereum,network,recipient,epoch,headers);
  $('transaction').href=network.explorerUrl+'/tx/'+hash;$('transaction').hidden=false;$('status').textContent='Transaction sent; waiting for confirmation…';
  let receipt;
  for(let i=0;i<90;i++){receipt=await rpc(network,'eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  if(!receipt)throw Error('Still pending; check your transaction link before trying again');
  const token=mintedToken(receipt,network,recipient);if(BigInt(token)!==epoch)throw Error('Unexpected minted epoch');
  $('status').textContent=`Epoch ${token} minted. Its block data is now stored onchain.`;
 }catch(error){$('status').textContent=friendlyError(error);}finally{busy=false;render();}
};
try{const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw Error('Settings unavailable');network=await response.json();if(network.chainId!==8453)throw Error('Invalid Base settings');$('availability').textContent=network.mintEnabled?'FREE · ONE PER EPOCH':'IN DEVELOPMENT';render();if(network.deployed)await refresh();}catch(error){network=null;render();$('status').textContent=friendlyError(error);}
