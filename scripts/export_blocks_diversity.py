#!/usr/bin/env python3
"""Opt-in native 100k audit corpus. Generates transient independent test cases for bounded memory and parallel EVMs."""
import argparse,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--count',type=int,default=100000);p.add_argument('--threads',type=int,default=8);p.add_argument('--forge',default='forge');p.add_argument('--solc');args=p.parse_args()
assert 1<=args.count<=100000
file=ROOT/'test/blockart/GeneratedDiversityAudit.t.sol'
assert not file.exists(),'Another export owns the generated harness'
source='// SPDX-License-Identifier: MIT\npragma solidity ^0.8.30;\nimport {BlocksDiversityAuditBase} from "./BlocksDiversityAudit.t.sol";\ncontract BlocksDiversityExportTest is BlocksDiversityAuditBase {\n'
for batch in range((args.count+191)//192):source+=f'function testAudit{batch:03}() public {{_batch({batch});}}\n'
source+='}\n'
try:
 file.write_text(source)
 env={**os.environ,'BLOCKS_DIVERSITY_EXPORT':'true','BLOCKS_DIVERSITY_COUNT':str(args.count)}
 command=[args.forge,'test','--offline','--match-contract','BlocksDiversityExportTest|BlockVideoV3.*Test','--threads',str(args.threads),'--gas-limit','20000000000','-vv']
 if args.solc:command+=['--use',args.solc]
 subprocess.run(command,cwd=ROOT,env=env,check=True)
finally:file.unlink(missing_ok=True)
