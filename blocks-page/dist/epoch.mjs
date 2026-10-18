import { ensureChain, isAddress, decodeString } from './wallet.mjs';
export const HEADER_FIELDS=['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash','nonce','baseFeePerGas','withdrawalsRoot','blobGasUsed','excessBlobGas','parentBeaconBlockRoot','requestsHash','blockAccessListHash','slotNumber'];
const INTS=new Set(['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas','blobGasUsed','excessBlobGas','slotNumber']);
const hex=n=>BigInt(n).toString(16);
const even=s=>s.length%2?'0'+s:s;
const bytes=s=>{if(!/^0x(?:[0-9a-f]{2})*$/i.test(s??''))throw Error('Malformed header bytes');return s.slice(2).toLowerCase();};
const length=(n,offset)=>n<56?hex(offset+n):hex(offset+55+even(hex(n)).length/2)+even(hex(n));
export function encodeHeader(block){
 let body='';let missing=false;
 for(const field of HEADER_FIELDS){
  const optional=HEADER_FIELDS.indexOf(field)>=15;
  if(block[field]===undefined||block[field]===null){if(!optional)throw Error('Missing header field: '+field);missing=true;continue;}
  if(missing)throw Error('Missing field inside header suffix');
  let value=block[field];
  if(INTS.has(field)){if(!/^0x[0-9a-f]+$/i.test(value))throw Error('Malformed header integer');value=BigInt(value)===0n?'0x':'0x'+even(hex(value));}
  const raw=bytes(value),n=raw.length/2;
  body+=(n===1&&parseInt(raw,16)<128?raw:length(n,128)+raw);
 }
 return '0x'+length(body.length/2,192)+body;
}
const word=n=>{const b=BigInt(n);if(b<0n||b>=1n<<256n)throw Error('Integer outside uint256');return b.toString(16).padStart(64,'0');};
export function encodeMint(epoch,headers){
 if(headers.length!==10)throw Error('Ten headers are required');
 let offset=10*32;const data=[];const offsets=[];
 for(const header of headers){const raw=bytes(header);offsets.push(word(offset));const encoded=word(raw.length/2)+raw.padEnd(Math.ceil(raw.length/64)*64,'0');data.push(encoded);offset+=encoded.length/2;}
 return '0xb8ba5b84'+word(epoch)+word(64)+word(10)+offsets.join('')+data.join('');
}
export function latestEpoch(blockNumber){const n=BigInt(blockNumber);if(n<10n)throw Error('No complete epoch');return n/10n-1n;}
export function checkWindow(epoch,blockNumber){const last=BigInt(epoch)*10n+9n,head=BigInt(blockNumber);if(last>=head||head-last>256n)throw Error('This epoch is outside the recent block window');}
export async function loadProof(network,epoch,request){
 checkWindow(epoch,await request('eth_blockNumber',[]));
 const blocks=[];
 for(let i=0;i<10;i++)blocks.push(await request('eth_getBlockByNumber',['0x'+hex(BigInt(epoch)*10n+BigInt(i)),false]));
 for(let i=0;i<10;i++){
  const b=blocks[i];if(!b||BigInt(b.number)!==BigInt(epoch)*10n+BigInt(i))throw Error('Incomplete epoch');
  if(!/^0x[0-9a-f]{64}$/i.test(b.hash??''))throw Error('Malformed block hash');
  if(i&&b.parentHash.toLowerCase()!==blocks[i-1].hash.toLowerCase())throw Error('Block chain changed; refresh the epoch');
 }
 return blocks.map(encodeHeader);
}
export async function mintEpoch(provider,network,account,epoch,headers){
 if(!network.mintEnabled||!network.deployed||!isAddress(network.collectionAddress)||!isAddress(network.rendererAddress))throw Error('Minting is not open');
 if(network.chainId!==11155111||network.chainHex!=='0xaa36a7'||!isAddress(account))throw Error('Invalid Ethereum Sepolia mint settings');
 await ensureChain(provider,network);
 const request=(method,params)=>provider.request({method,params});
 checkWindow(epoch,await request('eth_blockNumber',[]));
 const call=data=>request('eth_call',[{to:network.collectionAddress,data},'latest']);
 const [name,symbol,renderer,code]=await Promise.all([call('0x06fdde03'),call('0x95d89b41'),call('0x8ada6b0f'),request('eth_getCode',[network.collectionAddress,'latest'])]);
 if(decodeString(name)!=='blocks'||decodeString(symbol)!=='blocks'||!/^0x[0-9a-f]{64}$/i.test(renderer)||'0x'+renderer.slice(-40).toLowerCase()!==network.rendererAddress.toLowerCase()||!/^0x[0-9a-f]+$/i.test(code)||/^0x0*$/.test(code))throw Error('Deployment does not match blocks');
 const transaction={from:account,to:network.collectionAddress,data:encodeMint(epoch,headers),value:'0x0',chainId:network.chainHex};
 const estimate=BigInt(await request('eth_estimateGas',[transaction]));
 if(estimate<21000n||estimate>12000000n)throw Error('Unexpected mint estimate');
 transaction.gas='0x'+hex((estimate*120n+99n)/100n);
 const price=BigInt(await request('eth_gasPrice',[]));
 if(price>1000000n)throw Error('Gas prices changed; refresh before minting');
 transaction.maxFeePerGas='0x'+hex(price*4n>1000n?price*4n:1000n);
 transaction.maxPriorityFeePerGas='0x1';
 const [chain,accounts]=await Promise.all([request('eth_chainId',[]),request('eth_accounts',[])]);
 if(BigInt(chain)!==11155111n||accounts?.[0]?.toLowerCase()!==account.toLowerCase())throw Error('Wallet changed; reconnect');
 checkWindow(epoch,await request('eth_blockNumber',[]));
 const hash=await request('eth_sendTransaction',[transaction]);
 if(!/^0x[0-9a-f]{64}$/i.test(hash??''))throw Error('Invalid transaction hash');
 return hash;
}
