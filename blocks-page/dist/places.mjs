// Walk-in places built into their street segments: a ramen shop, the gallery (mint) and the subway station (wallet).
// Segment space: x=s*a is depth from the street centre, z=ZC+b runs along the street.
import {PITCH,FACADE} from './walker.mjs';
const H=FACADE,ZC=-PITCH/2,LEN=PITCH-2*H-14;

function shell(b,A,Z,{depth,width,height,floor,wall,ceiling,side}){
  b.part(floor[0],A(H+depth/2),.03,ZC,depth,.06,width,floor[1]);
  b.part('matte',A(H+depth/2),height+.1,ZC,depth+.2,.2,width+.2,ceiling);
  b.part('matte',A(H+depth+.1),height/2,ZC,.2,height,width+.2,wall);
  for(const e of [-1,1])b.part('matte',A(H+depth/2),height/2,Z(e*(width/2+.1)),depth+.2,height,.2,side??wall);
}
function storeys(b,A,Z,{bw,top,from,width,colour}){
  b.part('glass',A(H+bw/2),(from+top)/2,ZC,bw,top-from,LEN,colour);
  const sliver=(LEN-width)/2;
  if(sliver>.05)for(const e of [-1,1])b.part('solid',A(H+bw/2),from/2,Z(e*(width/2+sliver/2)),bw,from,sliver,0x2a2430);
}
function light(kit,g,colour,intensity,distance,x,y,z){const l=new kit.THREE.PointLight(colour,intensity,distance,1.8);l.position.set(x,y,z);g.add(l);return l;}
function steam(kit,g,animated,keep,x,y,z){
  const sprite=new kit.THREE.Sprite(keep(kit.glowMaterial('#ffffff',.2).clone()));sprite.position.set(x,y,z);g.add(sprite);animated.steam.push({sprite,y,seed:Math.random()});
}

