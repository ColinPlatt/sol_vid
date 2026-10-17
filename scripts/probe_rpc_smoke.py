#!/usr/bin/env python3
"""Deploy to disposable local Anvil and audit 500M/50M reads; never connects to a public chain."""
import json,os,socket,subprocess,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
url=f'http://127.0.0.1:{port}'
errors=Path('/tmp/probe-anvil-errors.log').open('w')
node=subprocess.Popen([os.environ.get('ANVIL','anvil'),'--host','127.0.0.1','--port',str(port),'--network','ethereum','--chain-id','8453','--hardfork','cancun','--gas-limit','1000000000','--silent'],stdout=subprocess.DEVNULL,stderr=errors)
def rpc(method,params):
 data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode()
 return json.load(urllib.request.urlopen(urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'})))['result']
try:
 for n in range(100):
  try:
   if node.poll() is not None:raise RuntimeError('Anvil exited')
   accounts=rpc('eth_accounts',[])
   assert accounts[0].lower()=='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
   break
  except Exception:time.sleep(.05)
 else:raise RuntimeError('Local Anvil not ready: '+Path('/tmp/probe-anvil-errors.log').read_text())
 env=os.environ|{'FOUNDRY_PROFILE':'base','PROBE_DEPLOYER_ADDRESS':accounts[0],'PROBE_HOSTED_HTML_URL':'https://ghoulballs.vercel.app/probe/player.html'}
 command=[os.environ.get('FORGE','forge'),'script','script/DeployMarketplaceProbe.s.sol:DeployMarketplaceProbeBase','--rpc-url',url,'--chain','8453','--unlocked','--sender',accounts[0],'--broadcast','--slow','--offline']
 result=subprocess.run(command,cwd=root,env=env,text=True,capture_output=True)
 (Path('/tmp/probe-local-deployment.log')).write_text(result.stdout+result.stderr)
 if result.returncode:raise RuntimeError(result.stdout+result.stderr)
 broadcast=json.loads((root/'broadcast/DeployMarketplaceProbe.s.sol/8453/run-latest.json').read_text())
 address=broadcast['transactions'][0]['contractAddress']
 for gas,label in [(500000000,'500m'),(50000000,'50m')]:
  output=root/f'previews/probe/local-rpc-{label}.json'
  subprocess.run(['python3','scripts/probe_rpc.py','--address',address,'--chain-id','8453','--rpc-url',url,'--gas',str(gas),'--output',str(output)],cwd=root,check=True)
  report={'environment':'local Anvil only, not Base or a marketplace'}|json.loads(output.read_text());output.write_text(json.dumps(report,indent=2)+'\n')
  success=[r['token_id'] for r in report['results'] if r['status']=='retrieved']
  assert success==(list(range(1,16)) if gas==500000000 else [1,2,3]+list(range(8,16))),success
 print('PASS local RPC audit: all 15 cases at 500M; only ladder cases 4-7 fail at 50M. No public-network transactions.')
finally:
 node.terminate()
 try:node.wait(timeout=5)
 except subprocess.TimeoutExpired:node.kill()
