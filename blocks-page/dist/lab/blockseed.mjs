// Exact JavaScript port of SingleBlockData.seed/artwork and Epoch.scene (BLOCKS_SINGLE_V1).
// Used by the lab to choose scenes locally and to ask the deployed renderer for real onchain renders.
const RC=[1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,
  0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,
  0x8000000000008080n,0x80000001n,0x8000000080008008n];
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const M=(1n<<64n)-1n,rotl=(x,n)=>n?((x<<BigInt(n))|(x>>BigInt(64-n)))&M:x;
function permute(s){
  for(let round=0;round<24;round++){
    const c=[0,1,2,3,4].map(x=>s[x]^s[x+5]^s[x+10]^s[x+15]^s[x+20]);
    for(let x=0;x<5;x++){const d=c[(x+4)%5]^rotl(c[(x+1)%5],1);for(let y=0;y<25;y+=5)s[x+y]^=d;}
    const b=new Array(25);
    for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rotl(s[x+5*y],ROT[x+5*y]);
    for(let x=0;x<5;x++)for(let y=0;y<5;y++)s[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y]&M)&b[(x+2)%5+5*y]);
    s[0]^=RC[round];
  }
}
export function keccak256(bytes){
  const rate=136,padded=new Uint8Array(Math.ceil((bytes.length+1)/rate)*rate);padded.set(bytes);padded[bytes.length]^=1;padded[padded.length-1]^=0x80;
  const s=new Array(25).fill(0n);
  for(let o=0;o<padded.length;o+=rate){
    for(let i=0;i<rate/8;i++){let v=0n;for(let k=7;k>=0;k--)v=(v<<8n)|BigInt(padded[o+i*8+k]);s[i]^=v;}
    permute(s);
  }
  const out=new Uint8Array(32);for(let i=0;i<4;i++){let v=s[i];for(let k=0;k<8;k++){out[i*8+k]=Number(v&0xffn);v>>=8n;}}
  return out;
}
const word=v=>{const out=new Uint8Array(32);let x=BigInt(v);for(let i=31;i>=0;i--){out[i]=Number(x&0xffn);x>>=8n;}return out;};
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const utf8=s=>new TextEncoder().encode(s);
// abi.encode of a dynamic string as the only dynamic member, with head offset given.
const tail=s=>{const b=utf8(s);return concat(word(b.length),b,new Uint8Array((32-b.length%32)%32));};
const toBig=b=>BigInt('0x'+[...b].map(x=>x.toString(16).padStart(2,'0')).join(''));

/** keccak256(abi.encode(version, info)): BLOCKS_SINGLE_V1 (live V1) or BLOCKS_VIDEO_V3 (VideoRecipeV3.seed). */
export function seed(info,version='BLOCKS_SINGLE_V1'){
  return keccak256(concat(word(32*8),infoWords(info),tail(version)));
}
/** The static SingleBlockData.Info tuple, as seven ABI words. */
export const infoWords=info=>concat(...[info.number,info.timestamp,info.gasLimit,info.baseFee,info.prevrandao,BigInt(info.beneficiary),info.chainId].map(word));
const encode2=(a,s)=>concat(a,word(64),tail(s));                     // abi.encode(bytes32, string)
const encode3=(a,s,j)=>concat(a,word(96),word(j),tail(s));           // abi.encode(bytes32, string, uint256)
/** The 3,520-byte, ten-record input the scene renderer reads. */
export function artwork(info){
  const entropy=seed(info),data=new Uint8Array(3520);
  for(let i=0;i<10;i++){
    const channel=i===9?entropy:keccak256(concat(entropy,word(i)));
    const intensity=toBig(keccak256(encode2(channel,'intensity')))%3001n;
    const meta=(BigInt.asUintN(64,BigInt(info.number))<<192n)|(intensity<<128n)|(10000n<<64n)|BigInt.asUintN(64,BigInt(info.timestamp));
    const dst=i*352;data.set(word(meta),dst);data.set(channel,dst+32);data.set(keccak256(encode2(channel,'tint')),dst+64);
    for(let j=0;j<8;j++)data.set(keccak256(encode3(channel,'lights',j)),dst+96+j*32);
  }
  return data;
}
/** Epoch.scene: rare Satoyama when byte 5 of the final hash is below four, otherwise its first four bytes mod 7. */
export function sceneOf(epochOrSeed){
  const h=epochOrSeed.length===3520?epochOrSeed.subarray(9*352+32,9*352+64):epochOrSeed;
  if(h[4]<4)return 7;
  return ((h[0]<<24>>>0)+(h[1]<<16)+(h[2]<<8)+h[3])%7;
}
/** VideoRecipeV3.recipe: the visible V3 channels exposed by recipeOf. */
export function recipeV3(info){
  const h=toBig(keccak256(encode2(seed(info,'BLOCKS_VIDEO_V3'),'composition'))),at=(shift,mod)=>Number((h>>BigInt(shift))%BigInt(mod));
  return {hue:at(0,360),saturation:65+at(16,31),heightBand:at(24,8),density:at(32,4),layout:at(40,4),crop:at(48,4),pan:at(56,9),mirror:at(64,2)===1,reverse:at(72,2)===1,phase:at(80,90)};
}
export const selector=signature=>hex(keccak256(utf8(signature)).subarray(0,4));
export const SCENES=['峡谷 CANYON','地下 DESCENT','高架 MONORAIL','摩天楼 SPIRE','夜景 SKYLINE','路地 ALLEY','夜行 NIGHT TRAIN','里山 SATOYAMA'];
// The lab's simulated Base block: fixed fields, with prevrandao as the study seed (as in the V3 diversity audit).
export const LAB_BLOCK={number:13000000n,timestamp:1792335288n,gasLimit:60000000n,baseFee:15n,beneficiary:'0x0000000000000000000000000000000000000000',chainId:8453n};
export const labInfo=n=>({...LAB_BLOCK,prevrandao:BigInt(n)});
export const hex=b=>'0x'+[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
