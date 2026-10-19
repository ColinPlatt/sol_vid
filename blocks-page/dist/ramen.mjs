import {sendTip,tipRecipient,parseTipAmount} from './tip.mjs';
import {rpc,isAddress} from './wallet.mjs';
import {networkOf} from './networks.mjs';

export const MENU=Object.freeze([
 {id:'shoyu',jp:'醤油',name:'Midnight shoyu',description:'Golden broth, springy noodles, soft egg and a little neon naruto.',colour:'#ffb51b',note:'A classic for the last train home.'},
 {id:'miso',jp:'辛味噌',name:'Neon miso',description:'Red miso, chilli oil, sweet corn and a late-night kick.',colour:'#ff6355',note:'A little heat for a rainy night.'},
 {id:'garden',jp:'野菜',name:'Sakura garden',description:'Mushroom broth, tofu, greens and pink pickled ginger. Plant-based.',colour:'#9dffbb',note:'Something green in a city of lights.'}
].map(Object.freeze));

// The meal is a local game. Only the separate, explicit tip action uses a wallet.
export class Diner{
 constructor(){this.phase='menu';this.meal=null;this.bites=0;this.orderNumber=0;}
 order(id){if(this.phase!=='menu')return false;const meal=MENU.find(m=>m.id===id);if(!meal)return false;this.meal=meal;this.bites=0;this.orderNumber++;this.phase='cooking';return true;}
 serve(){if(this.phase!=='cooking')return false;this.phase='served';return true;}
 bite(){if(this.phase!=='served')return false;if(++this.bites===3)this.phase='receipt';return true;}
 finish(){if(this.phase!=='served')return false;this.phase='receipt';return true;}
 again(){if(this.phase!=='receipt')return false;this.phase='menu';this.meal=null;this.bites=0;return true;}
 snapshot(){return {phase:this.phase,meal:this.meal?.id??null,bites:this.bites,orderNumber:this.orderNumber};}
}

