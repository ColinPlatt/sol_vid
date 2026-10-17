#!/usr/bin/env python3
import copy,json,unittest
from pathlib import Path
from sync_video_config import build
ROOT=Path(__file__).resolve().parents[1]
class ReleaseGateTest(unittest.TestCase):
    def setUp(self):
        self.manifest=json.loads((ROOT/'deployments/video-base.json').read_text())
        self.manifest.update(status='prepared_not_deployed',collection=None,renderer=None,transaction_hashes=[],opensea_playback={'status':'not_checked'})
    def test_candidate_evidence_does_not_enable_edition(self):
        self.manifest['candidate']['opensea_playback']={'status':'passed','evidence_url':'https://opensea.io/item/base/0x'+'a'*40+'/1','checked_at_utc':'2026-10-17T00:00:00Z'}
        self.assertFalse(build(self.manifest)['mintEnabled'])
    def test_production_receipts_and_matching_opensea_evidence_required(self):
        self.manifest.update(status='deployed',collection='0x'+'b'*40,renderer='0x'+'c'*40,transaction_hashes=['0x'+'d'*64,'0x'+'e'*64])
        self.assertFalse(build(self.manifest)['mintEnabled'])
        self.manifest['opensea_playback']={'status':'passed','evidence_url':'https://opensea.io/item/base/' + self.manifest['collection']+'/1','checked_at_utc':'2026-10-17T00:00:00Z'}
        self.assertTrue(build(self.manifest)['mintEnabled'])
        for wrong in ['https://example.com/base/'+self.manifest['collection']+'/1','https://opensea.io/item/base/0x'+'a'*40+'/1']:
            bad=copy.deepcopy(self.manifest);bad['opensea_playback']['evidence_url']=wrong
            with self.assertRaises(ValueError):build(bad)
        self.manifest['transaction_hashes']=[]
        with self.assertRaises(ValueError):build(self.manifest)
if __name__=='__main__':unittest.main()
