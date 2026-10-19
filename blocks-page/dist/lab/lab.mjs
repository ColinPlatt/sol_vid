// The blocks art lab: real onchain renders for simulated blocks, forced scene studies, versions and checks.
import {seed,sceneOf,labInfo,SCENES} from './blockseed.mjs';
const $=id=>document.getElementById(id);
const KEYS=['canyon','descent','monorail','spire','skyline','alley','nighttrain','satoyama'];
const TABS=[
  {id:'nights',jp:'夜',label:'Nights',note:'Twelve consecutive seeds, rendered by the deployed contract. Reroll to see the next twelve.'},
  {id:'scenes',jp:'場面',label:'Scenes',note:'Forced scene study: the first six seeds from here that land in the chosen scene. Not mint probabilities.'},
  {id:'rares',jp:'稀',label:'Rare',note:'Satoyama appears when one byte of the seed hash is below four: about 1 in 64. These are the next six rare seeds.'},
  {id:'versions',jp:'版',label:'Versions',note:'V1 is live (GIF in metadata). V2 and V3 are prepared, undeployed AVI revisions shown by their first-frame posters.'},
  {id:'checks',jp:'試験',label:'Checks',note:'Scene distribution measured from seeds in your browser, capped-call gas per scene, and the V3 100,000-render diversity audit.'},
  {id:'minted',jp:'鋳造済',label:'Minted',note:'Actual tokens from the live collection, read through tokenURI.'}
];
const params=new URLSearchParams(location.search);
const state={tab:TABS.find(t=>t.id===params.get('tab'))?.id??'nights',seed:Math.min(9999999,Math.max(0,Number(params.get('seed'))||1)),scene:Math.min(7,Math.max(0,Number(params.get('scene'))||0))};
let data=null,run=0;
const sceneOfSeed=n=>sceneOf(seed(labInfo(n)));
function sync(){const q=new URLSearchParams({tab:state.tab,seed:state.seed});if(state.tab==='scenes')q.set('scene',state.scene);history.replaceState(null,'','?'+q);}
function el(tag,props={},...children){const e=Object.assign(document.createElement(tag),props);e.append(...children.filter(c=>c!=null));return e;}
function card({src,seedValue,scene,caption,tag,facts,download}){
  const img=el('img',{src,alt:caption,loading:'lazy',decoding:'async'});
  const fig=el('figure',{className:'card'+(scene===7?' rare':'')},el('div',{className:'frame'},img,el('span',{className:'loading'},'描画中 · drawing onchain…')),
    el('figcaption',{},el('b',{},SCENES[scene]??caption),el('span',{},tag??(seedValue!=null?'SEED #'+seedValue.toLocaleString('en-US'):''))));
  img.onload=()=>fig.classList.add('ready');img.onerror=()=>{fig.classList.add('failed');fig.querySelector('.loading').textContent='Render failed — retry';};
  fig.tabIndex=0;fig.setAttribute('role','button');
  const open=()=>detail({src,scene,seedValue,caption,facts,download});fig.onclick=open;fig.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  return fig;
}
function detail({src,scene,seedValue,caption,facts=[],download=true}){
  $('detail-image').src=src;$('detail-image').alt=caption??SCENES[scene];
  $('detail-eyebrow').textContent=seedValue!=null?'SEED #'+seedValue.toLocaleString('en-US')+' · SIMULATED BLOCK 13,000,000':'';
  $('detail-title').textContent=SCENES[scene]??caption;
  $('detail-facts').replaceChildren(...facts.flatMap(([k,v])=>[el('dt',{},k),el('dd',{},String(v))]));
  $('detail-download').hidden=!download;$('detail-download').href=src;$('detail-download').download=`blocks-lab-${seedValue??'render'}.gif`;
  $('detail').showModal();
}
const render=n=>({src:'/api/lab?n='+n,seedValue:n,scene:sceneOfSeed(n),facts:[['Seed (prevrandao)',n],['Scene',SCENES[sceneOfSeed(n)]],['Rare',sceneOfSeed(n)===7?'Yes':'No'],['Renderer','deployed V1, 500M-gas static call']]});
function findSeeds(start,scene,count){const found=[];for(let n=start;found.length<count&&n<start+20000;n++)if(sceneOfSeed(n)===scene)found.push(n);return found;}
function grid(cards){return el('section',{className:'grid'},...cards);}
const studies={
  nights(){$('study-title').textContent='Twelve nights from seed '+state.seed.toLocaleString('en-US');return grid(Array.from({length:12},(_,i)=>card(render(state.seed+i))));},
  scenes(){const seeds=findSeeds(state.seed,state.scene,6);$('study-title').textContent=SCENES[state.scene]+' — '+seeds.length+' seeds';return grid(seeds.map(n=>card(render(n))));},
  rares(){const seeds=findSeeds(state.seed,7,6);$('study-title').textContent='里山 SATOYAMA — rare';return grid(seeds.map(n=>card(render(n))));},
  versions(){
    $('study-title').textContent='Versions by scene';
    const rows=KEYS.map((key,s)=>{
      const first=findSeeds(1,s,1)[0];
      const v2=data?.v2[key],v3=data?.v3[key];
      return el('div',{className:'version-row'},el('h3',{},SCENES[s]),
        card({...render(first),tag:'V1 · LIVE · GIF'}),
        v2?card({src:'assets/v2/'+key+'.svg',scene:s,tag:'V2 · PREPARED · AVI',download:false,facts:[['Version','BLOCKS_VIDEO_V2 (not deployed)'],['Poster','first AVI frame, native SVG'],['Metadata gas',v2.metadata_gas?.toLocaleString('en-US')??'—']]}):null,
        v3?card({src:'assets/v3/'+key+'.svg',scene:s,tag:'V3 · PREPARED · AVI',download:false,facts:[['Version','BLOCKS_VIDEO_V3 (not deployed)'],['Hue / saturation',v3.hue+'° / '+v3.saturation],['Height band · density · layout',[v3.heightBand,v3.density,v3.layout].join(' · ')],['Crop · pan · mirror',[v3.crop,v3.pan,v3.mirror?'yes':'no'].join(' · ')],['Reverse · phase',(v3.reverse?'yes':'no')+' · '+v3.phase],['Metadata gas',v3.metadata_gas?.toLocaleString('en-US')]]}):null);
    });
    return el('section',{className:'versions'},...rows);
  },
  checks(){
    $('study-title').textContent='Checks';
    const out=el('section',{className:'checks'});
    // Scene distribution, computed progressively in the browser.
    const bars=el('div',{className:'bars'}),summary=el('p',{className:'small'}),counts=new Array(8).fill(0),total=20000,token=run;let done=0;
    const expected=s=>s===7?4/256:(1-4/256)/7;
    const draw=()=>{bars.replaceChildren(...counts.map((c,s)=>{const share=done?c/done:0;return el('div',{className:'bar'+(s===7?' rare':'')},el('span',{},SCENES[s]),el('i',{style:`--w:${Math.min(100,share/.2*100)}%`}),el('b',{},(share*100).toFixed(2)+'%'),el('small',{},'expected '+(expected(s)*100).toFixed(2)+'%'));}));summary.textContent=done.toLocaleString('en-US')+' of '+total.toLocaleString('en-US')+' seeds from #'+state.seed.toLocaleString('en-US');};
    const step=()=>{if(token!==run)return;const end=Math.min(total,done+500);for(;done<end;done++)counts[sceneOfSeed(state.seed+done)]++;draw();if(done<total)setTimeout(step,0);};
    out.append(el('h3',{},'Scene distribution'),summary,bars);setTimeout(step,30);
    if(data){
      const table=el('table',{},el('thead',{},el('tr',{},el('th',{},'Scene'),el('th',{},'V1 tokenURI gas'),el('th',{},'V3 metadata gas'),el('th',{},'Under 500M'))),
        el('tbody',{},...KEYS.map((k,s)=>{const a=data.v1[k]?.metadata_gas,b=data.v3[k]?.metadata_gas,max=Math.max(a??0,b??0);return el('tr',{},el('td',{},SCENES[s]),el('td',{},a?.toLocaleString('en-US')??'—'),el('td',{},b?.toLocaleString('en-US')??'—'),el('td',{className:max<5e8?'ok':'bad'},max<5e8?'✓ '+(max/5e6).toFixed(0)+'%':'✗'));})));
      out.append(el('h3',{},'Capped-call gas (canonical previews)'),table);
      const a=data.audit;
      if(a){
        out.append(el('h3',{},'V3 diversity audit · '+a.status),el('div',{className:'stats'},
          ...[['Native renders',a.samples],['Distinct frames',a.distinct_masked_rgb_frames],['Exact duplicates',a.exact_rgb_duplicates],['Same geometry',a.exact_geometry_duplicates],['Near duplicates',a.near_duplicate_pairs],['Satoyama',a.scene_counts?.satoyama]].map(([k,v])=>el('div',{},el('strong',{},Number(v).toLocaleString('en-US')),el('span',{},k)))),
          el('p',{className:'small'},'Withheld from credit: phase, direction, block labels and caption bands; crop, pan and mirror are undone before comparison. Near duplicates need RGB RMSE ≤ 0.035 and luminance SSIM ≥ 0.98.'),
          el('div',{className:'audit-images'},el('figure',{},el('img',{src:'assets/audit/overview.png',alt:'V3 audit overview',loading:'lazy'}),el('figcaption',{},'Overview')),el('figure',{},el('img',{src:'assets/audit/closest-pairs.png',alt:'Closest pairs found by the audit',loading:'lazy'}),el('figcaption',{},'Closest pairs'))));
      }
      if(data.stress.length)out.append(el('h3',{},'V3 stress cases (prepared, first frames)'),grid(data.stress.map(c=>card({src:c.poster,scene:c.scene,tag:'STRESS · '+(c.metadata_gas/1e6).toFixed(0)+'M GAS',download:false,facts:[['Audit index',c.index],['Hue / saturation',c.hue+'° / '+c.saturation],['Height · density · layout',[c.heightBand,c.density,c.layout].join(' · ')],['Crop · pan · mirror',[c.crop,c.pan,c.mirror?'yes':'no'].join(' · ')],['Metadata gas',c.metadata_gas.toLocaleString('en-US')]]}))));
    }
    return out;
  },
  minted(){
    $('study-title').textContent='Minted tokens';const section=grid([]),status=el('p',{className:'small'},'Reading the live collection…');const token=run;
    fetch('/api/world',{cache:'no-store'}).then(r=>r.json()).then(async world=>{
      if(token!==run)return;const ids=(world.tokenIds??[]).filter(id=>/^\d{1,18}$/.test(id));status.textContent=Number(world.totalSupply).toLocaleString('en-US')+' minted · showing '+ids.length+' recent';
      for(const id of ids){
        const response=await fetch('/api/token?id='+id);if(token!==run)return;if(!response.ok)continue;const t=await response.json();
        const scene=SCENES.findIndex(name=>t.name.startsWith(name));
        section.append(card({src:t.image,scene:scene>=0?scene:undefined,caption:t.name,tag:'BLOCK #'+Number(id).toLocaleString('en-US'),facts:t.attributes.map(a=>[a.trait_type,a.value])}));
      }
    }).catch(()=>{status.textContent='The chain feed is unavailable right now.';});
    return el('div',{},status,section);
  }
};
function show(){
  run++;sync();
  for(const b of $('tabs').children)b.setAttribute('aria-pressed',String(b.dataset.tab===state.tab));
  const tab=TABS.find(t=>t.id===state.tab);$('note').textContent=tab.note;
  $('scene-pick').hidden=state.tab!=='scenes';for(const b of $('scene-pick').children)b.setAttribute('aria-pressed',String(Number(b.dataset.scene)===state.scene));
  $('toolbar').dataset.tab=state.tab;$('seed').value=state.seed;
  $('toolbar-note').textContent=state.tab==='versions'||state.tab==='minted'?'':state.tab==='checks'?'Distribution starts at this seed':'Simulated block 13,000,000 · prevrandao = seed';
  $('study').replaceChildren(studies[state.tab]());
}
for(const tab of TABS)$('tabs').append(el('button',{type:'button',onclick:()=>{state.tab=tab.id;show();}},el('b',{},tab.jp),' '+tab.label));
[...$('tabs').children].forEach((b,i)=>{b.dataset.tab=TABS[i].id;});
SCENES.forEach((name,s)=>$('scene-pick').append(el('button',{type:'button',title:name,onclick:()=>{state.scene=s;show();}},name.split(' ')[0])));
[...$('scene-pick').children].forEach((b,i)=>{b.dataset.scene=i;});
$('seed').onchange=()=>{const n=Number($('seed').value);if(Number.isInteger(n)&&n>=0&&n<=9999999){state.seed=n;show();}else $('seed').value=state.seed;};
$('reroll').onclick=()=>{state.seed=state.tab==='nights'?(state.seed+12)%9999988:1+Math.floor(Math.random()*9999000);show();};
$('detail').querySelector('.close').onclick=()=>$('detail').close();$('detail').onclick=e=>{if(e.target===$('detail'))$('detail').close();};
fetch('data.json').then(r=>r.ok?r.json():null).then(d=>{data=d;if(['versions','checks'].includes(state.tab))show();}).catch(()=>{});
show();