export function mountRamen({openPanel,getNetwork,onWallet=()=>{}}){
 const $=id=>document.getElementById(id),diner=new Diner(),dialog=$('ramen-menu');
 let timer,confirmationTimer,checksRemaining=0,busy=false,transfer=null,tipState='idle',receiptNetwork=null,disposed=false,submissionUnknown=false,restored=false;
 const tipButtons=[...dialog.querySelectorAll('[data-tip]')];
 const announce=()=>window.dispatchEvent(new CustomEvent('blocks:ramen-state',{detail:diner.snapshot()}));
 const storageKey=network=>'blocks-ramen-tip-v1:'+network.chainId;
 function remember(value){sessionStorage.setItem(storageKey(receiptNetwork),JSON.stringify({...value,meal:diner.meal.id,orderNumber:diner.orderNumber,amount:$('tip-amount').value}));}
 function forget(){try{sessionStorage.removeItem(storageKey(receiptNetwork));}catch{}}
 function restoreTip(){
  if(restored)return;
  const network=getNetwork();try{tipRecipient(network);}catch{return;}
  restored=true;
  try{
   const saved=JSON.parse(sessionStorage.getItem(storageKey(network)));if(!saved)return;
   parseTipAmount(saved.amount);
   if(!['pending','unknown'].includes(saved.state))return;
   receiptNetwork=Object.freeze({...network});diner.meal=MENU.find(m=>m.id===saved.meal)??MENU[0];diner.phase='receipt';diner.orderNumber=Number.isSafeInteger(saved.orderNumber)?saved.orderNumber:1;
   $('tip-amount').value=saved.amount;
   if(saved.state==='pending'&&/^0x[0-9a-f]{64}$/i.test(saved.hash)&&isAddress(saved.account)){
    transfer={hash:saved.hash,account:saved.account,recipient:tipRecipient(network),wei:parseTipAmount(saved.amount)};tipState='pending';
    $('tip-transaction').href=network.explorerUrl+'/tx/'+transfer.hash;$('tip-transaction').hidden=false;$('tip-status').textContent='Your earlier tip may still be pending. Check its confirmation before sending another.';
   }else{submissionUnknown=true;$('tip-status').textContent='An earlier wallet request has an unknown result. Check your wallet activity before another tip.';}
  }catch{/* Invalid or unavailable browser storage never redirects a transfer. */}
 }
 function tipControls(){
  let ready=false;
  try{const network=getNetwork();tipRecipient(network);parseTipAmount($('tip-amount').value);ready=Boolean(network?.deployed);}catch{}
  $('ramen-tip').disabled=busy||submissionUnknown||Boolean(transfer)||!ready;
  $('tip-amount').disabled=busy||submissionUnknown||Boolean(transfer);
  tipButtons.forEach(b=>{b.disabled=busy||submissionUnknown||Boolean(transfer);b.setAttribute('aria-pressed',String(b.dataset.tip===$('tip-amount').value));});
  $('ramen-again').disabled=busy||submissionUnknown||Boolean(transfer&&tipState!=='confirmed'&&tipState!=='reverted');
  const amount=$('tip-amount').value;
  $('ramen-tip').textContent=busy?(transfer?'Checking confirmation…':'Check your wallet…'):submissionUnknown?'Check your wallet activity':transfer?(tipState==='confirmed'?'Tip received. Thank you!':'Tip sent'):ready?'Tip '+amount+' ETH':'Choose a tip amount';
  $('tip-check').hidden=!transfer||tipState==='confirmed'||tipState==='reverted';
  $('tip-check').disabled=busy;
  $('tip-reset').hidden=!submissionUnknown;$('tip-reset').disabled=busy;
  $('ramen-leave').textContent=busy||transfer||submissionUnknown?'Back to the night ↗':'No tip · back to the night ↗';
 }
 function render(){
  restoreTip();
  dialog.dataset.phase=diner.phase;
  for(const phase of ['menu','cooking','served','receipt'])$(phase==='menu'?'ramen-menu-list':'ramen-'+phase).hidden=phase!==diner.phase;
  if(diner.meal){
   for(const el of dialog.querySelectorAll('[data-meal-name]'))el.textContent=diner.meal.name;
   $('ramen-chef-line').textContent=diner.phase==='cooking'?'The chef is making your '+diner.meal.name.toLowerCase()+'.':diner.meal.note;
   dialog.style.setProperty('--broth',diner.meal.colour);dialog.dataset.meal=diner.meal.id;
   $('ramen-bowl').dataset.bites=String(diner.bites);
   $('ramen-bite').textContent=['Take a bite · いただきます','Another bite','One last slurp'][diner.bites]??'ごちそうさま';
   $('ramen-order-number').textContent=String(diner.orderNumber).padStart(3,'0');
  }
  const network=getNetwork();
  try{
   const recipient=tipRecipient(network),known=networkOf(network);
   $('tip-network').textContent=network.name+(known.testnet?' · test ETH':' · real ETH');
   $('tip-recipient').textContent=recipient;$('tip-recipient').href=network.explorerUrl+'/address/'+recipient;
   $('tip-disclosure').textContent='Optional ETH tip to the collection deployer on '+network.name+'. Network gas is additional. Your wallet asks you to confirm.';
  }catch{
   $('tip-network').textContent='Tipping unavailable';$('tip-recipient').textContent='Network settings unavailable';$('tip-recipient').removeAttribute('href');
   $('tip-disclosure').textContent='You can still enjoy a free bowl. Tipping needs confirmed network settings.';
  }
  tipControls();announce();
 }
 function open(){render();openPanel('ramen-menu');}
 $('ramen-dishes').replaceChildren(...MENU.map(meal=>{
  const button=document.createElement('button');button.type='button';button.className='ramen-dish';button.dataset.dish=meal.id;
  const jp=document.createElement('span'),title=document.createElement('strong'),copy=document.createElement('span'),price=document.createElement('small');
  jp.className='dish-jp';jp.textContent=meal.jp;jp.style.color=meal.colour;title.textContent=meal.name;copy.textContent=meal.description;price.textContent='ON THE HOUSE ↗';
  button.append(jp,title,copy,price);button.onclick=()=>{
   if(!diner.order(meal.id))return;transfer=null;tipState='idle';receiptNetwork=null;$('tip-status').textContent='';$('tip-amount').value='';$('tip-transaction').hidden=true;
   render();clearTimeout(timer);timer=setTimeout(()=>{if(disposed)return;diner.serve();render();},2200);
  };return button;
 }));
 $('ramen-bite').onclick=()=>{diner.bite();render();};
 $('ramen-finish').onclick=()=>{diner.finish();render();};
 $('ramen-again').onclick=()=>{if(busy||submissionUnknown||(transfer&&tipState!=='confirmed'&&tipState!=='reverted'))return;diner.again();render();};
 $('ramen-leave').onclick=()=>dialog.close();
 $('ramen-counter').onclick=()=>dialog.close();
 for(const button of tipButtons)button.onclick=()=>{$('tip-amount').value=button.dataset.tip;tipControls();};
 $('tip-amount').addEventListener('input',tipControls);
 async function checkTip(){
  if(!transfer||busy||disposed||tipState==='confirmed')return;clearTimeout(confirmationTimer);busy=true;tipControls();
  try{
   const receipt=await rpc(receiptNetwork,'eth_getTransactionReceipt',[transfer.hash]);
   if(!receipt){$('tip-status').textContent='Still pending. Check the explorer or check again; no second tip will be sent.';if(checksRemaining-->0)confirmationTimer=setTimeout(checkTip,3000);return;}
   if(receipt.transactionHash?.toLowerCase()!==transfer.hash.toLowerCase()||receipt.to?.toLowerCase()!==transfer.recipient.toLowerCase()||receipt.from?.toLowerCase()!==transfer.account.toLowerCase())throw Error('The receipt did not match this tip. Check the explorer.');
   if(receipt.status==='0x1'){
    tipState='confirmed';forget();$('tip-status').textContent='心からありがとう · Tip confirmed. You made the chef’s night.';
    window.dispatchEvent(new CustomEvent('blocks:ramen-thanks',{detail:{orderNumber:diner.orderNumber}}));
   }else if(receipt.status==='0x0'){
    tipState='reverted';forget();transfer=null;$('tip-status').textContent='The transaction reverted; the tip was not received. You may choose to try again.';
   }else throw Error('No confirmation yet. Check the transaction on the explorer.');
  }catch(error){$('tip-status').textContent=error.message+' The tip may still be pending; use the transaction link before trying again.';}
  finally{busy=false;tipControls();}
 }
 $('tip-check').onclick=checkTip;
 $('tip-reset').onclick=()=>{if(busy)return;forget();submissionUnknown=false;$('tip-status').textContent='Notice cleared. Only retry if your wallet shows no pending or confirmed tip.';tipControls();};
 $('ramen-tip').onclick=async()=>{
  if(busy||submissionUnknown||transfer||diner.phase!=='receipt')return;
  busy=true;tipControls();
  try{
   if(!window.ethereum?.request)throw Error('No wallet found. Your bowl is still on the house.');
   // Keep the exact settings and amount shown on this bill for the whole request.
   receiptNetwork=Object.freeze({...getNetwork()});const amount=$('tip-amount').value;
   transfer=await sendTip(window.ethereum,receiptNetwork,amount,stage=>{if(stage==='sending'){try{remember({state:'unknown'});}catch{throw Error('Browser storage is unavailable. No tip was submitted; your bowl is still free.');}submissionUnknown=true;}$('tip-status').textContent={connect:'Connect your wallet to leave a tip.',checking:'Checking the transfer…',wallet:'Confirm '+amount+' ETH on '+receiptNetwork.name+' in your wallet.',sending:'Confirm '+amount+' ETH on '+receiptNetwork.name+' in your wallet.'}[stage];});
   submissionUnknown=false;
   onWallet(transfer.account);tipState='pending';$('tip-status').textContent='Tip sent. Waiting for confirmation…';
   $('tip-transaction').href=receiptNetwork.explorerUrl+'/tx/'+transfer.hash;$('tip-transaction').hidden=false;
   try{remember({state:'pending',hash:transfer.hash,account:transfer.account});}catch{/* The earlier unknown-result notice remains persisted. */}
   checksRemaining=12;
  }catch(error){
   const cancelled=Number(error?.code)===4001||/user rejected|user denied/i.test(error?.message??'');
   const insufficient=/insufficient funds/i.test(error?.message??'');
   if(cancelled||insufficient){submissionUnknown=false;forget();}
   $('tip-status').textContent=cancelled?'Cancelled in your wallet. No tip sent. Enjoy the rest of your night.':insufficient?'Not enough ETH for the chosen tip and network gas. Your bowl is still free.':submissionUnknown?'The wallet did not return a usable transaction result. Check your wallet activity before sending another tip.':error.message;
  }finally{busy=false;tipControls();}
  if(transfer)await checkTip();
 };
 window.addEventListener('blocks:ramen-request',open);
 window.addEventListener('blocks:panel',event=>{if(event.detail.id==='ramen-menu')render();});
 window.addEventListener('blocks:ramen-ready',announce);
 window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);clearTimeout(confirmationTimer);},{once:true});
 render();return diner;
}
