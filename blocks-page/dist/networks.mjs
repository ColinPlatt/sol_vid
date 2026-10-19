// Networks the blocks collection is deployed on. config.json picks one; everything user-facing reads from here.
// maxGasPrice is a sanity cap in wei (the mint refuses above it); tip is the priority fee in wei.
export const NETWORKS={
  8453:{chainHex:'0x2105',name:'Base',label:'BASE',testnet:false,gas:'Free mint · a little ETH on Base for gas',maxGasPrice:2000000000n,tip:1000000n},
  11155111:{chainHex:'0xaa36a7',name:'Ethereum Sepolia',label:'SEPOLIA',testnet:true,gas:'Free mint · Sepolia test ETH for gas',maxGasPrice:1000000n,tip:1n}
};
/** The known network for these settings, or null when the chain ID and hex disagree or are unsupported. */
export function networkOf(settings){
  const known=NETWORKS[settings?.chainId];
  return known&&settings.chainHex===known.chainHex?known:null;
}
