import {rpc,friendlyError,mintedToken,isAddress} from './wallet.mjs';
import {latestEpoch,loadProof,mintEpoch} from './epoch.mjs';
const $=id=>document.getElementById(id);
const names=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama'];
let network,account,busy=false,reading=false;
function render(){ $('mint').disabled=busy||!network?.mintEnabled||!network?.deployed; $('connect').disabled=busy; $('refresh').disabled=busy; $('epoch').disabled=busy; $('mint').textContent=busy?'Minting…':'Mint epoch'; }
for(const name of names){const card=document.createElement('button');const image=document.createElement('img');image.src=`assets/${name}.gif`;image.loading='lazy';image.alt=`${name} example animation`;const label=document.createElement('span');label.textContent=name.toUpperCase();card.append(image,label);card.onclick=()=>{$('hero').src=image.src;$('hero').alt=image.alt;$('caption').textContent=name.toUpperCase()+' · Example animation';};$('scenes').append(card);}
async function refresh(){if(!network)return;try{$('epoch').value=latestEpoch(await rpc(network,'eth_blockNumber',[])).toString();}catch(error){$('status').textContent=friendlyError(error);}}
async function viewToken(id){
 if(reading)return;
 if(!/^\d+$/.test(String(id))){$('read-status').textContent='Enter a minted epoch number.';return;}
 reading=true;$('view').disabled=true;$('read-status').textContent='Rendering the artwork from Ethereum Sepolia…';
 try{
  const response=await fetch('/api/token?id='+encodeURIComponent(id));
  const token=await response.json();if(!response.ok)throw Error(token.error||'Artwork could not be read.');
  if(!/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/.test(token.image)||!Array.isArray(token.attributes))throw Error('Unexpected artwork response');
  $('hero').src=token.image;$('hero').alt=token.name;$('caption').textContent=token.name+' · Ethereum Sepolia';
  $('download').href=token.image;$('download').download=`blocks-${id}.gif`;$('traits').replaceChildren();
  for(const trait of token.attributes){const pair=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=trait.trait_type;dd.textContent=String(trait.value);pair.append(dt,dd);$('traits').append(pair);}
  $('read-status').textContent='Original onchain GIF loaded.';
 }catch(error){$('read-status').textContent=friendlyError(error);}finally{reading=false;$('view').disabled=false;}
}
$('view').onclick=()=>viewToken($('view-epoch').value);
$('refresh').onclick=refresh;
$('connect').onclick=async()=>{try{if(!window.ethereum)throw Error('Open this page in a wallet-enabled browser');const accounts=await window.ethereum.request({method:'eth_requestAccounts'});if(!isAddress(accounts?.[0]))throw Error('No wallet account selected');account=accounts[0];$('connect').textContent=account.slice(0,6)+'…'+account.slice(-4);}catch(error){$('status').textContent=friendlyError(error);}};
window.ethereum?.on?.('accountsChanged',()=>{account=null;$('connect').textContent='Connect wallet';});
$('mint').onclick=async()=>{
 if(busy)return;
 busy=true;render();$('transaction').hidden=true;
 try{
  if(!account)throw Error('Connect your wallet first');
  if(!/^\d+$/.test($('epoch').value))throw Error('Enter an epoch number');
  const recipient=account,epoch=BigInt($('epoch').value);$('status').textContent='Reading the ten Sepolia block headers…';
  const headers=await loadProof(network,epoch,(method,params)=>rpc(network,method,params));
  $('status').textContent='Checking the epoch and requesting your wallet…';
  const hash=await mintEpoch(window.ethereum,network,recipient,epoch,headers);
  $('transaction').href=network.explorerUrl+'/tx/'+hash;$('transaction').hidden=false;$('status').textContent='Transaction sent; waiting for confirmation…';
  let receipt;
  for(let i=0;i<90;i++){receipt=await rpc(network,'eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  if(!receipt)throw Error('Still pending; check your transaction link before trying again');
  const token=mintedToken(receipt,network,recipient);if(BigInt(token)!==epoch)throw Error('Unexpected minted epoch');
  $('status').textContent=`Epoch ${token} minted. Its block data is stored onchain.`;$('view-epoch').value=token;
  await viewToken(token);
 }catch(error){$('status').textContent=friendlyError(error);}finally{busy=false;render();}
};
try{const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw Error('Settings unavailable');network=await response.json();if(network.chainId!==11155111||network.chainHex!=='0xaa36a7'||!isAddress(network.collectionAddress)||!isAddress(network.rendererAddress))throw Error('Invalid Ethereum Sepolia settings');$('contract').href=network.explorerUrl+'/address/'+network.collectionAddress;render();$('status').textContent='Connect your wallet to mint on Ethereum Sepolia.';if(network.deployed)await refresh();}catch(error){network=null;render();$('status').textContent=friendlyError(error);}
