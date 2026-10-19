import * as THREE from './vendor/three.module.min.js';
import {watchWorld} from './world.mjs';
import {decodeAvi,drawFrame} from './avi.mjs';
import {NETWORKS} from './networks.mjs';
import {Walker,PLACES,frameOf,streetName,EYE,PITCH,FACADE,REMOTE_Z} from './walker.mjs';
import {createKit} from './kit.mjs';
import {createStreets} from './streets.mjs';
import {createJourney,RIDE} from './journey.mjs';
import {createSoundtrack} from './audio.mjs';

const $=id=>document.getElementById(id);
const canvas=$('city'),stage=$('city-stage'),motion=$('motion'),enter=$('explore'),exit=$('leave-street'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const resources=new Set(),keep=resource=>(resources.add(resource),resource);
const soundtrack=createSoundtrack();
let renderer,paused=reduced.matches,disposed=false,exploring=false,lastPreference=reduced.matches;
let render=()=>{},walker=null;
const input={forward:false,back:false,left:false,right:false};
function label(){document.body.dataset.walkPaused=String(paused);motion.textContent=paused?'Resume ▷':'Pause Ⅱ';motion.setAttribute('aria-pressed',String(paused));}
function explore(active,focus=true){
  if(active===exploring)return;exploring=active;
  document.body.classList.toggle('exploring',active);enter.setAttribute('aria-pressed',String(active));exit.hidden=!active;
  if(walker){if(active){if(walker.auto?.kind==='wander')walker.auto=null;walker.cruise=!reduced.matches;}else if(walker.mode==='street'&&!walker.auto)walker.wander();}
  if(active&&paused&&!reduced.matches){paused=false;}
  window.dispatchEvent(new Event('blocks:explore-changed'));
  if(focus)(active?$('go-forward'):enter).focus({preventScroll:true});
}
enter.onclick=()=>explore(true);exit.onclick=()=>explore(false);
$('sound').onclick=async()=>{const on=await soundtrack.toggle();$('sound').setAttribute('aria-pressed',String(on));$('sound').querySelector('span').textContent=on?'Sound on':'Sound off';};
label();
// First visit: the help button beckons until opened.
try{if(!localStorage.getItem('blocks-help-seen'))document.body.dataset.firstVisit='true';}catch{}
window.addEventListener('blocks:panel',event=>{if(event.detail.id==='help'&&event.detail.open){delete document.body.dataset.firstVisit;try{localStorage.setItem('blocks-help-seen','1');}catch{}}});

let showChain=()=>{},showToken=()=>{},lastChainLabels,lastStatus='connecting',chainLabel='CHAIN';
const hud=document.querySelector('.chain-hud');
// The chain's short name comes from the site settings, so the street reads BASE or SEPOLIA.
fetch('config.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(settings=>{const label=NETWORKS[settings?.chainId]?.label;if(!label)return;chainLabel=label;
  $('chain-status').textContent=chainLabel+' / '+({live:'LIVE',stale:'DELAYED',offline:'FEED OFFLINE',connecting:'CONNECTING'}[lastStatus]);showChain(lastChainLabels,lastStatus);}).catch(()=>{});
const stopWorld=watchWorld({
  onState(state,labels){
    $('chain-head').textContent=labels.head;$('chain-fee').textContent=labels.fee;$('chain-supply').textContent=labels.minted;
    hud.title='Latest block: '+new Date(state.timestamp*1000).toLocaleTimeString()+' · '+state.transactions+' transactions · '+Math.round(Number(state.gasUsed)/Number(state.gasLimit)*100)+'% gas used';
    lastChainLabels=labels;showChain(labels);
  },
  onStatus(status){hud.dataset.status=status;lastStatus=status;showChain(lastChainLabels,status);$('chain-status').textContent=chainLabel+' / '+({live:'LIVE',stale:'DELAYED',offline:'FEED OFFLINE'}[status]);},
  onToken(token){showToken(token);}
});
window.addEventListener('pagehide',stopWorld,{once:true});