export function buildRamen(kit,b,g,s,{neonSide,r,animated,interactive,keep}){
  const {THREE}=kit,A=a=>s*a,Z=bb=>ZC+bb,ry=-s*Math.PI/2,depth=10,width=15,height=4.4;
  storeys(b,A,Z,{bw:11,top:26,from:4.6,width,colour:0x1f2a3c});
  neonSide(b,g,s,r,{custom:true,width:11,height:26,from:4.6});
  shell(b,A,Z,{depth,width,height,floor:['matte',0x2a1d18],wall:0x4a2c1c,ceiling:0x1a1210,side:0x3b2418});
  for(const e of [-1,1]){
    for(let a=H+.8;a<H+depth-.6;a+=.45)b.part('matte',A(a),height/2,Z(e*(width/2-.03)),.08,height,.04,0x6b4630);
    const pane=width/2-1.25;
    b.part('clear',A(H),1.75,Z(e*(1.25+pane/2)),.05,3.3,pane);b.part('matte',A(H),.15,Z(e*(1.25+pane/2)),.3,.3,pane,0x24161a);
    b.part('matte',A(H),1.8,Z(e*1.3),.22,3.6,.14,0x24161a);
    b.ball(A(H-.4),2.7,Z(e*2),.3,.42,.3,0xff3030,true);kit.halo(g,A(H-.4),2.7,Z(e*2),2.2,'#ff3b30',.6);
  }
  b.part('matte',A(H),4,ZC,.3,.8,width+.2,0x24161a);
  kit.sign(g,A(H-.17),4,ZC,['夜鳴きラーメン','LATE NIGHT RAMEN'],'#ff4d5e',7.2,.75,ry);
  kit.sign(g,A(H-.04),2.95,ZC,['ラーメン',''],'#fff',2.5,1.1,ry,'noren');
  kit.sign(g,A(5.14-.06-.65),7.2,Z(7),['ラーメン','RAMEN'],'#ff4d5e',1.3,3.8);kit.halo(g,A(4.4),7.2,Z(7),5,'#ff4d5e',.5);
  for(let k=0;k<5;k++)b.part('lit',A(3.6+k*.35),.13,ZC,.18,.01,.9,0xff4d5e);
  // Counter, stools, bowls, kitchen and a robot chef.
  b.part('matte',A(H+6.8),.55,ZC,.9,1.1,11,0x6b4128);b.part('matte',A(H+6.8),1.13,ZC,1.25,.07,11.4,0xc8955a);b.part('lit',A(H+6.32),.18,ZC,.03,.05,11,0xff9a3c);
  for(let bb=-4.5;bb<=4.6;bb+=1.5){b.cylinder(A(H+5.7),.74,Z(bb),.26,.08,.26,0xd23a3a);b.cylinder(A(H+5.7),.36,Z(bb),.04,.72,.04,0x9aa6b0);}
  for(const bb of [-3,0,3]){b.ball(A(H+6.8),1.22,Z(bb),.2,.09,.2,0xf2efe6);b.ball(A(H+6.8),1.27,Z(bb),.16,.02,.16,0xd88a3a,true);steam(kit,g,animated,keep,A(H+6.8),1.4,Z(bb));}
  b.part('solid',A(H+9.35),.5,ZC,1.1,1,13,0x8a99a6);b.part('lit',A(H+9.35),1.01,ZC,.9,.02,12,0xff5a1f);
  for(const bb of [-4,-1.5,1.5,4]){b.cylinder(A(H+9.35),1.25,Z(bb),.34,.5,.34,0x9aa6b0);steam(kit,g,animated,keep,A(H+9.35),1.6,Z(bb));}
  const chef=new THREE.Group();chef.position.set(A(H+8.2),0,Z(1.2));chef.rotation.y=ry;g.add(chef);
  kit.batch(chef,kit.box,kit.materials.solid,[{x:0,y:1.45,z:0,w:.62,h:.95,d:.45,colour:0xdfe6ee},{x:-.42,y:1.55,z:.15,w:.14,h:.6,d:.14,colour:0xb9c3cc},{x:.42,y:1.55,z:.15,w:.14,h:.6,d:.14,colour:0xb9c3cc},{x:0,y:.6,z:0,w:.4,h:.8,d:.35,colour:0x3c4656}]);
  const head=new THREE.Group();head.position.y=2.2;chef.add(head);
  kit.batch(head,kit.box,kit.materials.solid,[{x:0,y:0,z:0,w:.46,h:.4,d:.42,colour:0xeef2f6},{x:0,y:.38,z:0,w:.36,h:.32,d:.36,colour:0xffffff}]);
  kit.batch(head,kit.box,kit.materials.lit,[{x:0,y:.02,z:.215,w:.34,h:.09,d:.02,colour:0x46f5ff}]);
  animated.custom.push(time=>{head.rotation.y=Math.sin(time*.7)*.45;chef.position.y=Math.abs(Math.sin(time*1.4))*.03;});
  interactive({id:'chef',object:chef,jp:'いらっしゃいませ',en:'Say hello to the chef'});
  [['醤油 ¥980','SHOYU RAMEN'],['味噌 ¥1080','MISO RAMEN'],['豚骨 ¥1180','TONKOTSU'],['餃子 ¥480','GYOZA']].forEach((pair,k)=>kit.sign(g,A(H+depth-.02),3.25,Z(-5.2+k*3.47),pair,'#ffb51b',2.9,.95,ry));
  kit.sign(g,A(H+5),3.2,Z(width/2-.06),['ラーメン','RAMEN'],'#ff32b5',3.8,1.2,Math.PI);
  kit.sign(g,A(H+5),3.2,Z(-width/2+.06),['替玉無料','FREE NOODLE REFILLS'],'#46f5ff',3.8,1.2,0);
  for(const a of [2.5,5])for(const bb of [-5,-2,1,4]){b.ball(A(H+a),3.75,Z(bb),.3,.4,.3,0xffa94d,true);}
  kit.halo(g,A(H+4),3.6,ZC,9,'#ffa94d',.35);
  b.part('solid',A(H+1.1),.9,Z(-6.2),.8,1.8,.9,0xd9dde3);b.part('lit',A(H+1.1),1.2,Z(-5.74),.6,.7,.02,0x7fd6ff);
  kit.sign(g,A(H+1.1),2.05,Z(-5.72),['食券','TICKETS'],'#46f5ff',.8,.36,0);
  light(kit,g,0xffa860,18,14,A(H+5),3.7,ZC);
  return {id:'ramen'};
}
buildRamen.id='ramen';

