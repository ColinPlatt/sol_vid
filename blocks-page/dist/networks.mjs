// Networks the blocks collection is deployed on. config.json picks one; everything user-facing reads from here.
export const NETWORKS={
  8453:{chainHex:'0x2105',name:'Base',label:'BASE',testnet:false,marketplace:'base',gas:'Free mint · a little ETH on Base for gas'},
  11155111:{chainHex:'0xaa36a7',name:'Ethereum Sepolia',label:'SEPOLIA',testnet:true,gas:'Free mint · Sepolia test ETH for gas'}
};
/** OpenSea and onchainchecker pages for the configured collection; null on chains they do not list (testnets). */
export function marketLinks(settings){
  const slug=networkOf(settings)?.marketplace,c=settings?.collectionAddress;
  if(!slug||!/^0x[0-9a-f]{40}$/i.test(c??''))return null;
  return {
    opensea:settings.openseaSlug?'https://opensea.io/collection/'+settings.openseaSlug:'https://opensea.io/item/'+slug+'/'+c+'/'+settings.firstTokenId,
    checker:'https://onchainchecker.xyz/collection/'+slug+'/'+c,
    openseaItem:id=>'https://opensea.io/item/'+slug+'/'+c+'/'+id,
    checkerItem:id=>'https://onchainchecker.xyz/collection/'+slug+'/'+c+'/'+id
  };
}
/** The known network for these settings, or null when the chain ID and hex disagree or are unsupported. */
export function networkOf(settings){
  const known=NETWORKS[settings?.chainId];
  return known&&settings.chainHex===known.chainHex?known:null;
}
