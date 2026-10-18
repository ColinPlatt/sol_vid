import * as THREE from './vendor/three.module.min.js';
const canvas=document.querySelector('#city'),stage=document.querySelector('#city-stage'),button=document.querySelector('#motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,paused=reduced.matches,disposed=false;
const resources=[];
const keep=x=>(resources.push(x),x);
function label(){button.textContent=paused?'Play scene ▷':'Pause scene Ⅱ';button.setAttribute('aria-pressed',String(paused));}
label();
try{
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b0c18,.025);
 const camera=new THREE.PerspectiveCamera(35,1,.1,120);camera.position.set(26,22,29);camera.lookAt(0,3,0);
 scene.add(new THREE.AmbientLight(0x8878c4,2.4));const light=new THREE.DirectionalLight(0xc4fbd9,2.2);light.position.set(8,20,12);scene.add(light);
 const world=new THREE.Group();world.rotation.y=-.2;world.position.y=-2;scene.add(world);
 const box=keep(new THREE.BoxGeometry(1,1,1)),dark=keep(new THREE.MeshStandardMaterial({color:0x15182e,roughness:.6,metalness:.35})),edge=keep(new THREE.MeshBasicMaterial({color:0x7970b5,wireframe:true,transparent:true,opacity:.12}));
 const base=new THREE.Mesh(keep(new THREE.BoxGeometry(29,.65,25)),keep(new THREE.MeshStandardMaterial({color:0x101521,metalness:.6,roughness:.3})));base.position.y=-.4;world.add(base);
 const grid=new THREE.GridHelper(28,28,0x42647a,0x202c42);grid.position.y=-.055;world.add(grid);keep(grid.geometry);keep(grid.material);
 let seed=34561;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const towers=[];for(let x=-11;x<=11;x+=3.2)for(let z=-9;z<=9;z+=3.4){if(Math.abs(x)<2.2)continue;const h=2+random()*8+(z<0?random()*5:0);towers.push({x,z,h,w:1.6+random()*.7,d:1.7+random()*.5});}
 const buildings=new THREE.InstancedMesh(box,dark,towers.length),outlines=new THREE.InstancedMesh(box,edge,towers.length);const dummy=new THREE.Object3D();
 towers.forEach((b,i)=>{dummy.position.set(b.x,b.h/2,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.rotation.set(0,0,0);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);outlines.setMatrixAt(i,dummy.matrix);buildings.setColorAt(i,new THREE.Color().setHSL(.66+random()*.09,.3,.08+random()*.07));});world.add(buildings,outlines);
 const windowGeometry=keep(new THREE.PlaneGeometry(.16,.24)),windowMaterial=keep(new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));const panes=[];
 towers.forEach(b=>{for(let y=.8;y<b.h-.5;y+=.75)for(let c=0;c<3;c++){if(random()<.3)continue;panes.push({x:b.x+(c-1)*.45,y,z:b.z+b.d/2+.012,rotation:0,color:random()<.24?0xef98c9:random()<.5?0xb8ead3:0x7475a8});if(random()>.3)panes.push({x:b.x+b.w/2+.012,y,z:b.z+(c-1)*.45,rotation:Math.PI/2,color:random()<.3?0xe59cbf:0x8095b4});}});
 const windows=new THREE.InstancedMesh(windowGeometry,windowMaterial,panes.length);panes.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.setMatrixAt(i,dummy.matrix);windows.setColorAt(i,new THREE.Color(p.color));});world.add(windows);
 const neonPink=keep(new THREE.MeshBasicMaterial({color:0xf695c8})),neonMint=keep(new THREE.MeshBasicMaterial({color:0xb3efd1}));
 for(const b of towers.filter((_,i)=>i%4===0)){const sign=new THREE.Mesh(keep(new THREE.BoxGeometry(.13,Math.min(b.h*.6,3),.14)),random()>.5?neonMint:neonPink);sign.position.set(b.x+b.w/2+.05,b.h*.6,b.z+b.d/2+.07);world.add(sign);const roof=new THREE.Mesh(keep(new THREE.BoxGeometry(b.w+.03,.035,b.d+.03)),neonPink);roof.position.set(b.x,b.h+.01,b.z);world.add(roof);}
 const track=new THREE.Mesh(keep(new THREE.BoxGeometry(.04,.035,25)),neonMint);track.position.set(.7,.16,0);world.add(track);const rail=track.clone();rail.position.x=-.7;world.add(rail);
 const train=new THREE.Group();for(let i=0;i<3;i++){const car=new THREE.Mesh(keep(new THREE.BoxGeometry(.9,.55,2.15)),dark);car.position.z=i*2.3;train.add(car);for(let j=0;j<3;j++){const pane=new THREE.Mesh(keep(new THREE.BoxGeometry(.92,.17,.3)),neonMint);pane.position.set(0,.08,i*2.3-.7+j*.65);train.add(pane);}}train.position.y=.6;world.add(train);
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,0.4)');gradient.addColorStop(.2,'rgba(255,255,255,0.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const glow=keep(new THREE.CanvasTexture(glowCanvas));
 for(let i=0;i<7;i++){const sprite=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:glow,color:i%2?0xe984c3:0x9bffd3,transparent:true,depthWrite:false})));sprite.position.set((random()-.5)*22,2+random()*5,(random()-.5)*20);sprite.scale.set(5,5,1);world.add(sprite);}
 const rainPoints=new Float32Array(600*6);for(let i=0;i<600;i++){const x=(random()-.5)*35,y=random()*22,z=(random()-.5)*30;rainPoints.set([x,y,z,x-.06,y-.35,z],i*6);}const rainGeometry=keep(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPoints,3));const rain=new THREE.LineSegments(rainGeometry,keep(new THREE.LineBasicMaterial({color:0x887ba9,transparent:true,opacity:.18})));world.add(rain);
 const target={x:0,y:0},cursor={x:0,y:0};let last=0;
 function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw(0);}
 function pointer(event){if(event.pointerType==='touch')return;const r=stage.getBoundingClientRect();target.x=(event.clientX-r.left)/r.width-.5;target.y=(event.clientY-r.top)/r.height-.5;}
 function draw(ms){if(disposed)return;if(ms&&ms-last<32)return;last=ms;const t=ms*.001;cursor.x+=(target.x-cursor.x)*.04;cursor.y+=(target.y-cursor.y)*.04;world.rotation.y=-.2+cursor.x*.2;world.position.y=-2+Math.sin(t*.4)*.12;camera.position.y=22+cursor.y*2;camera.lookAt(0,3,0);train.position.z=(t*2)%36-20;rain.position.y=-(t*6)%8;renderer.render(scene,camera);}
 function loop(){renderer.setAnimationLoop(paused||document.hidden?null:draw);if(paused)draw(0);label();}
 button.onclick=()=>{paused=!paused;loop();};const visibility=()=>loop();const preference=()=>{paused=reduced.matches;loop();};
 window.addEventListener('resize',resize);stage.addEventListener('pointermove',pointer);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
 window.addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);window.removeEventListener('resize',resize);stage.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);for(const r of resources)r.dispose();renderer.dispose();},{once:true});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);document.documentElement.dataset.scene='fallback';button.hidden=true;});
 document.documentElement.dataset.scene='webgl';resize();loop();
}catch{renderer?.dispose();document.documentElement.dataset.scene='fallback';button.hidden=true;}