export function buildGallery(kit,b,g,s,{neonSide,r,interactive,animated,keep}){
  const {THREE}=kit,A=a=>s*a,Z=bb=>ZC+bb,ry=-s*Math.PI/2,depth=12,width=18,height=5.4;
  storeys(b,A,Z,{bw:14,top:34,from:5.8,width,colour:0x171f33});
  neonSide(b,g,s,r,{custom:true,width:14,height:34,from:5.8});
  shell(b,A,Z,{depth,width,height,floor:['glass',0x0a0a12],wall:0x0b0b16,ceiling:0x07070c});
  for(let k=0;k<5;k++)b.part('lit',A(H+2+k*2.4),height-.02,ZC,.06,.02,17,0x9fdcff);
  b.part('lit',A(H+depth-.02),.12,ZC,.02,.05,width,0x46f5ff);b.part('lit',A(H+depth-.02),height-.12,ZC,.02,.05,width,0xff32b5);
  for(const e of [-1,1]){
    b.part('lit',A(H+depth/2),.12,Z(e*(width/2-.02)),depth,.05,.02,0x46f5ff);b.part('lit',A(H+depth/2),height-.12,Z(e*(width/2-.02)),depth,.05,.02,0xff32b5);
    const pane=width/2-1.5;b.part('clear',A(H),1.85,Z(e*(1.5+pane/2)),.05,3.5,pane);
    b.part('lit',A(H),1.8,Z(e*1.45),.12,3.6,.1,0xff32b5);
  }
  for(let k=-5;k<=5;k++)b.part('lit',A(H+6),.065,Z(k*1.6),11.5,.01,.04,k%2?0x3a2a6a:0xff32b5);
  b.part('lit',A(H),3.65,ZC,.12,.1,3,0xff32b5);b.part('matte',A(H),4.6,ZC,.3,1.8,width+.2,0x0b0b16);
  kit.sign(g,A(H-.17),4.6,ZC,['電脳ギャラリー','BLOCKS GALLERY · MINT HERE'],'#46f5ff',9,1.1,ry);
  kit.sign(g,A(5.14-.06-.8),10.5,Z(6.5),['ギャラリー','GALLERY'],'#ff32b5',1.6,6.2);kit.halo(g,A(4.3),10.5,Z(6.5),7,'#ff32b5',.5);
  kit.halo(g,A(H-.3),1.8,ZC,4.5,'#ff32b5',.5);
  for(let k=0;k<5;k++)b.part('lit',A(3.6+k*.35),.13,ZC,.18,.01,.9,0xff32b5);
  // Seven framed artworks with captions and soft spot cones.
  const boards=[],spot=keep(new THREE.MeshBasicMaterial({color:0xbfe9ff,transparent:true,opacity:.06,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  const cone=keep(new THREE.ConeGeometry(1.5,3.2,20,1,true));
  const spots=[...[-5.5,0,5.5].map(bb=>({x:A(H+depth-.04),z:Z(bb),ry})),...[-1,1].flatMap(e=>[3.5,8].map(a=>({x:A(H+a),z:Z(e*(width/2-.04)),ry:e>0?Math.PI:0})))];
  spots.forEach(({x,z,ry:rot},i)=>{
    const frame=new THREE.Group();frame.position.set(x,0,z);frame.rotation.y=rot;g.add(frame);
    const colour=i%2?0xff32b5:0x46f5ff,border=new THREE.Mesh(kit.plane,keep(new THREE.MeshBasicMaterial({color:colour,toneMapped:false})));
    border.position.set(0,2.65,.005);border.scale.set(2.5,2.5,1);frame.add(border);
    const picture=new THREE.Mesh(kit.plane,keep(new THREE.MeshBasicMaterial({toneMapped:false,color:0x101020})));picture.position.set(0,2.65,.012);picture.scale.set(2.3,2.3,1);frame.add(picture);
    const caption=document.createElement('canvas');caption.width=512;caption.height=96;
    const texture=keep(new THREE.CanvasTexture(caption));texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Mesh(kit.plane,keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));label.position.set(0,1.05,.012);label.scale.set(2.3,.43,1);frame.add(label);
    const light=new THREE.Mesh(cone,spot);light.position.set(0,3.75,1);light.rotation.x=.32;frame.add(light);
    boards.push({picture,ctx:caption.getContext('2d'),texture});
    interactive({id:'art:'+i,object:picture,jp:'作品',en:'View this artwork'});
  });
  // The mint terminal: a pedestal, a live screen and a slowly turning hologram ring.
  const terminal=new THREE.Group();terminal.position.set(A(H+6.4),0,ZC);terminal.rotation.y=ry;g.add(terminal);
  kit.batch(terminal,kit.cylinder,kit.materials.solid,[{x:0,y:.55,z:0,w:.55,h:1.1,d:.55,colour:0x1a1d2b}]);
  kit.batch(terminal,kit.cylinder,kit.materials.lit,[{x:0,y:1.12,z:0,w:.6,h:.03,d:.6,colour:0x46f5ff}]);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;
  const texture=keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(kit.plane,keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide})));
  screen.position.set(0,1.45,.25);screen.rotation.x=-.55;screen.scale.set(1.3,.81,1);terminal.add(screen);
  const ring=new THREE.Mesh(keep(new THREE.TorusGeometry(.75,.025,8,60)),keep(new THREE.MeshBasicMaterial({color:0xff32b5,toneMapped:false})));ring.position.y=2.45;terminal.add(ring);
  const ring2=ring.clone();ring2.scale.setScalar(.7);ring2.material=keep(new THREE.MeshBasicMaterial({color:0x46f5ff,toneMapped:false}));terminal.add(ring2);
  const floorRing=new THREE.Mesh(keep(new THREE.TorusGeometry(1.4,.03,6,64)),ring2.material);floorRing.rotation.x=Math.PI/2;floorRing.position.y=.08;terminal.add(floorRing);
  kit.sign(terminal,0,3.25,0,['鋳造','MINT · ONE BLOCK'],'#ff32b5',1.9,.6);
  kit.halo(terminal,0,2.4,0,3.4,'#ff32b5',.5);
  animated.custom.push(time=>{ring.rotation.set(time*.6,time*.9,0);ring2.rotation.set(-time*.8,0,time*.5);});
  interactive({id:'terminal',object:terminal,jp:'鋳造する',en:'Mint your block'});
  light(kit,g,0x9a7cff,16,18,A(H+6),4.6,ZC);
  return {id:'gallery',boards,terminal:{canvas,ctx:canvas.getContext('2d'),texture}};
}
buildGallery.id='gallery';

