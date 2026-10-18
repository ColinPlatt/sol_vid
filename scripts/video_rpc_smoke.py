#!/usr/bin/env python3
"""Exercise candidate + edition deployment and receipt recorder on disposable Anvil only."""
import datetime,json,os,socket,subprocess,tempfile,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with socket.socket() as socket_:socket_.bind(('127.0.0.1',0));port=socket_.getsockname()[1]
url=f'http://127.0.0.1:{port}'
def rpc(method,params):
    req=urllib.request.Request(url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req,timeout=60))['result']
with tempfile.TemporaryDirectory(prefix='video-rpc-smoke-') as directory:
    work=Path(directory);manifest=work/'local-only-manifest.json';manifest.write_text((ROOT/'deployments/video-base.json').read_text())
    with (work/'anvil.log').open('w') as log:
        node=subprocess.Popen([os.environ.get('ANVIL','anvil'),'--host','127.0.0.1','--port',str(port),'--chain-id','8453','--network','ethereum','--hardfork','cancun','--gas-limit','2000000000','--silent'],stdout=subprocess.DEVNULL,stderr=log)
        try:
            for _ in range(100):
                if node.poll() is not None:raise RuntimeError((work/'anvil.log').read_text())
                try:account=rpc('eth_accounts',[])[0];break
                except OSError:time.sleep(.05)
            else:raise RuntimeError('Local Anvil startup timeout')
            reports=[]
            for kind,entry in [('candidate','DeployVideoCandidateBase'),('edition','DeployVideoBase')]:
                env=os.environ|{'FOUNDRY_PROFILE':'base','FOUNDRY_BROADCAST':str(work/'broadcast')}
                command=[os.environ.get('FORGE','forge'),'script',f'script/DeployVideo.s.sol:{entry}','--rpc-url',url,'--chain','8453','--unlocked','--sender',account,'--broadcast','--slow','--offline']
                result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True);assert result.returncode==0,result.stdout+result.stderr
                result=subprocess.run(['python3','scripts/record_video_deployment.py',kind,'--rpc-url',url,'--broadcast-file',str(work/'broadcast/DeployVideo.s.sol/8453/run-latest.json'),'--manifest',str(manifest),'--output-dir',str(work)],cwd=ROOT,capture_output=True,text=True);assert result.returncode==0,result.stdout+result.stderr
                record=json.loads(result.stdout);assert record['first_token_owner'].lower()==account.lower()
                reports.append({'kind':kind,'receipt_count':len(record['transaction_hashes']),'runtime_checks':record['runtime_checks'],'first_token_uri_bytes':record['first_token_uri_bytes'],'gas_used':record['gas_used']})
                if kind=='candidate':
                    # Simulated evidence only in the throwaway manifest, never a public release record.
                    m=json.loads(manifest.read_text());m['candidate']['opensea_playback']={'status':'passed','evidence_url':f"https://opensea.io/item/base/{record['collection']}/1",'checked_at_utc':'local-smoke-only'};manifest.write_text(json.dumps(m))
            output={'environment':'disposable local Anvil only; not Base receipts or marketplace evidence','checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':reports}
            (ROOT/'previews/video/local-deployment-validation.json').write_text(json.dumps(output,indent=2)+'\n')
            print('PASS local-only candidate + edition broadcasts, first mints, receipt verification, runtime/immutable matching and capped metadata retrieval. Public manifests unchanged.')
        finally:
            node.terminate()
            try:node.wait(timeout=5)
            except subprocess.TimeoutExpired:node.kill();node.wait()
