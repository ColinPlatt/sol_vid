// Server-side RPC for the configured chain. Files starting with "_" are not deployed as Vercel functions.
// Base's public endpoint grants the full 500M-gas static call (docs/BASE.md); BASE_RPC_URL may override it.
export function serverRpc(settings,env=process.env){
  if(settings.chainId===8453)return env.BASE_RPC_URL||'https://mainnet.base.org';
  if(settings.chainId===11155111)return env.SEPOLIA_RPC_URL||null;
  return null;
}