export function buildStation(kit,b,g,s,{neonSide,r,interactive,keep}){
  const {THREE}=kit,A=a=>s*a,Z=bb=>ZC+bb,ry=-s*Math.PI/2,F=-6;
  // Street-level entrance hall in the building's ground floor, then stairs down.
  b.part('glass',A(H+5.75),(4.6+30)/2,ZC,11.5,30-4.6,LEN,0x182a3e);
  for(const e of [-1,1])b.part('solid',A(H+5.75),2.3,Z(e*(1.6+(LEN/2-1.6)/2)),11.5,4.6,LEN/2-1.6,0x26303d);
  neonSide(b,g,s,r,{custom:true,width:11.5,height:30,from:4.6});
  b.part('matte',A(H+5.75),4.5,ZC,11.5,.2,3.4,0x1a1f2a);b.part('matte',A(6.95),.02,ZC,2.5,.04,3.2,0x2a3340);
  b.part('lit',A(H+5.75),4.38,ZC,11,.03,.12,0xd9f6ff);
  b.part('matte',A(17.05),1.5,ZC,.2,5.8,3.4,0x1a1f2a);
  kit.sign(g,A(16.92),2.4,ZC,['改札口 ↓','TO THE TICKET GATES'],'#46f5ff',2.8,.7,ry);
  const floor=a=>a<8.2?0:a<16.8?-(a-8.2)/8.6*6:F;
  for(let k=0;k<20;k++){const a=8.2+(k+.5)*.43,y=floor(a);b.part('matte',A(a),(y-6.2)/2,ZC,.43,y+6.2,2.9,0x3b4352);b.part('lit',A(a-.2),y+.01,ZC,.03,.02,2.8,0x46f5ff);}
  for(const e of [-1,1]){b.part('matte',A(12.5),-3,Z(e*1.55),8.6,6,.1,0x2b3240);for(let k=0;k<10;k++){const a=8.6+k*.85;b.part('lit',A(a),floor(a)+.95,Z(e*1.48),.4,.04,.04,0xff32b5);}}
  b.part('matte',A(H-.05),4.45,ZC,.3,.3,3.4,0x1a1f2a);
  kit.sign(g,A(H-.22),5.05,ZC,['地下鉄','SUBWAY · CHUO LINE'],'#46f5ff',4.5,.9,ry);kit.halo(g,A(H-.3),5,ZC,5,'#46f5ff',.45);
  kit.sign(g,A(5.14-.06-.75),7.5,Z(7),['地下鉄','SUBWAY'],'#46f5ff',1.5,4.6);
  b.part('solid',A(4.4),1.6,Z(2.6),.1,3.2,.1,0x56707e);kit.sign(g,A(4.4),3.5,Z(2.6),['駅','METRO'],'#46f5ff',.9,.9);kit.halo(g,A(4.4),3.5,Z(2.6),2.6,'#46f5ff',.6);
  for(let k=0;k<5;k++)b.part('lit',A(3.6+k*.35),.13,ZC,.18,.01,.9,0x46f5ff);
  // Underground concourse, ticket gates and the platform.
  b.part('matte',A(23.2),F-.05,ZC,12.8,.1,40,0x2b3442);b.part('matte',A(25.6),-1.35,ZC,17.6,.2,40.4,0x1a1f2a);
  b.part('matte',A(31.9),F-1.1,ZC,4.6,.1,120,0x15181f);b.part('matte',A(29.65),F-.6,ZC,.1,1.1,40,0x3a4250);b.part('lit',A(29.25),F+.01,ZC,.3,.01,31,0xffd23a);
  for(const a of [31.1,32.5])b.part('solid',A(a),F-1,ZC,.1,.12,120,0x9aa6b0);b.part('lit',A(31.8),F-1.03,ZC,.3,.02,120,0x46f5ff);
  b.part('matte',A(34.45),F+1.7,ZC,.2,6,120,0x1d222c);
  for(let bb=-58;bb<=58;bb+=4)b.part('lit',A(34.3),F+1.6,Z(bb),.03,.1,1.2,0xffe2a8);
  for(const e of [-1,1]){
    b.part('matte',A(29.5),F+1.8,Z(e*40),.2,6,40,0x1d222c);b.part('matte',A(31.9),-2.6,Z(e*40),5,.2,40,0x14171e);
    b.part('matte',A(23.15),F+2.3,Z(e*20.1),12.7,4.8,.2,0x2b3442);
    b.part('matte',A(21.35),F+2.3,Z(e*13.1),1.7,4.8,13.8,0x2b3442);
    b.part('matte',A(18.65),F+2.3,Z(e*7.6),3.7,4.8,.2,0x2b3442);
    b.part('matte',A(16.75),F+2.3,Z(e*4.55),.2,4.8,6.1,0x2b3442);
  }
  for(const a of [18,23,27])for(let bb=-15;bb<=15;bb+=5)b.part('lit',A(a),-1.47,Z(bb),1.6,.03,.5,0xe8f6ff);
  for(let bb=-15;bb<=15;bb+=3.4)b.part('lit',A(29.35),F+.9,Z(bb),.04,1.6,.03,0x46f5ff);
  kit.sign(g,A(34.33),F+3,Z(-8),['中央駅','CHUO STATION'],'#46f5ff',6,1.4,ry);kit.sign(g,A(34.33),F+3,Z(8),['中央駅','CHUO STATION'],'#46f5ff',6,1.4,ry);
  kit.sign(g,A(25.5),-2.3,Z(0),['桜川行き まもなく','NEXT · SAKURAGAWA · NOW BOARDING'],'#ffb51b',6,.9,ry);
  kit.sign(g,A(26),-2.4,Z(-11),['桜川方面','FOR SAKURAGAWA'],'#46f5ff',3.6,.75);
  kit.sign(g,A(20.3),-2.25,ZC,['改札','TICKET GATES · TAP TO CONNECT'],'#46f5ff',5,.8,ry);kit.sign(g,A(20.38),-2.25,ZC,['出口','EXIT · TO THE STREET'],'#ffb51b',5,.8,ry+Math.PI);
  for(let k=0;k<6;k++)kit.screen(g,A(24+k%2*3),-2.2,Z(k<3?-17:17)+(k%3-1)*2.2,1.6,.9,0,k);
  // Ticket gates: tapping one connects a wallet; the flaps open either way.
  const gates=new THREE.Group();gates.position.set(A(21.35),F,ZC);g.add(gates);const flaps=[];
  const gateCanvas=document.createElement('canvas');gateCanvas.width=256;gateCanvas.height=128;
  const gateTexture=keep(new THREE.CanvasTexture(gateCanvas));gateTexture.colorSpace=THREE.SRGBColorSpace;
  const displayMaterial=keep(new THREE.MeshBasicMaterial({map:gateTexture,toneMapped:false,side:THREE.DoubleSide}));
  const flapMaterial=keep(new THREE.MeshBasicMaterial({color:0xff3355,toneMapped:false}));
  for(const bb of [-6.2,-3.1,0,3.1,6.2]){
    kit.batch(gates,kit.box,kit.materials.solid,[{x:0,y:.52,z:bb,w:1.6,h:1.05,d:.32,colour:0xc9d3dc}]);
    kit.batch(gates,kit.box,kit.materials.lit,[{x:-s*.45,y:1.06,z:bb,w:.32,h:.02,d:.24,colour:0x46f5ff},{x:0,y:1.05,z:bb,w:1.6,h:.02,d:.04,colour:0x46f5ff}]);
    const display=new THREE.Mesh(kit.plane,displayMaterial);display.position.set(-s*.55,1.25,bb);display.rotation.y=ry;display.scale.set(.42,.21,1);gates.add(display);
    for(const e of [-1,1]){
      const lane=bb+e*.16;if(Math.abs(lane)>6.2)continue;
      const flap=new THREE.Mesh(kit.box,flapMaterial);flap.position.set(0,.8,lane+e*.36);flap.scale.set(.05,.45,.72);gates.add(flap);flaps.push({flap,z:lane,e});
    }
  }
  kit.halo(gates,0,1.2,0,6,'#46f5ff',.35);
  interactive({id:'gate',object:gates,jp:'改札',en:'Tap the gate to connect a wallet'});
  // A three-car train waits at the platform.
  const train=new THREE.Group();train.position.set(A(31.8),F,ZC);g.add(train);
  const body=[],lit=[];
  for(let car=-1;car<=1;car++){
    const c=car*12.1;body.push({x:0,y:1.65,z:c,w:3.3,h:3.3,d:11.8,colour:0xe6ecf2},{x:0,y:3.35,z:c,w:3,h:.2,d:11.6,colour:0xb7c3cf});
    lit.push({x:-s*1.66,y:1,z:c,w:.02,h:.12,d:11.8,colour:0x46f5ff});
    for(let w=-4.4;w<=4.4;w+=2.2)if(Math.abs(Math.abs(w)-3.3)>.6)lit.push({x:-s*1.66,y:2.05,z:c+w,w:.02,h:.95,d:1.7,colour:0xbfe9ff});
    for(const d of [-3.3,3.3])lit.push({x:-s*1.665,y:1.55,z:c+d,w:.02,h:2.6,d:.05,colour:0x46f5ff},{x:-s*1.665,y:1.55,z:c+d+1.3,w:.02,h:2.6,d:.05,colour:0x46f5ff},{x:-s*1.664,y:1.6,z:c+d+.65,w:.02,h:2.4,d:1.2,colour:0x9fdfff});
  }
  for(const e of [-1,1])body.push({x:0,y:1.4,z:e*19.3,w:3.1,h:2.8,d:1.6,colour:0xd5dde6});
  kit.batch(train,kit.box,kit.materials.solid,body);kit.batch(train,kit.box,kit.materials.lit,lit);
  interactive({id:'train',object:train,jp:'乗車',en:'Board the train to Sakuragawa'});
  light(kit,g,0xcfeaff,24,36,A(25),-2.2,ZC);
  return {id:'station',gates:{group:gates,flaps,canvas:gateCanvas,ctx:gateCanvas.getContext('2d'),texture:gateTexture,material:flapMaterial},train};
}
buildStation.id='station';
