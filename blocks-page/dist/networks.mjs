// Networks the blocks collection is deployed on. config.json picks one; everything user-facing reads from here.
export const NETWORKS={
  8453:{chainHex:'0x2105',name:'Base',label:'BASE',testnet:false,gas:'Free mint · a little ETH on Base for gas'},
  11155111:{chainHex:'0xaa36a7',name:'Ethereum Sepolia',label:'SEPOLIA',testnet:true,gas:'Free mint · Sepolia test ETH for gas'}
};
/** The known network for these settings, or null when the chain ID and hex disagree or are unsupported. */
export function networkOf(settings){
  const known=NETWORKS[settings?.chainId];
  return known&&settings.chainHex===known.chainHex?known:null;
}
