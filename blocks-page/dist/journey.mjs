// The line out of the city: tunnel, viaduct, a mountain tunnel and the cherry-blossom valley at Sakuragawa.
// The track runs along x=0; the city end is +z and Sakuragawa is at REMOTE_Z. Train floor is y=1.1.
import {REMOTE_Z,EYE} from './walker.mjs';
import {NEON,rng,pick} from './kit.mjs';

export const RIDE={start:42,portal:0,viaduct:-320,mountain:-780,end:REMOTE_Z,floor:1.1,duration:30};
const ease=t=>t*t*t*(t*(t*6-15)+10);

export function createJourney(kit,{keep,interactive}){
  const {THREE}=kit,scene=new THREE.Scene(),r=rng(8128),b=kit.builder(),g=new THREE.Group();scene.add(g);
  scene.background=new THREE.Color(0x120c2a);scene.fog=new THREE.FogExp2(0x2b1f4d,.0021);
  scene.add(new THREE.HemisphereLight(0xb6a0ff,0x1a1030,1.25));
  const moon=new THREE.DirectionalLight(0xc9d6ff,1.1);moon.position.set(-200,300,-400);scene.add(moon);
  const sky=new THREE.Mesh(keep(new THREE.SphereGeometry(1800,32,16)),keep(new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vDir;
      float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
      void main(){float h=clamp(vDir.y,0.,1.);vec3 c=mix(vec3(.55,.18,.42),vec3(.16,.08,.3),smoothstep(0.,.18,h));c=mix(c,vec3(.02,.02,.08),smoothstep(.15,.7,h));
        vec3 q=floor(vDir*420.);float star=step(.9975,hash(q))*smoothstep(.08,.3,h);c+=vec3(star);
        float moon=smoothstep(.9985,.9992,dot(vDir,normalize(vec3(-.35,.32,-.88))));c+=vec3(1.,.95,.9)*moon+vec3(.25,.2,.35)*pow(max(dot(vDir,normalize(vec3(-.35,.32,-.88))),0.),60.);
        gl_FragColor=vec4(c,1.);}`})));
  scene.add(sky);
  const sakura=keep(new THREE.MeshStandardMaterial({color:0xffb3d4,emissive:0x7a2c55,emissiveIntensity:.7,roughness:.85}));
  const blossoms=[];
  const tree=(x,z,y=0,size=1)=>{b.part('matte',x,y+1.4*size,z,.25*size,2.8*size,.25*size,0x3a2a24);for(let k=0;k<6;k++)blossoms.push({x:x+(r()-.5)*2.6*size,y:y+(3+r()*1.6)*size,z:z+(r()-.5)*2.6*size,w:(.9+r()*.7)*size,h:(.7+r()*.5)*size,d:(.9+r()*.7)*size,colour:pick(r,[0xffa6cf,0xff8cc0,0xffc8e0,0xffffff])});};
  // Track, maglev guide strip and pylons with neon rings every 24 m.
  const len=RIDE.start-RIDE.end+120,mid=(RIDE.start+RIDE.end-120)/2;
  for(const x of [-.72,.72])b.part('solid',x,.12,mid,.1,.14,len,0x9aa6b0);
  b.part('lit',0,.06,mid,.32,.02,len,0x46f5ff);b.part('matte',0,-.2,mid,3.4,.4,len,0x1e2230);
  for(let z=RIDE.start;z>RIDE.end-100;z-=24){
    const tunnel=z>RIDE.portal||(z<RIDE.viaduct&&z>RIDE.mountain);if(tunnel)continue;
    for(const x of [-2.2,2.2])b.part('solid',x,3,z,.18,6,.18,0x6f7d8e);
    b.part('solid',0,6,z,4.6,.18,.18,0x6f7d8e);b.part('lit',0,5.85,z,4.2,.04,.04,z%48===0?0xff32b5:0x46f5ff);
  }
  // Tunnels with streaking ring lights.
  for(const [z0,z1] of [[RIDE.start+20,RIDE.portal],[RIDE.viaduct,RIDE.mountain]]){
    const c=(z0+z1)/2,l=z0-z1;
    b.part('matte',-2.6,2.8,c,.3,6,l,0x1a1d25);b.part('matte',2.6,2.8,c,.3,6,l,0x1a1d25);b.part('matte',0,5.9,c,5.5,.3,l,0x14161d);
    for(let z=z0;z>z1;z-=12){b.part('lit',-2.42,2.6,z,.04,.06,2.2,0xffe2a8);b.part('lit',2.42,2.6,z,.04,.06,2.2,0xffe2a8);b.part('lit',0,5.72,z,2.4,.04,.08,z%36===0?0xff32b5:0x9fe8ff);}
    for(const z of [z0,z1]){b.part('lit',0,6.1,z,5.8,.12,.12,0xff32b5);for(const x of [-2.85,2.85])b.part('lit',x,3,z,.12,6.2,.12,0xff32b5);}
  }
  // The city edge: a megastructure wall around the portal and a skyline beyond it.
  b.part('solid',0,13,RIDE.portal+6,900,26,12,0x111827);
  for(let k=0;k<40;k++)b.part('lit',(r()-.5)*600,4+r()*20,RIDE.portal-.2,4+r()*20,.25,.1,new THREE.Color(pick(r,NEON)).getHex());
  kit.sign(g,0,9,RIDE.portal-.3,['中央区','CENTRAL DISTRICT'],'#46f5ff',14,2.4,Math.PI);
  const windows=[];
  for(let k=0;k<150;k++){
    const x=(r()-.5)*900,z=70+r()*480,h=60+r()*220*(1-Math.abs(x)/700),w=14+r()*24;if(Math.abs(x)<30&&z<160)continue;
    b.part('solid',x,h/2-14,z,w,h,w,pick(r,[0x161d33,0x1b2238,0x221a33]));
    for(let n=0;n<14;n++)windows.push({x:x+(r()-.5)*w*.9,y:-10+r()*h,z:z-w/2-.3,w:1+r()*2.5,h:.5,d:.2,colour:pick(r,[0xffd3a0,0x46f5ff,0xff7ab8,0x9fe8ff])});
    if(r()>.7)b.part('lit',x,h-14+.4,z,w+.4,.5,w+.4,new THREE.Color(pick(r,NEON)).getHex());
  }
  kit.batch(g,kit.box,kit.materials.lit,windows);
  b.part('solid',0,150,380,26,330,26,0x182038);for(let k=0;k<14;k++)b.part('lit',0,190+k*7,380-13.5,22-k,.5,.2,k%2?0xff26bd:0x14dfff);
  kit.sign(g,0,322,366,['ブロック','BLOCKS'],'#ff32b5',30,9,Math.PI);
  // Viaduct over the outskirts: low lit buildings, highways and pillars.
  b.part('matte',0,-14.2,(RIDE.portal+RIDE.viaduct)/2,1400,.4,RIDE.portal-RIDE.viaduct+200,0x0f141c);
  for(let z=RIDE.portal-10;z>RIDE.viaduct;z-=30){b.part('solid',0,-7,z,2.4,14,2.4,0x4b5566);}
  b.part('solid',0,-.6,(RIDE.portal+RIDE.viaduct)/2,4.2,.8,RIDE.portal-RIDE.viaduct,0x5b6577);
  for(let k=0;k<160;k++){
    const x=(r()>.5?1:-1)*(14+r()*360),z=RIDE.portal-r()*(RIDE.portal-RIDE.viaduct),h=4+r()*22,w=6+r()*14;
    b.part('solid',x,-14+h/2,z,w,h,w,0x1a2130);for(let n=0;n<4;n++)b.part('lit',x+(r()-.5)*w*.8,-14+r()*h,z+(x>0?-1:1)*0+w/2+.05,1.4,.5,.05,pick(r,[0xffd3a0,0x46f5ff,0xffb56b]));
  }
  for(const x of [-60,48])for(const colour of [0xff3355,0xfff2d0])b.part('lit',x+(colour===0xff3355?2:-2),-13.8,(RIDE.portal+RIDE.viaduct)/2,.3,.05,RIDE.portal-RIDE.viaduct,colour);
  // The mountain the second tunnel passes through.
  const mountains=[],caps=[];
  mountains.push({x:0,y:110,z:(RIDE.viaduct+RIDE.mountain)/2,w:340,h:240,d:300,colour:0x1d1f3a});
  for(let k=0;k<70;k++){
    const side=k%2?1:-1,x=side*(150+r()*780),z=RIDE.mountain+150-r()*(RIDE.mountain-RIDE.end+900),h=150+r()*380,w=110+r()*260;
    mountains.push({x,y:h/2-2,z,w,h,d:w,colour:pick(r,[0x1d1f3a,0x22213f,0x191b33])});caps.push({x,y:h*.82-2,z,w:w*.36,h:h*.36,d:w*.36,colour:0x8a83b8});
  }
  for(let k=0;k<12;k++){const x=(r()-.5)*1600,h=380+r()*300,w=300+r()*300;mountains.push({x,y:h/2,z:RIDE.end-700-r()*500,w,h,d:w,colour:0x1a1832});caps.push({x,y:h*.82,z:RIDE.end-700,w:w*.36,h:h*.36,d:w*.36,colour:0x9890c8});}
  kit.batch(g,kit.cone,kit.materials.matte,mountains);kit.batch(g,kit.cone,kit.materials.lit,caps);
  // Valley floor, river, groves, villages and lanterns.
  const valley=(RIDE.mountain+RIDE.end-600)/2,valleyLen=RIDE.mountain-RIDE.end+600;
  b.part('matte',0,-.6,valley,2400,1,valleyLen,0x141f22);
  const river=new THREE.Mesh(keep(new THREE.PlaneGeometry(16,valleyLen)),keep(new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),fog:true,
    vertexShader:'#include <fog_pars_vertex>\nvarying vec2 vUv;void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader:'#include <fog_pars_fragment>\nvarying vec2 vUv;uniform float time;void main(){float s=sin(vUv.y*900.+time*2.+sin(vUv.x*20.))*.5+.5;float glint=pow(s,24.)*.6;vec3 c=mix(vec3(.04,.05,.14),vec3(.25,.12,.32),.4+.4*sin(vUv.y*60.));c+=vec3(.9,.6,.85)*glint;gl_FragColor=vec4(c,1.);\n#include <fog_fragment>\n}'})));
  river.rotation.x=-Math.PI/2;river.position.set(25,-.05,valley);g.add(river);
  for(let k=0;k<220;k++){
    const near=k<70,x=near?(r()>.5?10+r()*6:36+r()*30):(r()>.5?1:-1)*(8+r()*120),z=near?RIDE.end+(r()-.5)*140:RIDE.mountain-40-r()*(RIDE.mountain-RIDE.end-100);
    if(x>14&&x<36)continue;if(near&&x<16&&x>8&&Math.abs(z-RIDE.end)<24)continue;tree(x,z,0,.9+r()*.6);
  }
  for(let k=0;k<26;k++){const x=-(30+r()*160),z=RIDE.mountain-80-r()*1500;b.part('matte',x,1.6,z,6,3.2,5,0x3a2a24);b.part('matte',x,3.6,z,7,.4,6,0x231c22,0,.2);b.part('lit',x+3.02,1.5,z,.05,.9,1.6,0xffb56b);}
  for(let z=RIDE.end-70;z<RIDE.end+70;z+=6){b.part('solid',16,.9,z,.12,1.8,.12,0x3a2a24);b.ball(16,2,z,.3,.38,.3,0xffb24a,true);kit.halo(g,16,2,z,3.2,'#ffb24a',.45);}
  // A great torii stands in the river.
  for(const z of [-5,5])b.cylinder(25,6,RIDE.end-40+z,.6,12,.6,0xd8352a);
  b.part('solid',25,12.3,RIDE.end-40,1.2,.8,15,0xd8352a);b.part('solid',25,10.6,RIDE.end-40,.8,.5,12,0xd8352a);kit.halo(g,25,9,RIDE.end-40,30,'#ff5a4a',.3);
  // A distant arcology on a ridge keeps it futurist.
  b.part('solid',-260,160,RIDE.end-380,40,160,40,0x232a44);for(let k=0;k<16;k++)b.part('lit',-260,90+k*9,RIDE.end-380+20.3,36,.5,.2,k%2?0x46f5ff:0xff32b5);
  // Sakuragawa: platform, canopy, signs, a riverside deck and an unstaffed station office.
  const E=RIDE.end;
  b.part('matte',5.55,.3,E,7.3,1.6,48,0x6e6a72);b.part('lit',2.2,1.11,E,.3,.01,46,0xffd23a);
  b.part('matte',12,.3,E,6,1.6,16,0x5d4a3e);for(let z=E-7.8;z<=E+7.8;z+=.4)b.part('matte',15,1.6,z,.06,1,.06,0x3a2a24);b.part('lit',15,2.1,E,.06,.04,16,0xffb24a);
  b.part('clear',5.6,4.7,E,7.6,.08,30);for(let z=E-14;z<=E+14;z+=7){b.part('solid',8.8,2.9,z,.12,3.6,.12,0xc9d3dc);b.part('lit',5.6,4.62,z,7,.03,.1,0xbfe9ff);}
  b.part('lit',2.05,4.4,E,.06,.06,30,0xff32b5);
  kit.sign(g,2.1,3.9,E,['桜川駅','SAKURAGAWA STATION'],'#ff9ad5',6,1.2,-Math.PI/2);
  kit.sign(g,8.7,3.6,E+8,['無人駅','UNSTAFFED STATION'],'#46f5ff',3,.7,-Math.PI/2);
  kit.sign(g,5.5,2.6,E-23.9,['中央行き','FOR THE CITY · CHUO'],'#46f5ff',3.6,.8,0);
  b.part('solid',8.4,2,E+10,1.1,2,2,0x2a3340);b.part('lit',7.83,2.2,E+10,.02,1.1,1.4,0xff9ad5);
  for(const z of [E-6,E+3])b.part('matte',7.8,1.55,z,.6,.12,2.2,0x8a6b4f);
  b.part('matte',8,2.5,E-18,2,2.8,4,0xe8e2d8);b.part('lit',6.98,2.4,E-18,.03,1.2,2.6,0xffd9a0);b.part('matte',8,4.1,E-18,2.6,.3,4.6,0x2a2430,0,-.15);
  kit.halo(g,5.6,4,E,26,'#ff9ad5',.18);
  // A parked train for the return, with its own boarding target.
  const train=new THREE.Group();train.position.set(0,RIDE.floor,E);g.add(train);const body=[],lit=[];
  for(let car=-1;car<=1;car++){const c=car*12.1;body.push({x:0,y:1.65-1.1+.0,z:c,w:3.3,h:3.3,d:11.8,colour:0xe6ecf2});lit.push({x:1.66,y:.0,z:c,w:.02,h:.12,d:11.8,colour:0x46f5ff});for(let w=-4.4;w<=4.4;w+=2.2)lit.push({x:1.66,y:1,z:c+w,w:.02,h:.95,d:1.7,colour:0xbfe9ff});}
  kit.batch(train,kit.box,kit.materials.solid,body);kit.batch(train,kit.box,kit.materials.lit,lit);
  interactive({id:'train-home',object:train,jp:'乗車',en:'Board the train back to the city'});
  kit.batch(g,kit.ball,sakura,blossoms);
  b.finish(g);
  // Falling petals follow the camera.
  const count=500,positions=new Float32Array(count*3),petalGeometry=keep(new THREE.BufferGeometry());
  for(let i=0;i<count;i++)positions.set([(r()-.5)*60,r()*20,(r()-.5)*60],i*3);
  petalGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const petalCanvas=document.createElement('canvas');petalCanvas.width=petalCanvas.height=32;const pc=petalCanvas.getContext('2d');pc.fillStyle='#ffc2dd';pc.beginPath();pc.ellipse(16,16,12,7,.6,0,Math.PI*2);pc.fill();
  const petals=new THREE.Points(petalGeometry,keep(new THREE.PointsMaterial({size:.16,map:keep(new THREE.CanvasTexture(petalCanvas)),transparent:true,depthWrite:false,color:0xffd2e6})));scene.add(petals);
  // The cab the rider sits in: a big front window, side glass, seats and a next-stop display.
  const cab=new THREE.Group(),cb=kit.builder();
  cb.part('matte',0,-.05,1.6,3.1,.1,4,0x2a2f3a);cb.part('matte',0,2.45,1.6,3.1,.1,4,0xdfe5ec);cb.part('lit',0,2.38,1.6,.3,.02,3.6,0xe8f6ff);
  for(const x of [-1.55,1.55]){cb.part('matte',x,.45,1.6,.08,.9,4,0xcfd6de);cb.part('clear',x,1.55,1.6,.04,1.3,3.6);cb.part('matte',x,2.3,1.6,.08,.3,4,0xcfd6de);cb.part('solid',x*.8,1.95,1.6,.03,.03,3.6,0xb7c3cf);cb.part('matte',x*.75,.45,2.6,.6,.12,1.6,0x2b4c6e);}
  cb.part('clear',0,1.35,-.4,3.1,2.5,.04);for(const x of [-1.5,1.5])cb.part('lit',x,1.2,-.4,.05,2.4,.05,0x46f5ff);cb.part('lit',0,2.45,-.4,3,.05,.05,0x46f5ff);
  cb.part('matte',0,.45,-.25,3.1,.9,.3,0x1d222c);cb.part('lit',0,.92,-.12,2.6,.02,.1,0xff32b5);
  cb.finish(cab);
  const out=kit.sign(cab,0,2.15,3.5,['次は 桜川','NEXT · SAKURAGAWA'],'#ffb51b',1.8,.36,Math.PI);
  const back=kit.sign(cab,0,2.15,3.5,['次は 中央','NEXT · CHUO STATION'],'#ffb51b',1.8,.36,Math.PI);
  const pole=kit.builder();pole.part('solid',.9,1.2,2.8,.04,2.4,.04,0xb7c3cf);pole.finish(cab);
  scene.add(cab);cab.visible=false;
  // Ride sampler: where the cab is at time t (seconds) of a ride in either direction.
  function ride(direction,t){
    const k=ease(Math.min(1,Math.max(0,t/RIDE.duration)));
    const z=direction==='out'?RIDE.start+(RIDE.end-17.8-RIDE.start)*k:(RIDE.end+17.8)+(RIDE.start-(RIDE.end+17.8))*k;
    return {x:0,y:RIDE.floor,z,yaw:direction==='out'?0:Math.PI,done:t>=RIDE.duration};
  }
  function setCab(state,direction){
    cab.visible=true;cab.position.set(state.x,state.y,state.z);cab.rotation.y=state.yaw;out.visible=direction==='out';back.visible=direction!=='out';
  }
  function tick(time,camera,dt){
    river.material.uniforms.time.value=time;
    const p=petalGeometry.attributes.position.array;
    for(let i=0;i<count;i++){p[i*3+1]-=dt*(.6+(i%7)*.08);p[i*3]+=Math.sin(time+i)*dt*.3;if(p[i*3+1]<-1)p[i*3+1]+=20;}
    petalGeometry.attributes.position.needsUpdate=true;petals.position.set(camera.position.x,camera.position.y-6,camera.position.z);
    sky.position.copy(camera.position);
  }
  return {scene,cab,ride,setCab,tick,train,eye:EYE};
}
