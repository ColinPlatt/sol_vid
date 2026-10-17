#!/usr/bin/env python3
"""Export exact public Standard JSON inputs and reproduce the Base build locally."""
import copy,hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'previews/video/verification';OUT.mkdir(parents=True,exist_ok=True)
solc=os.environ.get('VIDEO_BASE_SOLC','/usr/bin/solc');records=[]
for name in ['AviRleVideo','VideoNFT','VideoCandidate']:
    artifact=json.loads((ROOT/f'out/{name}.sol/{name}.json').read_text())
    metadata=artifact['metadata'];metadata=json.loads(metadata) if isinstance(metadata,str) else metadata
    assert metadata['compiler']['version'].startswith('0.8.30') and metadata['settings']['evmVersion']=='cancun','Build the Base profile first'
    settings=copy.deepcopy(metadata['settings']);settings.pop('compilationTarget')
    settings['outputSelection']={'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}
    sources={}
    for file in metadata['sources']:
        path=(ROOT/file).resolve();assert path.is_relative_to(ROOT) and path.suffix=='.sol'
        sources[file]={'content':path.read_text()}
    standard={'language':'Solidity','sources':sources,'settings':settings}
    encoded=json.dumps(standard,separators=(',',':')).encode()
    result=subprocess.run([solc,'--standard-json'],input=encoded,capture_output=True,check=True)
    compiled=json.loads(result.stdout)
    errors=[e for e in compiled.get('errors',[]) if e['severity']=='error'];assert not errors,errors
    contract=compiled['contracts'][f'src/{name}.sol'][name]
    for key in ['bytecode','deployedBytecode']:
        expected=artifact[key]['object'].removeprefix('0x');actual=contract['evm'][key]['object'];assert actual==expected,f'{name} {key} differs from exact Base build'
    path=OUT/f'{name}.standard.json';path.write_bytes(encoded+b'\n')
    records.append({'contract':f'src/{name}.sol:{name}','compiler':metadata['compiler']['version'],'evm_version':'cancun','standard_json':path.name,'sha256':hashlib.sha256(encoded+b'\n').hexdigest(),'creation_and_runtime_match':True})
(OUT/'manifest.json').write_text(json.dumps(records,indent=2)+'\n');print('PASS exact Base creation/runtime reproduced from exported Standard JSON for renderer, NFT and candidate. No explorer publication performed.')
