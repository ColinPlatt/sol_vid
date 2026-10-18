import {rpc,friendlyError,mintedToken,isAddress} from './wallet.mjs';
import {mintBlock} from './mint.mjs';
const $=id=>document.getElementById(id),names=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama'];
let network,busy=false,reading=false;
function render(){ $('mint').disabled=busy||!network?.mintEnabled||!network?.deployed;if(!busy)$('mint').innerHTML=network?.mintEnabled?'Mint a night <span>↗</span>':'Minting opens soon <span>↗</span>'; }
function traits(items){$('traits').replaceChildren();for(const item of items){const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=item.trait_type;dd.textContent=String(item.value);div.append(dt,dd);$('traits').append(div);}}
function selectScene(name){for(const button of $('scenes').children)button.setAttribute('aria-pressed',String(button.dataset.scene===name));}
for(const [i,name] of names.entries()){const button=document.createElement('button');button.type='button';button.dataset.scene=name;button.setAttribute('aria-pressed','false');const number=document.createElement('span'),label=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');label.textContent=name==='nighttrain'?'NIGHT TRAIN':name.toUpperCase();button.append(number,label);button.onclick=()=>{const source=`assets/${name}.gif`;$('hero').src=source;$('hero').alt=name+' example animation';$('art-name').textContent=name==='nighttrain'?'Night train.':name[0].toUpperCase()+name.slice(1)+'.';$('caption').textContent='SCENE STUDY / '+label.textContent;$('art-label').textContent='EXAMPLE ARTWORK';$('edition').textContent='SCENE '+number.textContent+' / 08';$('art-description').textContent='An example from the onchain scene library. Your mint’s block determines its own scene and details.';$('download').href=source;$('download').download=`blocks-${name}-study.gif`;$('read-status').textContent='';traits([]);selectScene(name);};$('scenes').append(button);}
async function viewToken(id,scroll=false){
 if(reading)return;
 if(!/^\d{1,18}$/.test(String(id))){$('read-status').textContent='Enter a minted block number.';return;}
 reading=true;$('view').disabled=true;$('read-status').textContent='Drawing this block’s night from the contract…';
 try{
  const response=await fetch('/api/token?id='+encodeURIComponent(id)),token=await response.json();if(!response.ok)throw Error(token.error||'This block could not be read.');
  if(!/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/.test(token.image)||!Array.isArray(token.attributes))throw Error('Unexpected artwork response.');
  $('hero').src=token.image;$('hero').alt=token.name;$('caption').textContent=token.name+' / ETHEREUM SEPOLIA';$('art-name').textContent=(token.name.split('#')[0].replace(/[^a-zA-Z ]/g,'').trim()||'Your night')+'.';$('art-label').textContent='MINTED BLOCK #'+id;$('edition').textContent='ONE BLOCK / ONE EDITION';$('art-description').textContent='This is the original GIF from the contract, generated from the block your mint landed in.';$('download').href=token.image;$('download').download=`blocks-${id}.gif`;traits(token.attributes);selectScene('');$('read-status').textContent='';if(scroll)$('collection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }catch(error){$('read-status').textContent=friendlyError(error);}finally{reading=false;$('view').disabled=false;}
}
$('lookup').onsubmit=event=>{event.preventDefault();viewToken($('view-block').value);};
$('mint').onclick=async()=>{
 if(busy||!network)return;busy=true;render();$('transaction').hidden=true;
 try{
  if(!window.ethereum)throw Error('Open this page in a wallet-enabled browser to mint.');
  const messages={connect:['Connect wallet…','Approve the connection in your wallet.'],checking:['Checking…','Getting your mint ready on Ethereum Sepolia.'],wallet:['Approve mint…','Confirm the free mint in your wallet. Network gas applies.']};
  const {hash,account}=await mintBlock(window.ethereum,network,stage=>{$('mint').textContent=messages[stage][0];$('status').textContent=messages[stage][1];});
  $('transaction').href=network.explorerUrl+'/tx/'+hash;$('transaction').hidden=false;$('mint').textContent='Finding your night…';$('status').textContent='Mint sent. Waiting for the block to be confirmed…';
  let receipt;for(let i=0;i<90;i++){receipt=await rpc(network,'eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(resolve=>setTimeout(resolve,2000));}
  if(!receipt)throw Error('Still pending. Check the transaction link before minting again.');
  const token=mintedToken(receipt,network,account);if(BigInt(token)!==BigInt(receipt.blockNumber))throw Error('The mint event does not match its block.');
  window.dispatchEvent(new Event('blocks:minted'));$('status').textContent=`Block ${Number(token).toLocaleString()} is yours.`;$('view-block').value=token;await viewToken(token,true);
 }catch(error){$('status').textContent=/AlreadyMinted|0xddefae28/i.test(error?.message??'')?'Someone claimed this block. Try again for the next one.':friendlyError(error);}finally{busy=false;render();}
};
try{const response=await fetch('config.json',{cache:'no-store'});if(!response.ok)throw Error('Settings unavailable.');network=await response.json();if(network.chainId!==11155111||network.artVersion!=='BLOCKS_SINGLE_V1'||!isAddress(network.rendererAddress)||(network.deployed&&!isAddress(network.collectionAddress)))throw Error('Single-block mint settings are not ready.');if(network.deployed)$('contract').href=network.explorerUrl+'/address/'+network.collectionAddress;else $('contract').hidden=true;$('status').textContent=network.mintEnabled?'No inputs. Just the block your mint lands in.':'A new single-block edition. Opening soon.';render();if(network.firstTokenId){$('view-block').value=network.firstTokenId;$('hero').src=`assets/block-${network.firstTokenId}.gif`;$('art-label').textContent='FIRST MINT / BLOCK #'+network.firstTokenId;$('caption').textContent='BLOCK #'+network.firstTokenId+' / ORIGINAL ONCHAIN GIF';$('download').href=$('hero').src;$('download').download=`blocks-${network.firstTokenId}.gif`;if(network.firstScene)$('art-name').textContent=network.firstScene+'.';traits([{trait_type:'Block',value:network.firstTokenId},{trait_type:'Duration',value:'6 seconds'}]);}}catch(error){network=null;render();$('status').textContent=friendlyError(error);}
