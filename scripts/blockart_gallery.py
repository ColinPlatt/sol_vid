#!/usr/bin/env python3
"""Build a local gallery of exact Solidity GIFs and downloads; does not publish anything."""
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[1]
names=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama']
head='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neo-Tokyo · Solidity previews</title><style>
*{box-sizing:border-box}body{margin:0;background:#080819;color:#eee;font:16px system-ui,sans-serif}header,main,footer{max-width:1200px;margin:auto;padding:24px}h1{letter-spacing:.12em}p{color:#aeb0cc;line-height:1.5}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}article{background:#14132b;border:1px solid #353052;padding:12px}img{width:100%;aspect-ratio:1;image-rendering:pixelated}a{color:#5de2ff;margin-right:12px}h2{font-size:15px;letter-spacing:.12em}small{color:#e59ad2}
</style><header><small>DEVELOPMENT · NO PUBLIC MINT</small><h1>blocks</h1><p>Ten verified Base blocks. Eight scenes. Six-second loops.<br>128px artwork rendered entirely in Solidity; these GIF and AVI files are the original contract return bytes.</p></header><main>'''
cards=[]
for name in names:
 cards.append(f'<article><img loading="lazy" src="{name}.gif" alt="{escape(name.upper())} animation"><h2>{escape(name.upper())}</h2><a download href="{name}.gif">GIF</a><a download href="{name}.avi">AVI</a></article>')
html=head+'\n'.join(cards)+'</main><footer><p>Local test epoch 5254696 · 90 frames · GIF delays 7/7/6cs · AVI 15fps<br>Collection name and symbol: blocks. Canvas concepts and Solidity translations differ. Nothing on this page mints or sends a transaction.</p></footer></html>'
out=ROOT/'previews/ARCHIVE/blockart';out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html)
print('Built previews/ARCHIVE/blockart/index.html')
