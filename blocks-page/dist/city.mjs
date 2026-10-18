import * as THREE from './vendor/three.module.min.js';
import {demos,watchWorld} from './world.mjs';

const canvas = document.querySelector('#city');
const stage = document.querySelector('#city-stage');
const motion = document.querySelector('#motion');
const enter = document.querySelector('#explore');
const exit = document.querySelector('#leave-street');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const resources = new Set();
const keep = resource => (resources.add(resource), resource);
let renderer, paused = reduced.matches, disposed = false, visible = true, exploring = false;
let savedScroll = 0, lastPreference = reduced.matches;
function label() {
  document.body.dataset.walkPaused=String(paused);
  motion.textContent = paused ? 'Resume walk ▷' : 'Pause walk Ⅱ';
  motion.setAttribute('aria-pressed', String(paused));
}
function explore(active, focus = true) {
  if (active === exploring) return;
  if (active) savedScroll = scrollY;
  exploring = active;
  document.body.classList.toggle('exploring', active);
  enter.setAttribute('aria-pressed', String(active));
  exit.hidden = !active;
  for (const element of document.querySelectorAll('.topbar,.ticker,.collection,.about,footer')) element.inert = active;
  document.querySelector('.hero-copy').inert = active;
  if (!active) window.scrollTo(0, savedScroll);
  if (focus) (active ? exit : enter).focus({preventScroll: true});
}
enter.onclick = () => explore(true);
exit.onclick = () => explore(false);
const escape = event => { if (event.key === 'Escape') explore(false); };
document.addEventListener('keydown', escape);
label();
let showChain=()=>{},showToken=()=>{},lastChainLabels;
const hud=document.querySelector('.chain-hud');
const stopWorld=watchWorld({
  onState(state,labels){
    document.querySelector('#chain-head').textContent=labels.head;
    document.querySelector('#chain-fee').textContent=labels.fee;
    document.querySelector('#chain-supply').textContent=labels.minted;
    hud.title='Latest block: '+new Date(state.timestamp*1000).toLocaleTimeString()+' · '+state.transactions+' transactions · '+Math.round(Number(state.gasUsed)/Number(state.gasLimit)*100)+'% gas used';
    lastChainLabels=labels;showChain(labels);
  },
  onStatus(status){hud.dataset.status=status;showChain(lastChainLabels,status);document.querySelector('#chain-status').textContent='SEPOLIA / '+({live:'LIVE',stale:'DELAYED',offline:'FEED OFFLINE'}[status]);},
  onToken(token){showToken(token);}
});
window.addEventListener('pagehide',stopWorld,{once:true});

