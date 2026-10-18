#!/usr/bin/env python3
import copy,unittest
from sync_blocks_config import build
class BlocksReleaseTest(unittest.TestCase):
    def setUp(self):
        self.m={'chain_id':8453,'collection_name':'blocks','collection_symbol':'blocks','status':'development_not_deployed'}
    def test_preparation_never_enables_mint(self):
        self.m.update(mint_enabled=True,marketplace_playback={'status':'passed'})
        self.assertFalse(build(self.m)['mintEnabled'])
    def deployed(self):
        addresses=['0x'+hex(i)[2:].zfill(40) for i in range(1,11)]
        hashes=['0x'+hex(i)[2:].zfill(64) for i in range(1,12)]
        self.m.update(status='deployed',collection=addresses[0],renderer=addresses[1],scenes=dict(enumerate(addresses[2:])),transaction_hashes=hashes,receipts=[{'transactionHash':h,'status':'0x1'} for h in hashes],runtime_verified=True)
    def test_actual_collection_receipts_and_playback_required(self):
        self.deployed();self.assertFalse(build(self.m)['mintEnabled'])
        self.m['marketplace_playback']={'status':'passed','checked_at_utc':'2026-10-18T00:00:00Z','evidence_url':'https://opensea.io/item/base/'+self.m['collection']+'/5254696'}
        self.assertTrue(build(self.m)['mintEnabled'])
        for key,value in [('receipts',[]),('runtime_verified',False)]:
            bad=copy.deepcopy(self.m);bad[key]=value
            with self.assertRaises(ValueError):build(bad)
        self.m['marketplace_playback']['evidence_url']='https://opensea.io/item/base/0x'+'f'*40+'/1'
        with self.assertRaises(ValueError):build(self.m)
if __name__=='__main__':unittest.main()
