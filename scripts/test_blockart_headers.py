#!/usr/bin/env python3
"""Regression tests for canonical Base and Amsterdam/Sepolia header hashing."""
import json
import shutil
import subprocess
import unittest
from pathlib import Path
import blockart_fixtures as fixtures

ROOT = Path(__file__).resolve().parents[1]

class HeaderEncodingTest(unittest.TestCase):
    def test_base_and_amsterdam_header_hashes(self):
        cast = shutil.which('cast')
        self.assertIsNotNone(cast, 'Foundry cast is required')
        for network in ['base', 'sepolia']:
            with self.subTest(network=network):
                block = json.loads((ROOT / f'fixtures/blockart/{network}-header.json').read_text())
                digest = subprocess.check_output([cast, 'keccak', '0x' + fixtures.header(block).hex()], text=True).strip()
                self.assertEqual(digest, block['hash'])
                if network == 'sepolia':
                    self.assertIn('blockAccessListHash', block)
                    self.assertIn('slotNumber', block)

if __name__ == '__main__':
    unittest.main()