try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090719);
  scene.fog = new THREE.FogExp2(0x191131, .014);
  const camera = new THREE.PerspectiveCamera(64, 1, .12, 240);
  const reflected = camera.clone();
  const look = new THREE.Vector3();
  scene.add(new THREE.HemisphereLight(0x9daeff, 0x38103d, 1.3));
  const moonlight = new THREE.DirectionalLight(0x8eacff, 1.4);
  moonlight.position.set(-14, 40, 20); scene.add(moonlight);
  for (const [x,z,colour] of [[-4,0,0x00eaff],[4,-7,0xff168e],[-3,-21,0x9038ff],[4,-37,0xffb000]]) {
    const light = new THREE.PointLight(colour, 100, 30, 2); light.position.set(x,3,z); scene.add(light);
  }
  const box = keep(new THREE.BoxGeometry(1,1,1));
  const solid = keep(new THREE.MeshStandardMaterial({roughness:.48, metalness:.3}));
  const glass = keep(new THREE.MeshStandardMaterial({roughness:.2, metalness:.75}));
  const emissive = keep(new THREE.MeshBasicMaterial({toneMapped:false}));
  const leafGeometry = keep(new THREE.IcosahedronGeometry(1,1));
  const leafMaterial = keep(new THREE.MeshStandardMaterial({color:0x284c46,roughness:.9}));
  let seed = 47019;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dummy = new THREE.Object3D();
  function batch(group, geometry, material, items) {
    if (!items.length) return;
    const mesh = keep(new THREE.InstancedMesh(geometry,material,items.length));
    items.forEach((item,i) => {
      dummy.position.set(item.x,item.y,item.z); dummy.scale.set(item.w,item.h,item.d);
      dummy.rotation.set(item.rx||0,item.ry||0,item.rz||0); dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix); mesh.setColorAt(i,new THREE.Color(item.colour));
    });
    group.add(mesh); return mesh;
  }
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const g = glowCanvas.getContext('2d'), glowGradient = g.createRadialGradient(32,32,0,32,32,32);
  glowGradient.addColorStop(0,'rgba(255,255,255,.55)'); glowGradient.addColorStop(.15,'rgba(255,255,255,.1)'); glowGradient.addColorStop(1,'transparent');
  g.fillStyle=glowGradient; g.fillRect(0,0,64,64);
  const glowMap = keep(new THREE.CanvasTexture(glowCanvas));
  const glowMaterials = new Map();
  function halo(group,x,y,z,size,colour='#00eaff') {
    if(typeof colour==='boolean')colour=colour?'#ff168e':'#00eaff';
    if(!glowMaterials.has(colour))glowMaterials.set(colour,keep(new THREE.SpriteMaterial({map:glowMap,color:colour,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.85})));
    const sprite=new THREE.Sprite(glowMaterials.get(colour));sprite.position.set(x,y,z);sprite.scale.set(size,size,1);group.add(sprite);
  }
  const signGeometry = keep(new THREE.PlaneGeometry(1,1));
  const signMaterials = new Map();
  function signMaterial(text,colour,vertical) {
    const key=text+colour+vertical;
    if(signMaterials.has(key))return signMaterials.get(key);
    const c=document.createElement('canvas'); c.width=vertical?128:512;c.height=vertical?512:128;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#0d0920';ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle=colour;ctx.lineWidth=5;ctx.shadowColor=colour;ctx.shadowBlur=18;
    ctx.strokeRect(7,7,c.width-14,c.height-14);
    ctx.fillStyle=colour;ctx.textAlign='center';ctx.textBaseline='middle';
    if(vertical){ctx.font='800 72px sans-serif';[...text].slice(0,4).forEach((letter,i)=>ctx.fillText(letter,64,77+i*115));}
    else{ctx.font='800 48px sans-serif';ctx.fillText(text,256,53,475);ctx.shadowBlur=5;ctx.font='13px monospace';ctx.fillText('電脳街  /  OPEN ALL NIGHT',256,101);}
    ctx.shadowBlur=0;ctx.globalAlpha=.12;ctx.fillStyle=colour;
    for(let y=0;y<c.height;y+=4)ctx.fillRect(0,y,c.width,1);
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;
    const material=keep(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));signMaterials.set(key,material);return material;
  }
  function sign(group,x,y,z,text,colour,w,h,rotation=0,vertical=false) {
    const mesh=new THREE.Mesh(signGeometry,signMaterial(text,colour,vertical));mesh.position.set(x,y,z);mesh.scale.set(w,h,1);mesh.rotation.y=rotation;group.add(mesh);
  }
  // A small shared texture pool keeps animated artwork native to the street's billboards.
  const gallery=[],mintedArt=[],artSources=new Map();let artStamp=-1;
  function artwork(source){
    if(artSources.has(source))return artSources.get(source);
    const image=new Image(),c=document.createElement('canvas');c.width=c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle='#100b26';ctx.fillRect(0,0,128,128);
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const entry={image,ctx,texture,decoder:null,decoding:false,frame:-1,removed:false};artSources.set(source,entry);
    // WebCodecs exposes actual GIF frames; browsers without it keep the native first-frame poster.
    if('ImageDecoder' in window)fetch(source).then(response=>response.arrayBuffer()).then(async data=>{
      if(disposed||entry.removed)return;
      const decoder=new ImageDecoder({data,type:'image/gif',preferAnimation:true});
      try{await decoder.completed;if(disposed||entry.removed){decoder.close();return;}entry.decoder=decoder;}
      catch{decoder.close();}
    }).catch(()=>{});
    image.onload=()=>{if(disposed)return;ctx.drawImage(image,0,0,128,128);texture.needsUpdate=true;if(paused)render(true);};image.src=source;
    return entry;
  }
  function galleryLabels(){
    gallery.forEach((board,i)=>{
      const token=i<mintedArt.length?mintedArt[i]:(mintedArt.length&&i%3===0?mintedArt[Math.floor(i/3)%mintedArt.length]:null);
      const source=token?token.image:'assets/'+demos[i%demos.length]+'.gif';
      board.picture.material.map=artwork(source).texture;board.picture.material.needsUpdate=true;
      const ctx=board.ctx;ctx.clearRect(0,0,512,96);ctx.fillStyle='#080c21';ctx.fillRect(0,0,512,96);
      ctx.textAlign='center';ctx.fillStyle=token?'#66ffce':'#ff75d0';ctx.font='bold 23px monospace';
      ctx.fillText(token?'MINTED / #'+token.tokenId:'DEMO / '+demos[i%demos.length].toUpperCase(),256,39);
      ctx.font='15px monospace';ctx.fillStyle='#b1d0e1';ctx.fillText(token?'BLOCKS · ONCHAIN ORIGINAL':'SCENE STUDY · NOT MINTED',256,71);board.texture.needsUpdate=true;
    });
    const used=new Set(gallery.map(board=>board.picture.material.map));
    for(const [source,entry] of artSources)if(!used.has(entry.texture)){entry.removed=true;entry.decoder?.close();entry.image.onload=null;entry.image.src='';entry.texture.dispose();resources.delete(entry.texture);artSources.delete(source);}
  }
  showToken=token=>{
    if(disposed)return;
    const i=mintedArt.findIndex(item=>item.tokenId===token.tokenId);if(i>=0)mintedArt.splice(i,1);
    mintedArt.unshift(token);mintedArt.length=Math.min(mintedArt.length,8);galleryLabels();if(paused)render(true);
  };
  const telemetryCanvas=document.createElement('canvas');telemetryCanvas.width=1024;telemetryCanvas.height=256;
  const telemetry=telemetryCanvas.getContext('2d'),telemetryTexture=keep(new THREE.CanvasTexture(telemetryCanvas));telemetryTexture.colorSpace=THREE.SRGBColorSpace;
  const telemetryMaterial=keep(new THREE.MeshBasicMaterial({map:telemetryTexture,toneMapped:false,side:THREE.DoubleSide}));
  function paintChain(labels,status='connecting'){
    telemetry.fillStyle='#080c21';telemetry.fillRect(0,0,1024,256);telemetry.strokeStyle='#00edff';telemetry.lineWidth=7;telemetry.strokeRect(5,5,1014,246);
    telemetry.textAlign='center';telemetry.fillStyle='#ff45bd';telemetry.font='bold 34px monospace';telemetry.fillText('SEPOLIA / '+({live:'LIVE CHAIN',offline:'FEED OFFLINE',stale:'DELAYED FEED',connecting:'CHAIN FEED'}[status]),512,65);
    telemetry.fillStyle='#72faff';telemetry.font='bold 62px monospace';telemetry.fillText(labels?.head??'CONNECTING',512,145);
    telemetry.fillStyle='#b8e2f0';telemetry.font='25px monospace';telemetry.fillText(labels?labels.fee+'  /  '+labels.minted:'WAITING FOR LIVE CHAIN DATA',512,211);telemetryTexture.needsUpdate=true;
  }
  paintChain();showChain=(labels,status)=>{paintChain(labels,status);if(paused)render(true);};
  const DEPTH=28, COUNT=8, LENGTH=DEPTH*COUNT, tiles=[], trains=[], drones=[];
  const shopNames=['電脳東京','深夜喫茶','NEON CLUB','未来都市','BLOCKS','ゲーム','不夜城','深夜食堂'];
  const neon=['#00edff','#ff20ad','#b04bff','#ffb51b','#72ff78'];
  // Shared procedural advert screens add motion without external media or extra render passes.
  const adMaterial=keep(new THREE.ShaderMaterial({
    uniforms:{time:{value:0}},side:THREE.DoubleSide,toneMapped:false,
    vertexShader:`varying vec2 uvAd;void main(){uvAd=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uvAd;uniform float time;void main(){vec2 p=(uvAd-.5)*vec2(1.,1.25);float r=length(p);float rings=pow(.5+.5*cos(r*65.-time*1.4),14.);float eye=1.-smoothstep(.09,.105,length(p*vec2(.8,1.8)));float slits=step(.92,fract(uvAd.y*70.));vec3 c=mix(vec3(.03,.01,.12),vec3(.95,.06,.65),rings*.7);c+=vec3(.05,.8,.95)*eye;c+=vec3(.04,.06,.1)*slits;float edge=step(.025,uvAd.x)*step(uvAd.x,.975)*step(.02,uvAd.y)*step(uvAd.y,.98);gl_FragColor=vec4(mix(vec3(.05,.9,1.),c,edge),1.);}`
  }));
  const ringGeometry=keep(new THREE.TorusGeometry(.65,.018,5,40));
  for(let tile=0;tile<COUNT;tile++) {
    const group=new THREE.Group();scene.add(group);tiles.push(group);
    const opaque=[], glazed=[], lit=[], leaves=[];
    const part=(list,x,y,z,w,h,d,colour,ry=0,rz=0)=>list.push({x,y,z,w,h,d,colour,ry,rz});
    for(const side of [-1,1]) {
      const kind=(tile+(side>0?2:0))%4, height=24+random()*25, width=7+random()*3;
      const centre=side*(5.7+width/2), z=-12, depth=19;
      // Dark megastructure frames make the saturated storefronts and neon readable.
      part(glazed,centre,height/2,z,width,height,depth,kind===1?0x243a49:0x192d40);
      part(opaque,side*5.7,height/2,z,.16,height,depth,0x30344e);
      for(let floor=4;floor<height;floor+=2.7) {
        part(opaque,centre,floor,z,width+.22,.13,depth+.18,kind===2?0x444264:0x30364e);
        for(let bay=-8;bay<=8;bay+=2.1) {
          const on=random()>.32;
          part(lit,side*5.59,floor+1,z+bay,.025,.8,1.6,on?(random()>.25?0x28709e:0xff7e8c):0x243b50);
          part(opaque,side*5.5,floor+1.2,z+bay,.15,2.5,.06,0x5a7482);
        }
      }
      for(let rib=-9;rib<=9;rib+=kind===0?1.2:3.1) {
        part(opaque,side*5.42,height/2,z+rib,kind===0?.32:.1,height,.16,kind===0?0x454363:0x303b5c);
      }
      part(opaque,centre,height+.15,z,width+.5,.3,depth+.5,0x82939c);
      // Recessed double-height lobby and luminous shop windows face the pavement.
      part(opaque,side*5.15,2.1,z,.3,4.2,depth,0x223745);
      for(let bay=0;bay<4;bay++) {
        const zz=z-7+bay*4.5;
        part(lit,side*4.96,1.9,zz,.03,2.65,3.7,bay%2?0x057f98:0x9d185c);
        part(opaque,side*4.9,1.9,zz+1.85,.12,3,.1,0x101e28);
        // Shelves/light bars add readable interior depth instead of flat neon rectangles.
        for(let shelf=0;shelf<3;shelf++)part(lit,side*4.89,1+shelf*.65,zz,.035,.035,3.3,0xffb74e);
        part(opaque,side*4.82,.85,zz,.12,.08,2.4,0x23313a);
        for(const leg of [-.8,.8])part(opaque,side*4.82,.45,zz+leg,.08,.8,.08,0x23313a);
        for(let book=0;book<5;book++)part(opaque,side*4.79,1.05,zz-.8+book*.38,.15,.3+random()*.1,.16,book%2?0x596a67:0x303f47);
      }
      part(opaque,side*4.5,3.65,z,3,.18,24,0x78909b);
      part(lit,side*3.25,3.55,z,.035,.025,24,side<0?0x00eaff:0xff20ad);
      for(let zz=-23;zz<1;zz+=5.6)part(opaque,side*3.3,1.7,zz,.12,3.4,.12,0x748b96);
      // Raised sidewalks, a narrow curb and a tactile yellow guide strip.
      part(opaque,side*4,.05,-12,4,.1,28,0x455363);
      part(lit,side*2.45,.115,-12,.045,.015,28,0x09c0d8);
      part(opaque,side*3.05,.111,-12,.18,.012,28,0x8a815c);
      if(kind===1){
        part(opaque,side*5.5,7.8,-10,5.4,.4,8,0x8c9ba4);
        part(opaque,side*3.15,5.65,-6,.25,4.1,.25,0x90a7ac);
      }
      const accent=neon[(tile+(side>0?1:0))%neon.length];
      const second=neon[(tile+(side>0?3:2))%neon.length];
      sign(group,side*4.8,3.05,-12,shopNames[(tile+(side>0?3:0))%8],accent,6,1.2,side<0?Math.PI/2:-Math.PI/2);
      // Projecting blade signs face the walker, stacked at different depths and heights.
      for(let level=0;level<3;level++) {
        const zz=-3-level*7, yy=5.6+level*3.6, colour=level%2?second:accent;
        part(opaque,side*4.8,yy,zz,1.7,.12,.13,0x24233c);
        sign(group,side*(3.75+level*.3),yy,zz,shopNames[(tile+level+(side>0?2:0))%8],colour,1.05,4.1,0,true);
        halo(group,side*3.7,yy,zz+.15,5,colour);
      }
      // Broad luminous billboards interrupt the towers above the intimate shopfronts.
      sign(group,side*5.32,13.5,-10,side<0?'CYBER / 24':'夢を見る',second,8.5,2.2,side<0?Math.PI/2:-Math.PI/2);
      sign(group,side*5.4,21,-17,shopNames[(tile+4)%8],accent,5.5,2.3,0);
      for(let strip=0;strip<3;strip++)part(lit,side*5.28,10+strip*6,-20,.06,4.7,.12,new THREE.Color(accent).getHex());
      halo(group,side*4.7,2.1,-10,7,accent);
      // Chunky backlit awning bands and small hanging lanterns colour the sidewalk.
      for(let zz=-22;zz<0;zz+=5.5){
        part(lit,side*3.18,3.55,zz,.1,.12,3.8,new THREE.Color(accent).getHex());
        part(lit,side*3.7,2.8,zz,.28,.6,.28,0xff4a61);
        part(opaque,side*3.7,3.25,zz,.025,.35,.025,0x262039);
      }
      // Dense shop-level wayfinding and staggered adverts fill the gaps between the big blades.
      const microNames=['拉麺 / RAMEN','ARCADE 24','音楽 / AUDIO','HOTEL 夜','REPAIR LAB','夢 / DREAMS','VINYL 909','CYBER TEA'];
      for(let ad=0;ad<4;ad++){
        const zz=-4-ad*5.3,yy=4.25+(ad%2)*1.5;
        sign(group,side*4.35,yy,zz,microNames[(tile+ad+(side>0?3:0))%8],ad%2?accent:second,1.75,.63);
        part(opaque,side*4.9,yy,zz,1.3,.06,.06,0x34314d);
        sign(group,side*4.65,2.7,zz-1.1,ad%2?'営業中 / OPEN':'24H / ALL NIGHT',second,1.5,.45);
      }
      for(let ad=0;ad<3;ad++){
        const xx=side*(4.4+ad*.2),yy=10+ad*3.5,zz=-5-ad*6;
        sign(group,xx,yy,zz,microNames[(tile+ad+2)%8],ad%2?second:accent,2.2,1.05);
      }
      // Louvered air conditioners, pipes and striped awnings break up the flat facades.
      for(let unit=0;unit<4;unit++){
        const zz=-5-unit*4.7;
        part(opaque,side*5.15,5.1,zz,.5,.65,1.1,0x4a526c);
        for(let vent=0;vent<4;vent++)part(opaque,side*4.88,4.89+vent*.13,zz,.025,.04,.9,0x171c32);
        part(opaque,side*5.05,4.4,zz+.65,.09,1.9,.08,0x687088);
        for(let stripe=0;stripe<5;stripe++)part(lit,side*4.5,3.79,zz-1+stripe*.4,2.8,.035,.19,stripe%2?0xff427f:0xffbe61);
      }
      if((tile+(side>0?1:0))%2===0){
        const advert=new THREE.Mesh(signGeometry,adMaterial);advert.position.set(side*3.85,6.2,-9);advert.scale.set(1.6,2,1);group.add(advert);
        sign(group,side*3.85,7.48,-8.98,'夢を接続 / DREAMLINK',second,1.9,.45);
        const ring=new THREE.Mesh(ringGeometry,emissive);ring.material=keep(new THREE.MeshBasicMaterial({color:accent,toneMapped:false}));ring.position.set(side*3.45,4.7,-4.5);group.add(ring);
        sign(group,side*3.45,4.7,-4.47,'24',accent,.85,.4);
      }
      // A tiny vending machine, street furniture and carefully spaced trees provide scale.
      part(opaque,side*4.5,.9,-2,.65,1.8,.65,0x283c4e);
      part(lit,side*4.13,1.1,-2,.025,1.15,.5,0x9ed4d7);
      for(let yy=0;yy<3;yy++)for(let zz=0;zz<3;zz++)part(lit,side*4.1,.78+yy*.28,-2.17+zz*.16,.02,.11,.07,yy%2?0xf0c39a:0xbce5ec);
      part(opaque,side*3.5,.35,-25,1,.7,1.5,0x526362);
      part(opaque,side*3.5,1.8,-25,.1,2.8,.1,0x394942);
      for(let branch=0;branch<4;branch++)leaves.push({x:side*3.5+(random()-.5),y:3+random()*.5,z:-25+(random()-.5),w:.7,h:.8,d:.7,colour:0x315b50});
      for(let zz=-22;zz<1;zz+=10){part(opaque,side*2.3,1.6,zz,.05,3.2,.05,0x536f7e);part(lit,side*2.3,3.22,zz,.5,.04,.12,0xafd5da);halo(group,side*2.3,3.15,zz,2.4,side>0);}
    }
    // Market gates, junction signals, arcade cabinets and people make the street feel occupied.
    if(tile%2===0){
      sign(group,0,4.7,-5,tile%4===0?'深夜市場 / NIGHT MARKET':'次の夜 / NEXT DISTRICT','#ffbd36',6.2,.72);
      for(const side of [-1,1]){
        part(opaque,side*3.1,2.35,-5,.09,4.7,.09,0x3c304f);
        part(lit,side*3.1,4.7,-4.94,.09,.8,.05,0xffb51b);
        part(opaque,side*2.35,3.1,-23,.3,.85,.25,0x10182b);
        for(let light=0;light<3;light++)part(lit,side*2.35,3.35-light*.25,-22.85,.13,.13,.03,light===(tile%3)?[0xff386d,0xffc13a,0x2affbd][light]:0x263344);
        part(opaque,side*2.35,1.4,-23,.06,2.8,.06,0x39435a);
      }
    }
    for(const side of [-1,1]){
      const zz=-19;
      part(opaque,side*4.1,.7,zz,.7,1.4,.6,0x221c3b);
      part(lit,side*4.1,1.3,zz+.32,.53,.42,.02,side>0?0xff28ba:0x32eaff);
      part(opaque,side*4.1,.9,zz+.44,.65,.12,.25,0x4b3e67);
      sign(group,side*4.1,1.78,zz+.31,'PLAY / 遊','#ffbc45',.74,.3);
      // Low-poly pedestrians are silhouettes, with bright coats and umbrella canopies.
      const personZ=-8-(tile%3)*4,personX=side*(3.75+(tile%2)*.35);
      part(opaque,personX,.95,personZ,.36,.7,.24,side>0?0x352a51:0x295367);
      part(opaque,personX,1.48,personZ,.22,.25,.22,0x9d6c88);
      for(const leg of [-1,1])part(opaque,personX+leg*.11,.43,personZ+leg*.08,.11,.52,.14,0x17203b);
      part(opaque,personX+.24,1.3,personZ,.025,1.4,.025,0x8491a6);
      part(opaque,personX,1.98,personZ,.95,.12,.8,side>0?0x923c81:0x277087);
      part(lit,personX,1.99,personZ+.42,.94,.025,.03,side>0?0xff50c5:0x48eaff);
    }
    if(tile%2===1){
      const drone=new THREE.Group();group.add(drone);drones.push({group:drone,tile});
      batch(drone,box,solid,[{x:0,y:0,z:0,w:.65,h:.18,d:.42,colour:0x66748e},{x:0,y:.12,z:0,w:1.15,h:.035,d:.07,colour:0x283a56}]);
      batch(drone,box,emissive,[{x:-.5,y:0,z:0,w:.15,h:.025,d:.3,colour:0xff36bb},{x:.5,y:0,z:0,w:.15,h:.025,d:.3,colour:0x00edff},{x:0,y:-.12,z:.21,w:.3,h:.035,d:.04,colour:0xffc64b}]);
    }
    // Recessed gallery kiosks along both pavements: demos and minted originals are labelled separately.
    const gallerySide=tile%2?1:-1,galleryX=gallerySide*3.05;
    part(opaque,galleryX,1.8,-13,2.05,3.6,.3,0x101327);
    part(lit,galleryX,3.62,-12.82,2.06,.035,.04,tile%2?0xff20ad:0x00edff);
    const picture=new THREE.Mesh(signGeometry,keep(new THREE.MeshBasicMaterial({toneMapped:false,side:THREE.DoubleSide})));
    picture.position.set(galleryX,2.25,-12.82);picture.scale.set(1.85,1.85,1);group.add(picture);
    const caption=document.createElement('canvas');caption.width=512;caption.height=96;
    const captionTexture=keep(new THREE.CanvasTexture(caption));captionTexture.colorSpace=THREE.SRGBColorSpace;
    const captionMesh=new THREE.Mesh(signGeometry,keep(new THREE.MeshBasicMaterial({map:captionTexture,toneMapped:false,side:THREE.DoubleSide})));
    captionMesh.position.set(galleryX,1.05,-12.81);captionMesh.scale.set(1.9,.36,1);group.add(captionMesh);
    gallery.push({picture,ctx:caption.getContext('2d'),texture:captionTexture});
    if(tile===1||tile===5){const feed=new THREE.Mesh(signGeometry,telemetryMaterial);feed.position.set(0,5.3,-20);feed.scale.set(6.5,1.625,1);group.add(feed);}
    if(tile%2===1) {
      // Thin glazed footbridges pass overhead, then disappear behind the walker.
      part(opaque,0,6.9,-17,11.5,.3,3.1,0x718d9c);
      part(glazed,0,7.8,-17,11.4,1.55,3,0x37505d);
      part(opaque,0,8.65,-17,11.7,.15,3.3,0x9db0b7);
      part(lit,0,7.3,-15.46,11,.07,.025,0xff25bc);
      sign(group,0,7.9,-15.35,tile===1?'電脳街  /  BLOCKS':'不夜城  /  NIGHT CITY',tile%4===1?'#ff29b9':'#00edff',7.8,1.15);
      halo(group,0,7.8,-15,8,'#ff20ad');
      for(let x=-5;x<=5;x+=1.2)part(opaque,x,7.8,-15.4,.055,1.6,.05,0x8aa2ad);
    }
    if(tile===3) {
      part(opaque,0,10.5,-8,45,.35,2.6,0x526c7e);
      part(lit,0,10.75,-6.7,45,.04,.04,0xa3f0e9);
      const train=new THREE.Group();train.position.set(-20,11.5,-8);group.add(train);trains.push(train);
      const cars=[];for(let i=0;i<4;i++){cars.push({x:i*4,y:0,z:0,w:3.8,h:1.4,d:1.9,colour:0x8da3af});for(let w=0;w<4;w++){
        const window=new THREE.Mesh(box,emissive);window.material=keep(new THREE.MeshBasicMaterial({color:0xffd3a0,toneMapped:false}));window.position.set(i*4-1.3+w*.85,.15,.97);window.scale.set(.48,.55,.03);train.add(window);
      }}batch(train,box,solid,cars);
    }
    if(tile%2===0)for(let x=-1.8;x<2;x+=.75)part(opaque,x,.018,-25,.4,.025,2.8,0xb7c6c8);
    batch(group,box,solid,opaque);batch(group,box,glass,glazed);batch(group,box,emissive,lit);batch(group,leafGeometry,leafMaterial,leaves);
  }
  galleryLabels();
  // The street's own reflected image is rendered at a modest resolution, a few times per second.
  const reflection = keep(new THREE.WebGLRenderTarget(512,512,{depthBuffer:true}));
  const reflectedMatrix = new THREE.Matrix4();
  const groundMaterial=keep(new THREE.ShaderMaterial({
    uniforms:{reflection:{value:reflection.texture},reflectedMatrix:{value:reflectedMatrix},time:{value:0},travel:{value:0},pulse:{value:0}},
    vertexShader:`varying vec3 world;varying vec4 mirror;uniform mat4 reflectedMatrix;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;mirror=reflectedMatrix*p;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`varying vec3 world;varying vec4 mirror;uniform sampler2D reflection;uniform float time;uniform float travel;uniform float pulse;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=world.xz-vec2(0.,travel);float grain=hash(floor(p*90.));
        float tiles=step(.978,fract(p.y*.6))+step(.985,fract(p.x*.8));
        vec3 base=mix(vec3(.035,.052,.069),vec3(.012,.024,.035),min(tiles,1.));
        vec2 uv=mirror.xy/mirror.w*.5+.5;
        uv+=vec2(sin(p.y*4.+time*.7),cos(p.x*9.+p.y*3.+time))*.0014;
        vec3 light=texture2D(reflection,clamp(uv,.001,.999)).rgb;
        float wet=.66+.16*sin(p.y*.8+sin(p.x*2.));float fresnel=.8+min(length(world.xz-vec2(.8,6.))*.012,.35);
        vec3 colour=mix(base,light,wet*fresnel)+vec3(.01,.035,.038)*pulse;
        colour+=(grain-.5)*.012;float fog=1.-exp(-length(world.xz)*.018);colour=mix(colour,vec3(.028,.015,.065),fog);
        gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  const ground=new THREE.Mesh(keep(new THREE.PlaneGeometry(120,280)),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.set(0,0,-80);scene.add(ground);
  // A distant tower anchors the vanishing point without pretending to reproduce an actual Tokyo address.
  const distant=new THREE.Group();scene.add(distant);const skyline=[];
  for(let i=0;i<14;i++){const h=22+random()*45;skyline.push({x:(i-7)*10,y:h/2,z:-175-random()*20,w:6+random()*6,h,d:8,colour:0x344c66});}
  batch(distant,box,solid,skyline);
  const crown=[];for(let level=0;level<12;level++)crown.push({x:1,y:25+level*2,z:-164,w:6-level*.35,h:.055,d:5-level*.25,colour:level%2?0xff26bd:0x14dfff});
  batch(distant,box,emissive,crown);
  sign(distant,1,20,-161,'BLOCKS','#ff20ad',8,3);
  // Suspended utility cables add a tangled silhouette between the signs.
  const cablePoints=[];
  for(let wire=0;wire<7;wire++)for(let step=0;step<20;step++){
    const point=t=>new THREE.Vector3(-6+t*12,10+wire*.8-Math.sin(t*Math.PI)*(1.3+wire*.1),-10-wire*15+t*3);
    cablePoints.push(point(step/20),point((step+1)/20));
  }
  scene.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(cablePoints)),keep(new THREE.LineBasicMaterial({color:0x302343}))));
  const rainCount=innerWidth<700?350:650,points=new Float32Array(rainCount*6);
  for(let i=0;i<rainCount;i++){const x=(random()-.5)*25,y=random()*18,z=12-random()*100;points.set([x,y,z,x-.06,y-.25,z+.03],i*6);}
  const rainGeometry=keep(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const rain=new THREE.LineSegments(rainGeometry,keep(new THREE.LineBasicMaterial({color:0xc5dce2,transparent:true,opacity:.15,depthWrite:false})));scene.add(rain);
  const target={x:0,y:0},cursor={x:0,y:0};let elapsed=0,distance=0,last=0,stamp=null,pulse=0,lastMirror=-1;
  let dragging=false, previousX=0,previousY=0;
  function render(forceMirror=false) {
    const bob=paused||reduced.matches?0:Math.sin(distance*3.2)*.018;
    camera.position.set(.65+cursor.x*.4,1.72+bob,6);
    const yaw=cursor.x*.65;
    look.set(.65+Math.sin(yaw)*38,2.05-cursor.y*45,6-Math.cos(yaw)*38);camera.lookAt(look);camera.updateMatrixWorld();
    if(!paused&&!reduced.matches&&elapsed-artStamp>1/12){
      for(const entry of artSources.values())if(entry.decoder&&!entry.decoding){
        const index=Math.floor(elapsed*15)%entry.decoder.tracks.selectedTrack.frameCount;
        if(index===entry.frame)continue;entry.decoding=true;
        entry.decoder.decode({frameIndex:index}).then(({image:frame})=>{
          if(!disposed&&!entry.removed&&!paused&&!reduced.matches){entry.ctx.drawImage(frame,0,0,128,128);entry.texture.needsUpdate=true;entry.frame=index;}
          frame.close();
        }).catch(()=>{}).finally(()=>{entry.decoding=false;});
      }
      artStamp=elapsed;
    }
    tiles.forEach((tile,i)=>{tile.position.z=28-((28+i*DEPTH-distance)%LENGTH+LENGTH)%LENGTH;});
    adMaterial.uniforms.time.value=elapsed;
    drones.forEach(({group:drone,tile})=>{drone.position.set(Math.sin(elapsed*.22+tile)*1.5,4.2+Math.sin(elapsed*.8+tile)*.18,-8+Math.sin(elapsed*.16+tile)*7);drone.rotation.z=Math.sin(elapsed*.4+tile)*.06;});
    trains.forEach(train=>{train.position.x=(elapsed*4)%85-48;});rain.position.y=-(elapsed*6)%7;
    groundMaterial.uniforms.time.value=elapsed;groundMaterial.uniforms.travel.value=distance;groundMaterial.uniforms.pulse.value=pulse;
    if(forceMirror||elapsed-lastMirror>.14) {
      reflected.position.copy(camera.position);reflected.position.y=-camera.position.y;
      reflected.up.set(0,-1,0);reflected.lookAt(look.x,-look.y,look.z);reflected.updateMatrixWorld();
      reflectedMatrix.copy(reflected.projectionMatrix).multiply(reflected.matrixWorldInverse);
      ground.visible=false;renderer.setRenderTarget(reflection);renderer.render(scene,reflected);renderer.setRenderTarget(null);ground.visible=true;lastMirror=elapsed;
    }
    renderer.render(scene,camera);
  }
  function tick(ms) {
    if(reduced.matches!==lastPreference){preference();return;}
    if(disposed||ms-last<33)return;
    const delta=stamp===null?0:Math.min((ms-stamp)/1000,.08);stamp=ms;last=ms;
    elapsed+=delta;distance+=delta*(exploring?1.15:.65);
    cursor.x+=(target.x-cursor.x)*.055;cursor.y+=(target.y-cursor.y)*.055;pulse*=.96;render();
  }
  function resize() {
    const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();reflected.aspect=camera.aspect;reflected.updateProjectionMatrix();
    const w=innerWidth<700?256:512;reflection.setSize(w,Math.max(128,Math.round(w*height/width)));stamp=null;render(true);
  }
  function pointer(event) {
    if(event.target.closest('button,a,input'))return;
    if(event.pointerType==='touch') {
      if(!exploring||!dragging)return;
      target.x=THREE.MathUtils.clamp(target.x+(event.clientX-previousX)/innerWidth,-.7,.7);
      target.y=THREE.MathUtils.clamp(target.y+(event.clientY-previousY)/innerHeight,-.4,.4);
      previousX=event.clientX;previousY=event.clientY;
    } else {target.x=(event.clientX/innerWidth-.5)*1.2;target.y=(event.clientY/innerHeight-.5)*.65;}
  }
  const down=event=>{if(event.pointerType==='touch'&&exploring){dragging=true;previousX=event.clientX;previousY=event.clientY;}};
  const up=()=>{dragging=false;};
  const leave=()=>{if(!exploring)target.x=target.y=0;};
  const visibility=()=>{stamp=null;renderer.setAnimationLoop(paused||document.hidden||!visible?null:tick);label();};
  const preference=()=>{lastPreference=reduced.matches;paused=lastPreference;visibility();if(paused)render(true);};
  const minted=()=>{pulse=1;explore(false,false);};
  motion.onclick=()=>{paused=!paused;visibility();};
  const observer=new ResizeObserver(resize);observer.observe(stage);
  const viewport=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();});viewport.observe(stage);
  window.addEventListener('pointermove',pointer);stage.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  document.documentElement.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);window.addEventListener('blocks:minted',minted);
  window.addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();viewport.disconnect();window.removeEventListener('pointermove',pointer);stage.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);document.documentElement.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);window.removeEventListener('blocks:minted',minted);document.removeEventListener('keydown',escape);artSources.forEach(entry=>{entry.removed=true;entry.decoder?.close();entry.image.onload=null;entry.image.src='';});resources.forEach(resource=>resource.dispose());renderer.dispose();},{once:true});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);document.documentElement.dataset.scene='fallback';motion.hidden=true;explore(false,false);enter.hidden=true;});
  document.documentElement.dataset.scene='webgl';resize();visibility();
}catch {
  renderer?.dispose();resources.forEach(resource=>resource.dispose());document.documentElement.dataset.scene='fallback';motion.hidden=true;enter.hidden=true;
}