try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x090719);scene.fog=new THREE.FogExp2(0x191131,.0125);
  const camera=new THREE.PerspectiveCamera(66,1,.08,1900),reflected=camera.clone();camera.layers.enable(1);
  scene.add(new THREE.HemisphereLight(0x9daeff,0x38103d,1.3));
  const moonlight=new THREE.DirectionalLight(0x8eacff,1.3);moonlight.position.set(-14,40,20);scene.add(moonlight);
  // Coloured street lights travel with the walker.
  const rig=new THREE.Group();scene.add(rig);const rigLights=[];
  for(const [x,z,colour] of [[-4,-5,0x00eaff],[4,-13,0xff168e],[-3,-26,0x9038ff]]){const l=new THREE.PointLight(colour,100,30,2);l.position.set(x,3,z);rig.add(l);rigLights.push(l);}
  const kit=createKit(keep),interactive=[];
  const register=sceneName=>entry=>interactive.push({...entry,scene:sceneName});
  // The live chain board hangs over some streets.
  const telemetryCanvas=document.createElement('canvas');telemetryCanvas.width=1024;telemetryCanvas.height=256;
  const telemetry=telemetryCanvas.getContext('2d'),telemetryTexture=keep(new THREE.CanvasTexture(telemetryCanvas));telemetryTexture.colorSpace=THREE.SRGBColorSpace;
  const telemetryMaterial=keep(new THREE.MeshBasicMaterial({map:telemetryTexture,toneMapped:false,side:THREE.DoubleSide}));
  function paintChain(labels,status='connecting'){
    telemetry.fillStyle='#080c21';telemetry.fillRect(0,0,1024,256);telemetry.strokeStyle='#00edff';telemetry.lineWidth=7;telemetry.strokeRect(5,5,1014,246);
    telemetry.textAlign='center';telemetry.fillStyle='#ff45bd';telemetry.font='bold 34px monospace';telemetry.fillText(chainLabel+' / '+({live:'LIVE CHAIN',offline:'FEED OFFLINE',stale:'DELAYED FEED',connecting:'CHAIN FEED'}[status]),512,65);
    telemetry.fillStyle='#72faff';telemetry.font='bold 62px monospace';telemetry.fillText(labels?.head??'CONNECTING',512,145);
    telemetry.fillStyle='#b8e2f0';telemetry.font='25px monospace';telemetry.fillText(labels?labels.fee+'  /  '+labels.minted:'WAITING FOR LIVE CHAIN DATA',512,211);telemetryTexture.needsUpdate=true;
  }
  paintChain();showChain=(labels,status)=>{paintChain(labels,status);paintTerminal();if(paused)render(true);};
  const streets=createStreets(kit,{scene,keep,telemetry:telemetryMaterial,interactive:register('city')});
  const journey=createJourney(kit,{keep,interactive:register('journey')});
  const {gallery,station}=streets.places;
  walker=new Walker();
  // Wet ground with a planar reflection, centred on the camera. A hole opens over the subway stairs.
  const reflection=keep(new THREE.WebGLRenderTarget(512,512,{depthBuffer:true})),reflectedMatrix=new THREE.Matrix4();
  const stairs=frameOf(PLACES.station),s0=stairs.at(8,-1.5),s1=stairs.at(17,1.5);
  const groundMaterial=keep(new THREE.ShaderMaterial({
    uniforms:{reflection:{value:reflection.texture},reflectedMatrix:{value:reflectedMatrix},time:{value:0},pulse:{value:0},eye:{value:new THREE.Vector3()},
      hole:{value:new THREE.Vector4(Math.min(s0.x,s1.x),Math.min(s0.z,s1.z),Math.max(s0.x,s1.x),Math.max(s0.z,s1.z))}},
    vertexShader:'varying vec3 world;varying vec4 mirror;uniform mat4 reflectedMatrix;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;mirror=reflectedMatrix*p;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:`varying vec3 world;varying vec4 mirror;uniform sampler2D reflection;uniform float time;uniform float pulse;uniform vec3 eye;uniform vec4 hole;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        if(world.x>hole.x&&world.x<hole.z&&world.z>hole.y&&world.z<hole.w)discard;
        vec2 p=world.xz;float grain=hash(floor(p*90.));float tiles=step(.978,fract(p.y*.6))+step(.985,fract(p.x*.8));
        vec3 base=mix(vec3(.035,.052,.069),vec3(.012,.024,.035),min(tiles,1.));
        vec2 uv=mirror.xy/mirror.w*.5+.5;uv+=vec2(sin(p.y*4.+time*.7),cos(p.x*9.+p.y*3.+time))*.0014;
        vec3 light=texture2D(reflection,clamp(uv,.001,.999)).rgb;float d=length(world.xz-eye.xz);
        float wet=.66+.16*sin(p.y*.8+sin(p.x*2.));float fresnel=.8+min(d*.012,.35);
        vec3 colour=mix(base,light,wet*fresnel)+vec3(.01,.035,.038)*pulse+(grain-.5)*.012;
        colour=mix(colour,vec3(.028,.015,.065),1.-exp(-d*.018));gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  const ground=new THREE.Mesh(keep(new THREE.PlaneGeometry(420,420)),groundMaterial);ground.rotation.x=-Math.PI/2;scene.add(ground);
  // A distant skyline ring and the BLOCKS tower, which always stands to the north.
  const distant=new THREE.Group();scene.add(distant);const ringItems=[],crown=[];
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2,rad=190+(i%3)*14,h=40+((i*37)%60);ringItems.push({x:Math.sin(a)*rad,y:h/2,z:Math.cos(a)*rad,w:14+(i%4)*5,h,d:14,ry:a,colour:0x2a3c55});}
  for(let level=0;level<12;level++)crown.push({x:0,y:58+level*2.2,z:-205,w:9-level*.5,h:.08,d:7-level*.4,colour:level%2?0xff26bd:0x14dfff});
  ringItems.push({x:0,y:40,z:-210,w:12,h:80,d:10,colour:0x1f2c44});
  kit.batch(distant,kit.box,kit.materials.solid,ringItems);kit.batch(distant,kit.box,kit.materials.lit,crown);
  kit.sign(distant,0,46,-204.5,['ブロック','BLOCKS'],'#ff20ad',12,4);
  // Rain around the camera.
  const rainCount=innerWidth<700?400:800,points=new Float32Array(rainCount*6);
  for(let i=0;i<rainCount;i++){const x=(Math.random()-.5)*40,y=Math.random()*18,z=(Math.random()-.5)*40;points.set([x,y,z,x-.06,y-.25,z+.03],i*6);}
  const rainGeometry=keep(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const rain=new THREE.LineSegments(rainGeometry,keep(new THREE.LineBasicMaterial({color:0xc5dce2,transparent:true,opacity:.15,depthWrite:false})));scene.add(rain);
  // A floating marker hovers over whatever can be used next.
  const markerCanvas=document.createElement('canvas');markerCanvas.width=markerCanvas.height=64;const mc=markerCanvas.getContext('2d');
  mc.fillStyle='#ff32b5';mc.shadowColor='#ff32b5';mc.shadowBlur=12;mc.beginPath();mc.moveTo(14,16);mc.lineTo(50,16);mc.lineTo(32,46);mc.closePath();mc.fill();
  const marker=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:keep(new THREE.CanvasTexture(markerCanvas)),transparent:true,depthTest:false,toneMapped:false})));marker.scale.set(.5,.5,1);marker.visible=false;marker.renderOrder=10;
  // Gallery artworks: minted originals, newest first. The onchain SVG poster shows first; its AVI then animates the texture.
  const mintedArt=[],artSources=new Map(),boardContent=[];let artStamp=-1;
  function artwork(token){
    const source=token.video;if(artSources.has(source))return artSources.get(source);
    const image=new Image(),c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#100b26';ctx.fillRect(0,0,128,128);
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const entry={image,ctx,texture,movie:null,pixels:null,frame:-1,removed:false};artSources.set(source,entry);
    fetch(source).then(response=>response.ok?response.arrayBuffer():Promise.reject(Error('Unavailable'))).then(data=>{
      if(disposed||entry.removed)return;const movie=decodeAvi(data);if(movie.width!==128||movie.height!==128)return;
      entry.pixels=ctx.createImageData(128,128);entry.movie=movie;
    }).catch(()=>{/* The poster stays up when the video cannot be read. */});
    image.onload=()=>{if(disposed||entry.frame>=0)return;ctx.drawImage(image,0,0,128,128);texture.needsUpdate=true;if(paused)render(true);};image.src=token.image;
    return entry;
  }
  // Frames without a minted block wait for one; the gallery shows no demo artwork.
  const emptyCanvas=document.createElement('canvas');emptyCanvas.width=emptyCanvas.height=128;
  {const c=emptyCanvas.getContext('2d');c.fillStyle='#0b0a1c';c.fillRect(0,0,128,128);c.fillStyle='#ff32b522';for(let y=0;y<128;y+=4)c.fillRect(0,y,128,1);
   c.textAlign='center';c.fillStyle='#ff75d0';c.font='800 44px "Noto Sans CJK JP",sans-serif';c.fillText('空',64,64);c.font='bold 9px monospace';c.fillStyle='#9eebff';c.fillText('AWAITING A BLOCK',64,98);}
  const emptyTexture=keep(new THREE.CanvasTexture(emptyCanvas));emptyTexture.colorSpace=THREE.SRGBColorSpace;emptyTexture.magFilter=THREE.NearestFilter;
  let myToken=null;
  function galleryLabels(){
    gallery.boards.forEach((board,i)=>{
      const token=mintedArt[i]??null,mine=token&&token.tokenId===myToken?.tokenId;
      boardContent[i]=token?{tokenId:token.tokenId}:null;
      board.picture.material.map=token?artwork(token).texture:emptyTexture;board.picture.material.color.set(0xffffff);board.picture.material.needsUpdate=true;
      const ctx=board.ctx;ctx.fillStyle='#080c21';ctx.fillRect(0,0,512,96);ctx.textAlign='center';
      ctx.fillStyle=mine?'#ff75d0':token?'#66ffce':'#7c8aa0';ctx.font='bold 24px "Noto Sans CJK JP",monospace';
      ctx.fillText(mine?'あなたの夜 · YOURS #'+token.tokenId:token?'鋳造済 MINTED / #'+token.tokenId:'空 · AWAITING A BLOCK',256,40);
      ctx.font='15px monospace';ctx.fillStyle='#b1d0e1';ctx.fillText(token?'BLOCKS · ONCHAIN ORIGINAL':'MINT AT THE TERMINAL',256,72);board.texture.needsUpdate=true;
    });
    const {centre,centreArt}=gallery.terminal;
    if(myToken){centreArt.material.map=artwork(myToken).texture;centreArt.material.needsUpdate=true;centre.visible=true;}
    const used=new Set([...gallery.boards.map(board=>board.picture.material.map),myToken?centreArt.material.map:null]);
    for(const [source,entry] of artSources)if(!used.has(entry.texture)){entry.removed=true;entry.movie=null;entry.image.onload=null;entry.image.src='';entry.texture.dispose();resources.delete(entry.texture);artSources.delete(source);}
  }
  showToken=token=>{if(disposed)return;const i=mintedArt.findIndex(item=>item.tokenId===token.tokenId);if(i>=0)mintedArt.splice(i,1);mintedArt.unshift(token);mintedArt.length=Math.min(mintedArt.length,gallery.boards.length);galleryLabels();if(paused)render(true);};
  window.addEventListener('blocks:mine',event=>{myToken=event.detail;showToken(myToken);pulse=1;});
  galleryLabels();
  // The mint terminal and ticket gate screens mirror the page's wallet and mint state.
  let mintState={stage:'idle',text:'No inputs. Just the block your mint lands in.'},wallet={state:'none'},pulse=0;
  function paintTerminal(){
    const {ctx,texture}=gallery.terminal;ctx.fillStyle='#070418';ctx.fillRect(0,0,512,320);ctx.strokeStyle='#ff32b5';ctx.lineWidth=6;ctx.strokeRect(6,6,500,308);ctx.textAlign='center';
    const big={minted:'鋳造完了',error:'もう一度',pending:'確認中',wallet:'承認待ち',connect:'接続中',checking:'確認中'}[mintState.stage]??'鋳造';
    ctx.fillStyle='#ff75d0';ctx.font='800 76px "Noto Sans CJK JP",sans-serif';ctx.fillText(big,256,105);
    ctx.fillStyle='#9eebff';ctx.font='bold 24px monospace';ctx.fillText(mintState.stage==='ready'||mintState.stage==='idle'?'TAP TO MINT ONE BLOCK':mintState.stage.toUpperCase(),256,160);
    ctx.fillStyle='#d8e8ea';ctx.font='17px sans-serif';ctx.fillText(mintState.text.slice(0,52),256,205,480);
    ctx.fillStyle='#70f7ff';ctx.font='15px monospace';ctx.fillText((lastChainLabels?.head??'#—')+'  ·  '+(wallet.account?wallet.account.slice(0,6)+'…'+wallet.account.slice(-4):'NO WALLET'),256,270);
    texture.needsUpdate=true;
  }
  function paintGates(){
    const {ctx,texture,flaps,material}=station.gates;ctx.fillStyle='#04121a';ctx.fillRect(0,0,256,128);ctx.textAlign='center';
    const open=walker.gate,[jp,en]=wallet.state==='connected'?['ようこそ',wallet.account.slice(0,6)+'…'+wallet.account.slice(-4)]:wallet.state==='visitor'?['見学','VISITOR · NO WALLET']:wallet.state==='connecting'?['接続中','CHECK YOUR WALLET']:['タッチ','TAP TO CONNECT'];
    ctx.fillStyle=open?'#7dffb8':'#46f5ff';ctx.font='800 54px "Noto Sans CJK JP",sans-serif';ctx.fillText(jp,128,62);ctx.font='bold 17px monospace';ctx.fillText(en,128,104);texture.needsUpdate=true;
    material.color.set(open?0x2affbd:0xff3355);for(const {flap} of flaps)flap.scale.z=open?.1:.72;
  }
  window.addEventListener('blocks:mint-state',event=>{mintState=event.detail;paintTerminal();if(event.detail.stage==='minted')pulse=1;});
  window.addEventListener('blocks:wallet',event=>{wallet={...wallet,...event.detail};if(['connected','visitor'].includes(wallet.state))walker.gate=true;paintGates();paintTerminal();if(paused)render(true);});
  paintTerminal();paintGates();
  // The subway ride, in both directions.
  let ride=null,activeScene=scene,elapsed=0,last=0,stamp=null,timeScale=1;
  const look={x:0,y:0},lookTarget={x:0,y:0};
  const fade=$('fade');
  function flash(tone='light'){fade.dataset.tone=tone;fade.dataset.on='true';setTimeout(()=>{fade.dataset.on='false';},420);}
  const stationFrame=frameOf(PLACES.station),cabOffset=1;
  function cabCity(b){const p=stationFrame.at(31.8,b);return {x:p.x,y:-6,z:p.z,yaw:0};}
  function startRide(direction){
    if(ride)return;walker.mode='ride';walker.anim=null;ride={direction,phase:'board',t:0};station.train.visible=direction==='out';activeScene=direction==='out'?scene:journey.scene;document.body.dataset.mode='ride';soundtrack.setPlace('ride');
    if(direction==='out'){
      const {b}=stationFrame.local(walker.x,walker.z),door=stationFrame.at(30.2,Math.max(-14,Math.min(14,b)));
      const seat=cabCity(-18);
      walker.play([{...door,y:-6,d:.9},{x:seat.x-Math.sin(0)*cabOffset,z:seat.z+cabOffset,y:-6,yaw:walker.yaw+Math.atan2(Math.sin(-walker.yaw),Math.cos(-walker.yaw)),d:2}],()=>{ride.phase='depart';ride.t=0;station.train.visible=false;journey.setCab(seat,'out');scene.add(journey.cab);});
    }else{
      const seat={x:0,y:RIDE.floor,z:RIDE.end+17.8,yaw:Math.PI};
      walker.play([{x:1.2,z:walker.z,y:RIDE.floor,d:.8},{x:0,z:seat.z-cabOffset,y:RIDE.floor,yaw:walker.yaw+Math.atan2(Math.sin(Math.PI-walker.yaw),Math.cos(Math.PI-walker.yaw)),d:2}],()=>{ride.phase='journey';ride.t=0;journey.train.visible=false;journey.setCab(seat,'back');});
    }
  }
  function rideStep(dt){
    if(!ride||ride.phase==='board'||ride.phase==='alight')return;ride.t+=dt;
    if(ride.phase==='depart'){
      const b=-18-3*ride.t*ride.t,pose=cabCity(b);journey.setCab(pose,'out');
      if(ride.t>2.8){flash();ride.phase='journey';ride.t=0;journey.scene.add(journey.cab);activeScene=journey.scene;}
    }else if(ride.phase==='journey'){
      const pose=journey.ride(ride.direction,ride.t);journey.setCab(pose,ride.direction);
      if(pose.done){
        if(ride.direction==='out'){ride.phase='alight';journey.train.visible=true;journey.cab.visible=false;
          walker.x=pose.x;walker.z=pose.z+cabOffset;walker.y=RIDE.floor;walker.yaw=0;
          walker.play([{yaw:-Math.PI/2,d:.7},{x:3.6,z:pose.z+3,d:1.4},{x:4.2,z:REMOTE_Z-4,yaw:-Math.PI/2-.5,d:2.4}],()=>{walker.placeAt('remote',4.2,-4,-Math.PI/2-.5);endRide('remote');});}
        else{flash();ride.phase='arrive';ride.t=0;scene.add(journey.cab);activeScene=scene;}
      }
    }else if(ride.phase==='arrive'){
      // The train pulls in nose first from the north tunnel and stops at the far end of the platform.
      const k=Math.min(1,ride.t/4),b=18-80*(1-k)*(1-k),pose={...cabCity(b),yaw:Math.PI};journey.setCab(pose,'back');
      if(k>=1){
        ride.phase='alight';station.train.visible=true;journey.cab.visible=false;
        walker.x=pose.x;walker.z=pose.z-cabOffset;walker.y=-6;walker.yaw=Math.PI;const out=stationFrame.at(27.6,10);
        walker.play([{yaw:Math.PI/2,d:.7},{...out,y:-6,d:1.6},{yaw:Math.PI/2-.35,d:.6}],()=>{walker.placeAt('station',27.6,10,Math.PI/2-.35);walker.gate=true;endRide('station');});
      }
    }
  }
  function endRide(place){ride=null;delete document.body.dataset.mode;journey.scene.add(journey.cab);journey.cab.visible=false;soundtrack.setPlace(place);if(place==='remote')toast2('桜川 · Sakuragawa. Explore the platform; walk back to the train to return.');}
  function toast2(text){const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(toast2.timer);toast2.timer=setTimeout(()=>{el.hidden=true;},5200);}
  // What can be used from here, for the action button, Enter key and marker.
  const worldPosition=new THREE.Vector3();
  function focus(){
    if(ride||!walker.place||walker.mode!=='inside'){
      const near=walker.mode==='street'?walker.nearby().door:null;
      if(near&&near.ahead<8)return {id:'door:'+near.place.id,jp:near.place.jp,en:'Enter the '+near.place.en.toLowerCase(),side:near.side,place:near.place};
      return null;
    }
    const place=walker.place;
    if(place.remote)return walker.x<5.2?{id:'train-home',jp:'乗車',en:'Board the train back to the city'}:null;
    const {a}=frameOf(place).local(walker.x,walker.z);
    if(place.id==='station'){if(!walker.gate&&a>15)return {id:'gate',jp:'改札',en:'Tap the ticket gate to connect a wallet'};if(walker.gate&&a>25)return {id:'train',jp:'乗車',en:'Board the train to Sakuragawa'};return null;}
    if(place.id==='gallery'){
      const t=gallery.terminal&&interactive.find(e=>e.id==='terminal');t.object.getWorldPosition(worldPosition);
      if(Math.hypot(worldPosition.x-walker.x,worldPosition.z-walker.z)<5)return {id:'terminal',jp:'鋳造',en:wallet.state==='connected'?'Mint your block':'Connect wallet & mint'};
      let best=null;for(const e of interactive)if(e.id.startsWith('art:')){e.object.getWorldPosition(worldPosition);const d=Math.hypot(worldPosition.x-walker.x,worldPosition.z-walker.z);if(d<3.2&&(!best||d<best.d))best={id:e.id,d,jp:'作品',en:'View this artwork'};}
      return best;
    }
    if(place.id==='ramen'){
      const machine=interactive.find(e=>e.id==='ticket');machine.object.getWorldPosition(worldPosition);
      // Near the door the ticket machine is offered first; deeper in, the chef.
      if(Math.hypot(worldPosition.x-walker.x,worldPosition.z-walker.z)<3.4||(a<FACADE+4&&wallet.state!=='connected'))return wallet.state==='connected'?{id:'ticket',jp:'食券機',en:'Wallet connected'}:{id:'ticket',jp:'食券機',en:'Connect your wallet'};
    }
    if(place.id==='ramen'&&a>FACADE+4)return {id:'chef',jp:'いらっしゃいませ',en:'Say hello to the chef'};
    return null;
  }
  function interact(id){
    if(!id)return;
    if(id.startsWith('door:')){const place=PLACES[id.slice(5)],near=walker.nearby().door;if(near?.place===place)walker.queue(near.side);return;}
    if(id==='gate'){if(walker.gate){toast2('The gate is open. The train is waiting on the platform.');return;}window.dispatchEvent(new Event('blocks:connect-request'));return;}
    if(id==='terminal'){window.dispatchEvent(new Event('blocks:mint-request'));return;}
    if(id.startsWith('art:')){const content=boardContent[Number(id.slice(4))];if(content)window.dispatchEvent(new CustomEvent('blocks:inspect',{detail:content}));else toast2('空 · This frame is waiting for a block. Mint at the terminal to fill it.');return;}
    if(id==='train'){if(!walker.gate){toast2('改札 · Tap a ticket gate first.');return;}if(walker.place?.id==='station'&&walker.mode==='inside')startRide('out');return;}
    if(id==='train-home'){if(walker.place?.remote&&walker.mode==='inside')startRide('back');return;}
    if(id==='ticket'){if(wallet.state==='connected')toast2('食券 · Your wallet is connected. Mint your block at the gallery terminal.');else window.dispatchEvent(new Event('blocks:connect-request'));return;}
    if(id==='chef')toast2('いらっしゃいませ！ Welcome in — one shoyu ramen, coming right up.');
  }
  // Prompts, place names and the action button.
  const prompt=$('prompt'),action=$('action'),placeJp=$('place-jp'),placeEn=$('place-en');let lastPrompt='',lastPlace='',current=null;
  function setPrompt(html){if(html!==lastPrompt){prompt.innerHTML=html;lastPrompt=html;}}
  function hud(){
    let jp,en;
    if(ride){jp=ride.direction==='out'?'桜川行き':'中央行き';en=ride.direction==='out'?'BOUND FOR SAKURAGAWA':'BOUND FOR THE CITY';}
    else if(walker.place&&walker.mode!=='street'){jp=walker.place.jp;en=walker.place.en.toUpperCase();}
    else{const n=streetName(walker.x,walker.z,walker.h);jp=n.jp+' '+n.chome+'丁目';en=n.en+' · '+n.chome+'-CHOME';}
    if(jp+en!==lastPlace){placeJp.textContent=jp;placeEn.textContent=en;lastPlace=jp+en;}
    const placeId=ride?'ride':walker.place&&walker.mode==='inside'?walker.place.id:'street';
    if(document.body.dataset.place!==placeId){document.body.dataset.place=placeId;soundtrack.setPlace(placeId==='ride'?'ride':placeId);}
    $('mint-panel').dataset.visible=String(placeId==='gallery'||$('mint-panel').dataset.busy==='true');
    current=focus();
    if(current&&!current.id.startsWith('door:')){action.hidden=false;const text=current.jp+' · '+current.en;if(action.textContent!==text)action.textContent=text;}else action.hidden=true;
    let html='';
    if(ride)html=ride.direction==='out'?'<b>次は 桜川</b>Next stop: Sakuragawa':'<b>次は 中央</b>Next stop: Chuo Station';
    else if(walker.mode==='inside'){
      const id=walker.place.id,{a}=frameOf(walker.place).local(walker.x,walker.z);
      html={ramen:'<b>ラーメン</b>Pull up a stool. ↓ or Esc to leave.',gallery:'<b>ギャラリー</b>Mint at the terminal in the centre. Minted blocks hang on the walls.',
        remote:'<b>桜川</b>Explore the platform and the river deck. Walk back to the train to return.',
        station:walker.gate?(a>22?'<b>乗車</b>Walk onto the train, or tap it, to ride to Sakuragawa.':'<b>改札</b>The gates are open. Go through to the platform.'):'<b>改札</b>Tap a ticket gate to connect your wallet and go through.'}[id];
    }else if(walker.mode==='street'){
      const near=walker.nearby(),q=walker.queued;
      if(near.door&&near.door.ahead<14)html=`<b>${near.door.side==='left'?'←':'→'} ${near.door.place.jp}</b>${near.door.place.en}<i>${near.door.side} arrow to go in</i>`;
      else if(q&&!walker.auto)html=`<b>${q.side==='left'?'←':'→'}</b>Turning ${q.side} at the next junction`;
      else if(walker.auto?.kind==='route')html=`<b>案内</b>Taking you to the ${walker.auto.place.en.toLowerCase()}…`;
      else if(near.junction<13)html='<b>交差点</b>Junction · ← → to turn';
    }
    setPrompt(html);
    for(const [id,key] of [['go-left','left'],['go-right','right']])$(id).dataset.active=String(walker.queued?.side===key||input[key]);
    $('go-forward').dataset.active=String(input.forward||walker.mode==='street'&&walker.cruise&&!walker.auto);$('go-back').dataset.active=String(input.back);
  }
  // Minimap: north up, blocks, the three places and the walker.
  const map=$('minimap'),mapContext=map.getContext('2d');
  function drawMap(){
    const c=mapContext,W=map.width,scale=W/240;c.clearRect(0,0,W,W);
    if(ride||walker.place?.remote){c.fillStyle='#ff9ad5';c.font='bold 40px "Noto Sans CJK JP",sans-serif';c.textAlign='center';c.fillText(ride?'電車':'桜川',W/2,W/2);c.font='bold 18px monospace';c.fillStyle='#9eebff';c.fillText(ride?'ON THE TRAIN':'SAKURAGAWA',W/2,W/2+34);return;}
    const cx=walker.x,cz=walker.z,X=x=>W/2+(x-cx)*scale,Z=z=>W/2+(z-cz)*scale;
    c.fillStyle='#1a1530';
    for(let i=Math.floor((cx-130)/PITCH);i<=Math.ceil((cx+130)/PITCH);i++)for(let j=Math.floor((cz-130)/PITCH);j<=Math.ceil((cz+130)/PITCH);j++)c.fillRect(X(i*PITCH+FACADE),Z(j*PITCH+FACADE),(PITCH-2*FACADE)*scale,(PITCH-2*FACADE)*scale);
    for(const [id,colour,glyph] of [['station','#46f5ff','駅'],['gallery','#ff32b5','画'],['ramen','#ff4d5e','麺']]){
      const d=PLACES[id].door,dx=Math.max(14,Math.min(W-14,X(d.x))),dz=Math.max(14,Math.min(W-14,Z(d.z)));
      c.fillStyle=colour;c.beginPath();c.arc(dx,dz,11,0,Math.PI*2);c.fill();c.fillStyle='#090713';c.font='bold 14px "Noto Sans CJK JP",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,dx,dz+1);
    }
    c.save();c.translate(W/2,W/2);c.rotate(-walker.yaw);c.fillStyle='#fff';c.shadowColor='#46f5ff';c.shadowBlur=10;c.beginPath();c.moveTo(0,-13);c.lineTo(8,9);c.lineTo(0,4);c.lineTo(-8,9);c.closePath();c.fill();c.restore();
    c.fillStyle='#9eebff';c.font='bold 14px monospace';c.textAlign='center';c.fillText('N',W/2,16);
  }
  // Rendering.
  const camYaw=()=>walker.yaw+look.x;
  function placeCamera(){
    let x=walker.x,y=walker.y+EYE,z=walker.z,yaw=camYaw();
    if(ride&&['depart','journey','arrive'].includes(ride.phase)){const p=journey.cab.position,ry=journey.cab.rotation.y;x=p.x+Math.sin(ry)*cabOffset;y=p.y+EYE;z=p.z+Math.cos(ry)*cabOffset;yaw=ry+look.x;}
    const bob=paused||reduced.matches||walker.mode!=='street'?0:Math.sin(elapsed*6.5)*Math.min(1,Math.abs(walker.v)/2.3)*.025;
    camera.position.set(x,y+bob,z);camera.rotation.set(look.y,yaw,0,'YXZ');camera.updateMatrixWorld();
  }
  let lastMirror=-1,mapFrame=0;
  render=(forceMirror=false)=>{
    placeCamera();
    if(!paused&&!reduced.matches&&elapsed-artStamp>1/12&&walker.place?.id==='gallery'){
      for(const entry of artSources.values())if(entry.movie){
        const index=Math.floor(elapsed*entry.movie.fps)%entry.movie.frames.length;if(index===entry.frame)continue;
        entry.ctx.putImageData(drawFrame(entry.movie,index,entry.pixels),0,0);entry.texture.needsUpdate=true;entry.frame=index;
      }
      artStamp=elapsed;
    }
    for(const m of kit.adMaterials)m.uniforms.time.value=elapsed;
    if(activeScene===scene){
      streets.update(walker);streets.tick(elapsed);
      const indoors=walker.mode==='inside'&&walker.place&&!walker.place.remote||camera.position.y<1;
      rain.visible=!indoors;rain.position.set(camera.position.x,-(elapsed*6)%7,camera.position.z);
      rig.position.set(camera.position.x,0,camera.position.z);rig.rotation.y=walker.yaw;rigLights.forEach(l=>{l.intensity=indoors?25:100;});
      distant.position.set(camera.position.x,0,camera.position.z);
      ground.position.set(Math.round(camera.position.x),0,Math.round(camera.position.z));
      groundMaterial.uniforms.time.value=elapsed;groundMaterial.uniforms.pulse.value=pulse;groundMaterial.uniforms.eye.value.copy(camera.position);
      if(!indoors&&(forceMirror||elapsed-lastMirror>.14)){
        reflected.position.set(camera.position.x,-camera.position.y,camera.position.z);reflected.rotation.set(-look.y,camera.rotation.y,0,'YXZ');reflected.updateMatrixWorld();
        reflectedMatrix.copy(reflected.projectionMatrix).multiply(reflected.matrixWorldInverse);
        ground.visible=false;marker.visible=false;renderer.setRenderTarget(reflection);renderer.render(scene,reflected);renderer.setRenderTarget(null);ground.visible=true;lastMirror=elapsed;
      }
    }else journey.tick(elapsed,camera,1/30);
    // The marker floats over the current interactive target.
    const target=current&&!current.id.startsWith('door:')?interactive.find(e=>e.id===current.id):null;
    if(target&&(target.scene==='city')===(activeScene===scene)){target.object.getWorldPosition(worldPosition);activeScene.add(marker);marker.visible=true;marker.position.set(worldPosition.x,worldPosition.y+(current.id==='terminal'?3.9:current.id.startsWith('art')?4.3:current.id==='gate'?2.1:current.id==='ticket'?2.7:current.id==='chef'?3.1:4.2)+Math.sin(elapsed*3)*.08,worldPosition.z);}else marker.visible=false;
    renderer.render(activeScene,camera);
    if(++mapFrame%4===0||paused)drawMap();
  };
  function tick(ms){
    if(reduced.matches!==lastPreference){preference();return;}
    if(disposed||ms-last<16)return;
    const delta=(stamp===null?0:Math.min((ms-stamp)/1000,.06))*timeScale;stamp=ms;last=ms;elapsed+=delta;
    const events=walker.update(delta,ride?{}:input);
    for(const e of events){if(e==='board')interact(walker.place?.remote?'train-home':'train');if(e==='gate-closed'&&!toast2.gateShown){toast2.gateShown=true;toast2('改札 · Tap a ticket gate to connect your wallet. No wallet? It lets you through as a visitor.');}}
    rideStep(delta);if(!ride)activeScene=walker.place?.remote?journey.scene:scene;
    look.x+=(lookTarget.x-look.x)*.08;look.y+=(lookTarget.y-look.y)*.08;pulse*=.97;
    hud();render();
  }
  function resize(){
    const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=width<700?74:66;camera.updateProjectionMatrix();reflected.aspect=camera.aspect;reflected.fov=camera.fov;reflected.updateProjectionMatrix();
    const w=innerWidth<700?256:512;reflection.setSize(w,Math.max(128,Math.round(w*height/width)));stamp=null;hud();render(true);
  }
  // Input: keys, the on-screen arrows, look and taps.
  const blocked=()=>Boolean(document.querySelector('dialog[open]'))||Boolean(ride);
  function wake(){if(paused){paused=false;visibility();}if(!exploring)explore(true,false);}
  const keys={ArrowUp:'forward',KeyW:'forward',ArrowDown:'back',KeyS:'back',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  function press(key,down){
    if(down&&blocked())return;input[key]=down;
    if(!down)return;wake();
    if(key==='forward'&&walker.mode==='street'){walker.auto=null;walker.cruise=true;}
    if(key==='back'&&walker.mode==='street'){walker.auto=null;walker.cruise=false;}
    if((key==='left'||key==='right')&&walker.mode==='street')walker.queue(key);
  }
  function keydown(event){
    if(event.target.closest?.('input,textarea,dialog'))return;
    if(event.key==='Escape'){if(document.querySelector('dialog[open]')||ride)return;if(walker.mode==='inside'&&!walker.place.remote){walker.leave();return;}explore(false);return;}
    if(event.key==='?'){document.querySelector('[data-panel=help]').click();return;}
    if(blocked())return;
    const key=keys[event.code];
    if(key){event.preventDefault();if(!event.repeat)press(key,true);return;}
    if(event.code==='KeyT'){wake();walker.turnAround();return;}
    if((event.code==='Enter'||event.code==='KeyE')&&!event.target.closest?.('button,a')&&current){wake();interact(current.id);}
  }
  function keyup(event){const key=keys[event.code];if(key)input[key]=false;}
  document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);
  for(const [id,key] of [['go-forward','forward'],['go-back','back'],['go-left','left'],['go-right','right']]){
    const button=$(id);
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);press(key,true);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{input[key]=false;});
    button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();press(key,true);setTimeout(()=>{input[key]=false;},350);}});
  }
  $('turn-around').onclick=()=>{wake();walker.turnAround();};
  action.onclick=()=>{if(current)interact(current.id);};
  $('guide-gallery').onclick=()=>guide('gallery');
  function guide(id){
    explore(true,false);wake();
    if(walker.mode==='inside'&&walker.place?.id===id)return;
    if(walker.place?.remote){toast2('Take the train back to the city first.');return;}
    if(walker.mode==='inside'){walker.leave();setTimeout(()=>{walker.route(id);},2600);}else walker.route(id);
  }
  window.addEventListener('blocks:guide',event=>guide(event.detail.place));
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();let downAt=null,dragging=false,previous=null,hoverStamp=0;
  function pick(event){
    const rect=canvas.getBoundingClientRect();ndc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
    const candidates=interactive.filter(e=>(e.scene==='city')===(activeScene===scene));
    let best=null;for(const e of candidates){const hit=raycaster.intersectObject(e.object,true)[0];if(hit&&hit.distance<16&&(!best||hit.distance<best.distance))best={id:e.id,distance:hit.distance};}
    return best;
  }
  canvas.addEventListener('pointerdown',event=>{downAt={x:event.clientX,y:event.clientY};previous=downAt;dragging=event.pointerType==='touch';});
  window.addEventListener('pointermove',event=>{
    if(event.target!==canvas&&!dragging)return;
    if(dragging&&previous){lookTarget.x=THREE.MathUtils.clamp(lookTarget.x+(event.clientX-previous.x)/innerWidth*2.2,-1.2,1.2);lookTarget.y=THREE.MathUtils.clamp(lookTarget.y+(event.clientY-previous.y)/innerHeight*1.2,-.5,.5);previous={x:event.clientX,y:event.clientY};}
    else if(event.pointerType==='mouse'){lookTarget.x=-(event.clientX/innerWidth-.5)*1.4;lookTarget.y=-(event.clientY/innerHeight-.5)*.6;}
    if(event.pointerType==='mouse'&&performance.now()-hoverStamp>120){hoverStamp=performance.now();canvas.dataset.hover=String(Boolean(pick(event)));}
  });
  window.addEventListener('pointerup',event=>{
    dragging=false;if(!downAt||event.target!==canvas){downAt=null;return;}
    const moved=Math.hypot(event.clientX-downAt.x,event.clientY-downAt.y);downAt=null;if(moved>8||blocked())return;
    const hit=pick(event);if(hit){wake();interact(hit.id);}
  });
  const leave=()=>{if(!dragging){lookTarget.x=0;lookTarget.y=0;}};
  const visibility=()=>{stamp=null;renderer.setAnimationLoop(paused||document.hidden?null:tick);if(document.hidden)soundtrack.suspend();else soundtrack.resume();label();};
  const preference=()=>{lastPreference=reduced.matches;paused=lastPreference;visibility();if(paused)render(true);};
  motion.onclick=()=>{paused=!paused;visibility();if(paused)render(true);};
  window.addEventListener('blocks:minted',()=>{pulse=1;});
  const observer=new ResizeObserver(resize);observer.observe(stage);
  document.documentElement.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
  window.addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();soundtrack.dispose();document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);artSources.forEach(entry=>{entry.removed=true;entry.movie=null;entry.image.onload=null;entry.image.src='';});resources.forEach(resource=>resource.dispose());renderer.dispose();},{once:true});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);document.documentElement.dataset.scene='fallback';motion.hidden=true;explore(false,false);enter.hidden=true;});
  // Deep links: #gallery, #ramen and #station start inside; otherwise the overview wanders.
  const link=location.hash.slice(1);
  if(['gallery','ramen','station'].includes(link)){walker.placeAt(link,PLACES[link].id==='station'?18:FACADE+2,0);explore(true,false);}
  else walker.wander();
  // A small hook for automated browser QA.
  window.__blocks={walker,startRide,interact,get ride(){return ride;},set timeScale(v){timeScale=v;},gallery:()=>({centre:gallery.terminal.centre.visible,mine:myToken?.tokenId??null,minted:mintedArt.map(t=>t.tokenId),boards:boardContent.map(c=>c?.tokenId??null),animated:[...artSources.values()].filter(e=>e.movie&&e.frame>=0).length}),stats:()=>({...renderer.info.render,programs:renderer.info.programs.length,segments:[...streets.cache.values()].filter(e=>e.group.parent).length,cached:streets.cache.size})};
  document.documentElement.dataset.scene='webgl';resize();visibility();
}catch(error){
  console.error(error);
  renderer?.dispose();resources.forEach(resource=>resource.dispose());document.documentElement.dataset.scene='fallback';motion.hidden=true;enter.hidden=true;
}
