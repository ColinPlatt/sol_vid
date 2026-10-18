import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('#city');
const stage = document.querySelector('#city-stage');
const button = document.querySelector('#motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const resources = new Set();
const keep = resource => (resources.add(resource), resource);
let renderer, paused = reduced.matches, disposed = false, visible = true;
function label() {
  button.textContent = paused ? 'Resume atmosphere ▷' : 'Pause atmosphere Ⅱ';
  button.setAttribute('aria-pressed', String(paused));
}
label();
try {
  renderer = new THREE.WebGLRenderer({canvas, alpha: false, antialias: false, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050811);
  scene.fog = new THREE.FogExp2(0x101329, .018);
  const camera = new THREE.PerspectiveCamera(55, 1, .2, 230);
  scene.add(new THREE.HemisphereLight(0x8d99e9, 0x0b0d19, 2.1));
  const key = new THREE.DirectionalLight(0x8ed8ff, 2.6);
  key.position.set(-15, 40, 25); scene.add(key);
  const city = new THREE.Group(); scene.add(city);
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const facade = keep(new THREE.MeshStandardMaterial({color: 0x202739, roughness: .7, metalness: .55}));
  const cyan = keep(new THREE.MeshBasicMaterial({color: 0x59f5ee}));
  const pink = keep(new THREE.MeshBasicMaterial({color: 0xff489d}));
  const white = keep(new THREE.MeshBasicMaterial({color: 0xd5e7ff}));
  const amber = keep(new THREE.MeshBasicMaterial({color: 0xffbe70}));
  let seed = 2099;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mesh = (x,y,z,w,h,d,material=facade) => {
    const item = new THREE.Mesh(box, material); item.position.set(x,y,z); item.scale.set(w,h,d); city.add(item); return item;
  };
  const groundMaterial = keep(new THREE.ShaderMaterial({
    uniforms: {time: {value: 0}, pulse: {value: 0}},
    vertexShader: `varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `varying vec3 world; uniform float time; uniform float pulse;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=world.xz;float n=hash(floor(p*38.));
        float ripples=sin(p.y*4.+sin(p.x*7.)*.5+time)*.13+.87;
        float c=exp(-abs(p.x-6.)*.42)*(sin(p.y*.3)*.35+.65)*ripples;
        float m=exp(-abs(p.x+6.)*.5)*(cos(p.y*.28)*.35+.65)*ripples;
        vec3 color=vec3(.009,.014,.028)+vec3(.015,.18,.19)*c+vec3(.23,.012,.08)*m;
        float lane=step(abs(p.x),.035)*step(.35,fract(p.y*.12));color+=lane*vec3(.12,.27,.28);
        float seams=step(.985,fract(p.y*.25));color*=1.-seams*.3;
        color+=(n-.5)*.018;color+=pulse*exp(-length(p-vec2(0.,-24.))*.025)*vec3(.02,.16,.12);
        float fog=1.-exp(-length(p)*.022);gl_FragColor=vec4(mix(color,vec3(.018,.024,.05),fog),1.);}`
  }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(240, 260)), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.04, -65); scene.add(ground);
  // Buildings and windows use shared geometry and instancing, including on mobile.
  const towers=[];
  for(let z=13;z>=-105;z-=9) for(const side of [-1,1]) for(let row=0;row<3;row++) {
    const h=9+random()*23+row*3;
    towers.push({x:side*(8.5+row*9+random()*1.8),z:z-random()*2,h,w:4.5+random()*2,d:5.5+random()*2,side,row});
  }
  const buildings = new THREE.InstancedMesh(box, facade, towers.length);
  const dummy = new THREE.Object3D();
  towers.forEach((b,i)=>{dummy.position.set(b.x,b.h/2,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);buildings.setColorAt(i,new THREE.Color().setHSL(.62+random()*.08,.25,.12+random()*.08));});
  city.add(buildings);
  const panes=[];
  for(const b of towers){
    for(let y=2;y<b.h-1;y+=1.35)for(let x=-1.5;x<=1.5;x+=.8){
      if(random()<.44)continue;
      panes.push({x:b.x+x,y,z:b.z+b.d/2+.02,rot:0,color:random()<.15?0xff69ae:random()<.4?0x74e8ed:0xe3be8c});
      if(b.row===0 && random()>.45)panes.push({x:b.x-b.side*(b.w/2+.02),y,z:b.z+x,rot:Math.PI/2,color:0x668ed2});
    }
    mesh(b.x,b.h+.2,b.z,b.w*.7,.45,b.d*.7);
    if(b.row===0){
      mesh(b.x-b.side*b.w/2,b.h*.58,b.z+b.d/2+.08,.08,b.h*.66,.08,b.side<0?pink:cyan);
      mesh(b.x, .25,b.z,b.w+.8,.5,b.d+.8);
    }
    if(random()<.4)mesh(b.x,b.h+1.6,b.z,.055,3,.055,cyan);
  }
  const windows = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(.3,.5)),keep(new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})),panes.length);
  panes.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rot,0);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.setMatrixAt(i,dummy.matrix);windows.setColorAt(i,new THREE.Color(p.color));});city.add(windows);
  // All signage and glow textures are drawn locally; the scene has no asset requests.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(.12,'rgba(255,255,255,.24)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const glow=keep(new THREE.CanvasTexture(glowCanvas));
  function halo(x,y,z,size,color){const s=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:glow,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));s.position.set(x,y,z);s.scale.set(size,size,1);city.add(s);return s;}
  const signs=[];
  function sign(b,text,color,vertical=false){
    const c=document.createElement('canvas');c.width=vertical?128:512;c.height=vertical?512:192;
    const g=c.getContext('2d');g.fillStyle='#090c19';g.fillRect(0,0,c.width,c.height);g.strokeStyle=color;g.lineWidth=5;g.strokeRect(7,7,c.width-14,c.height-14);g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.shadowColor=color;g.shadowBlur=12;
    if(vertical){g.font='bold 62px sans-serif';[...text].forEach((v,i)=>g.fillText(v,64,82+i*110));}else{g.font='bold 70px monospace';g.fillText(text,256,86);g.font='17px monospace';g.fillText('OPEN ALL NIGHT / 24:00',256,151);}
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;
    const material=keep(new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
    const s=new THREE.Mesh(keep(new THREE.PlaneGeometry(vertical?1.45:5.3,vertical?5.8:2)),material);
    s.position.set(b.x-b.side*(vertical?b.w/2+.35:0),vertical?8+random()*6:5+random()*8,b.z+b.d/2+.12);city.add(s);signs.push(s);
    halo(s.position.x,s.position.y,s.position.z+.15,vertical?8:9,color);
  }
  const fronts=towers.filter(b=>b.row===0&&b.z>-60);
  fronts.forEach((b,i)=>sign(b,i%3===0?'夜の街':i%3===1?'BLOCKS':'夜行',b.side<0?'#ff489d':'#65fff1',i%3!==1));
  for(let z=10;z>-85;z-=12)for(const side of [-1,1]){
    mesh(side*5.5,2.8,z,.08,5.6,.08);mesh(side*5.1,5.6,z,.9,.055,.12,side<0?pink:cyan);halo(side*5.1,5.5,z,4,side<0?0xff489d:0x59f5ee);
    mesh(side*5.5,.015,z,1.1,.02,7,keep(new THREE.MeshBasicMaterial({color:side<0?0xff489d:0x59f5ee,transparent:true,opacity:.09})));
  }
  // A narrow elevated railway crosses the street above the distant vanishing point.
  mesh(0,8,-34,65,.45,2.1);mesh(0,8.3,-33,65,.055,.04,cyan);
  for(const x of [-20,-6,6,20])mesh(x,4,-34,.5,8,.5);
  const train=new THREE.Group();city.add(train);
  for(let i=0;i<4;i++){
    const car=new THREE.Mesh(box,facade);car.scale.set(4.4,1.4,1.5);car.position.x=i*4.7;train.add(car);
    for(let j=0;j<5;j++){const w=new THREE.Mesh(box,amber);w.scale.set(.5,.52,.03);w.position.set(i*4.7-1.55+j*.75,.14,.77);train.add(w);}
    const trim=new THREE.Mesh(box,pink);trim.scale.set(4.3,.045,1.55);trim.position.set(i*4.7,-.5,0);train.add(trim);
  }
  train.position.set(0,9.15,-34);
  const moon=new THREE.Mesh(keep(new THREE.CircleGeometry(9,64)),keep(new THREE.MeshBasicMaterial({color:0x342756})));moon.position.set(2,36,-125);scene.add(moon);
  const ring=new THREE.Mesh(keep(new THREE.TorusGeometry(9.3,.055,6,80)),pink);ring.position.copy(moon.position);scene.add(ring);halo(2,36,-124,38,0x8844cc);
  const rainCount=innerWidth<700?500:1000,points=new Float32Array(rainCount*6);
  for(let i=0;i<rainCount;i++){const x=(random()-.5)*70,y=random()*38,z=20-random()*100;points.set([x,y,z,x-.12,y-.8,z+.12],i*6);}
  const rainGeometry=keep(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  const rain=new THREE.LineSegments(rainGeometry,keep(new THREE.LineBasicMaterial({color:0x9cbed5,transparent:true,opacity:.22,depthWrite:false})));scene.add(rain);
  const traffic=[];for(let i=0;i<8;i++){const s=halo(i%2?1.8:-1.8,.42,-i*12,1.7,i%2?0xff396c:0x96ffff);traffic.push(s);}
  const target={x:0,y:0},cursor={x:0,y:0};let last=0,elapsed=0,stamp=null,pulse=0;
  function draw(ms){
    if(disposed)return;if(ms&&ms-last<33)return;
    const delta=stamp===null?0:Math.min((ms-stamp)/1000,.08);stamp=ms;last=ms;elapsed+=delta;
    cursor.x+=(target.x-cursor.x)*.045;cursor.y+=(target.y-cursor.y)*.045;
    camera.position.set(cursor.x*1.3,5.2+cursor.y*.55+Math.sin(elapsed*.23)*.15,24);
    camera.lookAt(cursor.x*.3,10,-38);train.position.x=(elapsed*5)%110-65;rain.position.y=-(elapsed*10)%15;
    traffic.forEach((s,i)=>{s.position.z=18-((elapsed*(i%2?5:3)+i*13)%115);});
    groundMaterial.uniforms.time.value=elapsed;groundMaterial.uniforms.pulse.value=pulse;pulse*=.97;
    renderer.render(scene,camera);
  }
  function resize(){const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();stamp=null;draw(0);}
  function pointer(e){if(e.pointerType==='touch')return;target.x=e.clientX/innerWidth-.5;target.y=e.clientY/innerHeight-.5;}
  function leave(){target.x=target.y=0;}
  const visibility=()=>{stamp=null;renderer.setAnimationLoop(paused||document.hidden||!visible?null:draw);label();};
  const preference=()=>{paused=reduced.matches;visibility();if(paused)draw(0);};
  const minted=()=>{pulse=1;};
  button.onclick=()=>{paused=!paused;visibility();};
  const observer=new ResizeObserver(resize);observer.observe(stage);
  const viewport=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();});viewport.observe(stage);
  window.addEventListener('pointermove',pointer);document.documentElement.addEventListener('pointerleave',leave);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);window.addEventListener('blocks:minted',minted);
  window.addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();viewport.disconnect();window.removeEventListener('pointermove',pointer);document.documentElement.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);window.removeEventListener('blocks:minted',minted);resources.forEach(r=>r.dispose());renderer.dispose();},{once:true});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);document.documentElement.dataset.scene='fallback';button.hidden=true;});
  document.documentElement.dataset.scene='webgl';resize();visibility();
}catch{renderer?.dispose();resources.forEach(r=>r.dispose());document.documentElement.dataset.scene='fallback';button.hidden=true;}
