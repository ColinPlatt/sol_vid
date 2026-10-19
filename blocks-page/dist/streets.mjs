// The city grid: districts, street segments, junctions and streaming around the walker.
// Segment space: the street runs along -z from one junction (z=0) to the next (z=-PITCH); sides are x<0 and x>0.
import {PITCH,FACADE,FORWARD} from './walker.mjs';
import {NEON,SHOPS,SMALL,ADS,rng,hash,pick} from './kit.mjs';
import {buildRamen,buildGallery,buildStation} from './places.mjs';

export const H=FACADE,R=2.4,CORNER=7,ZC=-PITCH/2,LEN=PITCH-2*H-2*CORNER,WALK=PITCH-2*H;
const facing=s=>-s*Math.PI/2;           // rotation for a plane flush on side s, facing the street
const UPPER=5.14,GROUND=4.84;           // frontmost facade planes above and below the awnings
const mod=(n,m)=>((n%m)+m)%m;
// Special segments host the walk-in places.
const SPECIAL={'v:0:0':{side:-1,build:buildRamen},'h:0:-1':{side:-1,build:buildGallery},'v:0:1':{side:1,build:buildStation}};
export function styleAt(i,j){
  if(Math.abs(i)<=1&&Math.abs(j)<=1)return'neon';
  return ['neon','canyon','alley','neon','canyon','alley','neon'][hash(Math.floor((i+64)/2),Math.floor((j+64)/2),7)%7];
}

export function createStreets(kit,{scene,keep,telemetry,interactive}){
  const {THREE}=kit,cableMaterial=keep(new THREE.LineBasicMaterial({color:0x2a1f3c}));
  const cache=new Map(),animated={drones:[],trains:[],steam:[],spin:[],custom:[]},places={};

  function cables(g,r,count=5,low=8){
    const points=[];
    for(let w=0;w<count;w++){
      const y=low+r()*6,z0=-H-r()*WALK,z1=z0+(r()-.5)*8,sag=.6+r()*1.4;
      for(let step=0;step<16;step++){const p=t=>new THREE.Vector3(-H+.2+t*(2*H-.4),y-Math.sin(t*Math.PI)*sag,z0+(z1-z0)*t);points.push(p(step/16),p((step+1)/16));}
    }
    const geometry=new THREE.BufferGeometry().setFromPoints(points);const line=new THREE.LineSegments(geometry,cableMaterial);g.add(line);return geometry;
  }
  function lamps(b,g,s){
    for(const z of [ZC-14,ZC,ZC+14]){
      b.part('solid',s*2.15,2.4,z,.07,4.8,.07,0x56707e);b.part('solid',s*1.62,4.76,z,1.1,.06,.06,0x56707e);
      b.part('lit',s*1.15,4.7,z,.5,.05,.18,0xcff3ff);kit.halo(g,s*1.15,4.55,z,2.6,'#9ff7ff',.45);
    }
  }
  function pavement(b,g,r,style){
    for(const s of [-1,1]){
      b.part('solid',s*(R+H)/2,.06,-PITCH/2,H-R,.12,WALK,style==='alley'?0x4a4450:0x3e4a5a);
      b.part('lit',s*R,.125,-PITCH/2,.05,.02,WALK,style==='canyon'?0x6fe3ff:0x09c0d8);
      b.part('solid',s*3.1,.125,-PITCH/2,.2,.012,WALK,0x8a815c);
      lamps(b,g,s);
    }
    for(const z of [-H-1.3,-(PITCH-H)+1.3])for(let x=-R+.35;x<R;x+=.7)b.part('solid',x,.015,z,.38,.02,1.9,0xb7c6c8);
    for(let z=-H-5;z>-(PITCH-H)+4;z-=4)b.part('lit',0,.012,z,.07,.01,1.8,0x5d5530);
  }
  // Upper facade: floor slabs, lit windows and mullions, starting above the ground floor.
  function upper(b,s,width,height,from,r,warm=.25){
    const cx=s*(H+width/2);
    for(let y=from;y<height-1;y+=2.7){
      b.part('solid',cx,y,ZC,width+.22,.13,LEN+.18,0x30364e);
      for(let z=ZC-LEN/2+1.3;z<=ZC+LEN/2-1.3;z+=2.1){
        b.part('lit',s*(H-.11),y+1.1,z,.025,.8,1.6,r()>.3?(r()>warm?0x28709e:0xff7e8c):0x243b50);
        b.part('solid',s*(H-.2),y+1.3,z+1.05,.15,2.5,.06,0x5a7482);
      }
    }
  }
  function blade(b,g,s,y,z,pair,colour,w=1.15,h=3.4){
    b.part('solid',s*(UPPER-w/2),y+h/2+.08,z,w,.09,.09,0x24233c);
    kit.sign(g,s*(UPPER-.06-w/2),y,z,pair,colour,w,h);kit.halo(g,s*(UPPER-w/2),y,z,h*1.25,colour,.4);
  }
  function hanging(g,s,y,z,pair,colour,w=1.5,h=.52){kit.sign(g,s*(UPPER-.06-w/2),y,z,pair,colour,w,h);}
  function flush(g,s,y,z,pair,colour,w,h,front=UPPER){return kit.sign(g,s*(front+.01),y,z,pair,colour,w,h,facing(s));}
  function people(b,s,r,count=2){
    for(let n=0;n<count;n++){
      const x=s*(3.5+r()*.9),z=-H-2-r()*(WALK-4),coat=pick(r,[0x352a51,0x295367,0x5a2a3a,0x2b3c2a]);
      b.part('solid',x,.95,z,.36,.7,.24,coat);b.part('solid',x,1.48,z,.22,.25,.22,0x9d6c88);
      for(const leg of [-1,1])b.part('solid',x+leg*.1,.43,z,.11,.52,.14,0x17203b);
      if(r()>.4){b.part('solid',x+.22,1.3,z,.025,1.4,.025,0x8491a6);b.part('solid',x,1.98,z,.95,.1,.8,pick(r,[0x923c81,0x277087,0x8f6a1d]));b.part('lit',x,1.99,z+.41,.93,.025,.03,pick(r,[0xff50c5,0x48eaff,0xffc14a]));}
    }
  }
  function vending(b,s,z,colour=0x9ed4d7){
    b.part('solid',s*4.6,.9,z,.65,1.8,.75,0x283c4e);b.part('lit',s*4.26,1.1,z,.02,1.15,.6,colour);
    for(let yy=0;yy<3;yy++)for(let zz=0;zz<4;zz++)b.part('lit',s*4.24,.78+yy*.28,z-.24+zz*.16,.02,.11,.07,yy%2?0xf0c39a:0xbce5ec);
  }
  function neonSide(b,g,s,r,opt={}){
    const width=opt.width??8+r()*2.5,height=opt.height??22+r()*22,cx=s*(H+width/2),kind=Math.floor(r()*3);
    const accent=pick(r,NEON),second=pick(r,NEON),from=opt.from??4.6;
    if(!opt.custom){b.part('glass',cx,height/2,ZC,width,height,LEN,kind===1?0x243a49:0x192d40);b.part('solid',s*5.15,2.1,ZC,.3,4.2,LEN,0x223745);}
    upper(b,s,width,height,from,r);
    if(kind===0)for(let rib=ZC-LEN/2+.6;rib<ZC+LEN/2;rib+=1.2)b.part('solid',s*5.42,(height+from)/2,rib,.32,height-from,.16,0x454363);
    b.part('solid',cx,height+.15,ZC,width+.5,.3,LEN+.5,0x82939c);
    if(!opt.custom){
      // Four lit shopfronts with names under a continuous awning.
      for(let bay=0;bay<4;bay++){
        const zz=ZC-7.5+bay*5,shop=pick(r,SHOPS),colour=bay%2?accent:second;
        b.part('lit',s*4.96,1.85,zz,.03,2.5,3.9,pick(r,[0x057f98,0x9d185c,0x5a2a9d,0x8a5a12]));
        b.part('solid',s*4.9,1.9,zz+2.5,.12,3.2,.12,0x101e28);
        for(let shelf=0;shelf<3;shelf++)b.part('lit',s*4.89,1+shelf*.6,zz,.035,.035,3.3,0xffb74e);
        flush(g,s,3.1,zz,shop,colour,3.4,.66,GROUND);
        if(r()>.5)kit.sign(g,s*(GROUND-.06),1.4,zz+1.4,pick(r,SMALL),colour,.9,.36,facing(s));
      }
      b.part('solid',s*4.4,3.65,ZC,2.8,.16,LEN,0x78909b);b.part('lit',s*3.02,3.57,ZC,.035,.03,LEN,new THREE.Color(accent).getHex());
      for(let z=ZC-LEN/2+1;z<ZC+LEN/2;z+=2.6){b.part('lit',s*3.4,2.95,z,.28,.5,.28,0xff4a61);b.part('solid',s*3.4,3.35,z,.02,.3,.02,0x262039);}
    }
    // Stacked blade signs, hanging plates and upper adverts, all clear of the facade.
    const levels=Math.min(3,Math.floor((height-6)/4));
    [ZC+3.5,ZC-2.5,ZC-8].slice(0,levels).forEach((z,level)=>blade(b,g,s,6.4+level*3.8,z,pick(r,SHOPS),level%2?second:accent));
    for(const z of [ZC-5,ZC,ZC+5])hanging(g,s,4.55+r()*1.1,z,pick(r,SMALL),pick(r,NEON));
    for(const z of [ZC-6.4,ZC+1.2])if(height>20&&r()>.35)hanging(g,s,17+r()*4,z,pick(r,SHOPS),pick(r,NEON),2.2,1.05);
    if(r()>.45)kit.screen(g,s*(UPPER+.02),17+r()*4,ZC+(r()-.5)*6,3.4,4.6,facing(s),Math.floor(r()*3));
    else flush(g,s,13.8,ZC+(r()-.5)*4,pick(r,ADS),second,7,2.2);
    for(let strip=0;strip<3;strip++)b.part('lit',s*5.2,10+strip*6,ZC+LEN/2-1.2,.06,4.6,.12,new THREE.Color(accent).getHex());
    for(let n=0;n<5;n++){const z=ZC+(r()-.5)*(LEN-2),y=5.6+Math.floor(r()*3)*2.7;if(Math.min(...[ZC+3.5,ZC-2.5,ZC-8].map(q=>Math.abs(q-z)))>.9)b.part('solid',s*5.0,y,z,.42,.5,.85,0x4a526c);}
    // A rooftop billboard faces down the street.
    kit.sign(g,cx,height+1.75,ZC+LEN/2-.7,pick(r,ADS),pick(r,NEON),width-.8,(width-.8)/3.2);
    b.part('solid',cx,height+.45,ZC+LEN/2-.7,.12,.6,.12,0x30364e);
    if(!opt.custom){vending(b,s,-H-2.4,pick(r,[0x9ed4d7,0xff9ad5,0xfff09a]));people(b,s,r,2);}
  }
  function canyonSide(b,g,s,r){
    const width=10,height=45+r()*40,cx=s*(H+width/2),accent=pick(r,NEON);
    b.part('glass',cx,height/2,ZC,width,height,LEN,pick(r,[0x18304a,0x1d2c44,0x22324a]));
    for(let y=4.8;y<height;y+=3.4)b.part('lit',s*(H-.08),y,ZC,.03,.16,LEN-.6,r()>.2?0x2f6f9c:0xe9a35b);
    for(let z=ZC-LEN/2+.8;z<ZC+LEN/2;z+=1.6)b.part('solid',s*(H-.16),height/2+2.4,z,.1,height-4.8,.08,0x6a8696);
    b.part('lit',s*5.0,2.2,ZC,.04,3.9,LEN-4,0x8adff0);b.part('solid',s*5.1,4.45,ZC,.5,.5,LEN,0x9db3bd);
    for(let z=ZC-LEN/2+2;z<ZC+LEN/2;z+=4)b.part('solid',s*4.9,2.2,z,.14,4.2,.14,0xc6d2d8);
    kit.screen(g,s*(UPPER+.04),17,ZC+(r()-.5)*4,9,12,facing(s),Math.floor(r()*3));
    kit.sign(g,s*(UPPER+.03),34,ZC+LEN/2-2,pick(r,ADS),accent,2.2,12,facing(s));
    blade(b,g,s,8.5,ZC-7,pick(r,SHOPS),accent,1.6,5.4);
    flush(g,s,5.3,ZC,pick(r,ADS),pick(r,NEON),8,1.1);
    b.part('solid',cx,height+.2,ZC,width+.4,.4,LEN+.4,0x9aa9b4);
    for(let n=0;n<6;n++)b.part('lit',cx+(r()-.5)*width*.8,height+.5+r()*2,ZC+(r()-.5)*LEN*.8,.12,.12,.12,0xff3355);
    people(b,s,r,1);
  }
  function alleySide(b,g,s,r){
    const width=8,height=9+r()*6,cx=s*(H+width/2),wood=pick(r,[0x3a2a24,0x2f2630,0x41312a]);
    b.part('matte',cx,height/2,ZC,width,height,LEN,wood);
    for(let z=ZC-LEN/2+.3;z<ZC+LEN/2;z+=.5)b.part('matte',s*(H-.04),height/2+2.3,z,.06,height-4.6,.07,0x5d4436);
    for(let y=5.2;y<height-1;y+=3)for(let z=ZC-LEN/2+1.6;z<ZC+LEN/2;z+=3.2){
      b.part('lit',s*(H-.07),y+.6,z,.03,1,1.6,r()>.25?0xffb56b:0x4a2f2a);
      for(let k=-2;k<=2;k++)b.part('matte',s*(H-.12),y+.6,z+k*.32,.03,1.05,.05,0x2a1d18);
      b.part('solid',s*(H-.45),y-.15,z,.9,.06,1.9,0x5c6470);
    }
    // Eaves, izakaya fronts with noren, rows of red lanterns and a few vending machines.
    b.part('matte',s*(H-.45),height+.2,ZC,1.6,.18,LEN+.4,0x231c22,0,s*.18);
    for(let bay=0;bay<3;bay++){
      const zz=ZC-6.5+bay*6.5,shop=pick(r,[['居酒屋','IZAKAYA'],['焼鳥','YAKITORI'],['酒','SAKE'],['屋台','STREET FOOD'],['喫茶','CAFE'],['餃子','GYOZA']]);
      b.part('lit',s*(H-.05),1.6,zz,.03,2.4,4,0xffa04a);b.part('matte',s*(H-.1),3.3,zz,.2,1,5.2,0x2a1d18);
      kit.sign(g,s*(H-.16),2.45,zz,[shop[0],''],'#fff',2.6,.75,facing(s),'noren');
      kit.sign(g,s*(H-.18),3.3,zz,shop,pick(r,['#ffb51b','#ff4d5e','#ffd9a0']),3.6,.62,facing(s),'plain');
      kit.sign(g,s*(H-.75),5.2,zz+2.4,shop,pick(r,NEON),.8,2.6);
    }
    for(let z=ZC-LEN/2+.9;z<ZC+LEN/2;z+=1.7){b.ball(s*3.85,3.1,z,.26,.34,.26,0xff3b30,true);b.part('solid',s*3.85,3.5,z,.02,.3,.02,0x1b1414);}
    kit.halo(g,s*3.85,3.1,ZC,9,'#ff3b30',.35);
    vending(b,s,ZC+LEN/2+1.3);vending(b,s,ZC+LEN/2+2.2,0xff9ad5);
    for(let n=0;n<4;n++)b.ball(s*(4.6+r()*.4),.35,-H-2-r()*(WALK-4),.35,.4,.35,0x2d5a3a);
    people(b,s,r,2);
  }
  function parkSide(b,g,s,r){
    b.part('matte',s*(H+6),.02,-PITCH/2,12,.04,WALK,0x18261f);
    b.part('matte',s*H,.45,ZC-6,.3,.9,LEN-8,0x5a5d63);b.part('matte',s*H,.45,ZC+6,.3,.9,LEN-8,0x5a5d63);
    const red=0xd8352a;
    for(const z of [ZC-1.6,ZC+1.6])b.cylinder(s*(H+1.2),2.2,z,.16,4.4,.16,red);
    b.part('solid',s*(H+1.2),4.45,ZC,.35,.25,4.6,red);b.part('solid',s*(H+1.2),3.85,ZC,.25,.18,3.6,red);
    for(let k=0;k<6;k++)b.part('matte',s*(H+2+k*1.3),.05,ZC,.9,.04,1.4,0x8a8d93);
    b.part('matte',s*(H+9.5),1.2,ZC,3,2.4,3,0x3a2a24);b.part('matte',s*(H+9.5),2.7,ZC,3.6,.3,3.8,0x231c22,0,s*.2);
    for(const z of [ZC-1.8,ZC+1.8]){b.part('matte',s*(H+8),.6,z,.4,1.2,.4,0x7b7e85);b.part('lit',s*(H+8),1.1,z,.3,.25,.3,0xffc06a);}
    for(let n=0;n<9;n++){
      const x=s*(H+2+r()*10),z=ZC+(r()-.5)*(LEN+10);if(Math.abs(z-ZC)<2.5&&Math.abs(x)<H+11)continue;
      b.part('matte',x,1.4,z,.18,2.8,.18,0x3a2a24);
      for(let k=0;k<5;k++)b.ball(x+(r()-.5)*1.8,3+r()*1.3,z+(r()-.5)*1.8,.8+r()*.6,.6+r()*.4,.8+r()*.6,pick(r,[0xffa6cf,0xff8cc0,0xffc2dd]),true);
    }
    kit.halo(g,s*(H+5),3,ZC,14,'#ff7ab8',.25);
    kit.sign(g,s*(H+.4),1.4,ZC+4.5,['桜公園','SAKURA PARK'],'#ff9ad5',2.2,.7,facing(s));
  }
  function extras(b,g,r,style,key){
    // Footbridges, market gates, drones and an elevated railway vary the walk.
    if(style!=='alley'&&r()>.55){
      b.part('solid',0,6.9,ZC+8,2*H-.1,.3,3.1,0x718d9c);b.part('glass',0,7.8,ZC+8,2*H-.2,1.55,3,0x37505d);b.part('solid',0,8.65,ZC+8,2*H+.1,.15,3.3,0x9db0b7);
      b.part('lit',0,7.3,ZC+9.56,2*H-.6,.07,.025,0xff25bc);kit.sign(g,0,7.85,ZC+9.6,pick(r,ADS),pick(r,NEON),7.8,1.15);kit.halo(g,0,7.8,ZC+10,8,'#ff20ad',.5);
    }
    if(style==='neon'&&r()>.5){
      kit.sign(g,0,4.85,-H-3.2,pick(r,[['深夜市場','NIGHT MARKET'],['夜の街','NIGHT TOWN'],['電脳横丁','CYBER ALLEY'],['不夜城','NIGHTLESS CITY']]),'#ffbd36',5.6,.8);
      for(const s of [-1,1]){b.part('solid',s*2.9,2.45,-H-3.2,.09,4.9,.09,0x3c304f);b.part('lit',s*2.9,4.85,-H-3.14,.09,.8,.05,0xffb51b);}
    }
    if(style==='canyon'&&telemetry&&r()>.6){const feed=new THREE.Mesh(kit.plane,telemetry);feed.position.set(0,6.4,ZC-8);feed.scale.set(6.5,1.625,1);g.add(feed);}
    if(r()>.6){
      const drone=new THREE.Group();g.add(drone);animated.drones.push({group:drone,seed:r()*10,key});
      kit.batch(drone,kit.box,kit.materials.solid,[{x:0,y:0,z:0,w:.65,h:.18,d:.42,colour:0x66748e},{x:0,y:.12,z:0,w:1.15,h:.035,d:.07,colour:0x283a56}]);
      kit.batch(drone,kit.box,kit.materials.lit,[{x:-.5,y:0,z:0,w:.15,h:.025,d:.3,colour:0xff36bb},{x:.5,y:0,z:0,w:.15,h:.025,d:.3,colour:0x00edff}]);
    }
    if(style!=='alley'&&r()>.8){
      b.part('solid',0,10.5,ZC-4,2*H+30,.35,2.6,0x526c7e);b.part('lit',0,10.75,ZC-2.7,2*H+30,.04,.04,0xa3f0e9);
      const train=new THREE.Group();train.position.set(-20,11.5,ZC-4);g.add(train);animated.trains.push({group:train,key,seed:r()*80});
      const cars=[],windows=[];for(let i=0;i<4;i++){cars.push({x:i*4,y:0,z:0,w:3.8,h:1.4,d:1.9,colour:0x8da3af});for(let w=0;w<4;w++)windows.push({x:i*4-1.3+w*.85,y:.15,z:.97,w:.48,h:.55,d:.03,colour:0xffd3a0});}
      kit.batch(train,kit.box,kit.materials.solid,cars);kit.batch(train,kit.box,kit.materials.lit,windows);
    }
  }
  function segment(orient,i,j){
    const key=orient+':'+i+':'+j,g=new THREE.Group(),r=rng(hash(orient==='v'?1:2,i,j,991)),b=kit.builder(),style=styleAt(i,j),geometries=[];
    g.position.set(i*PITCH,0,j*PITCH);if(orient==='h')g.rotation.y=-Math.PI/2;
    pavement(b,g,r,style);
    const special=SPECIAL[key];
    for(const s of [-1,1]){
      const sr=rng(hash(i,j,s,orient==='v'?3:4));
      if(special?.side===s){places[special.build.id]=special.build(kit,b,g,s,{neonSide,r:sr,animated,interactive,telemetry,keep,key});continue;}
      const park=style!=='canyon'&&hash(i,j,s,77)%9===0;
      (park?parkSide:style==='canyon'?canyonSide:style==='alley'?alleySide:neonSide)(b,g,s,sr);
    }
    extras(b,g,r,style,key);
    geometries.push(cables(g,r,style==='alley'?9:5,style==='alley'?5:8));
    const meshes=b.finish(g);
    return {group:g,meshes,geometries,pinned:Boolean(special),style,detail:special?null:detailGroup(g),centre:g.localToWorld(new THREE.Vector3(0,0,ZC))};
  }
  // Small signs and glows only render nearby, and never in the reflection pass (layer 1).
  function detailGroup(g){
    g.updateMatrixWorld(true);const detail=new THREE.Group(),small=g.children.filter(c=>c.isSprite||(c.isMesh&&!c.isInstancedMesh&&c.scale.x*c.scale.y<4.5));
    for(const child of small){detail.add(child);child.layers.set(1);}g.add(detail);return detail;
  }
  function junction(i,j){
    const g=new THREE.Group(),r=rng(hash(i,j,5150)),b=kit.builder(),style=styleAt(i,j);g.position.set(i*PITCH,0,j*PITCH);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      b.part('solid',sx*(R+H)/2,.06,sz*(R+H)/2,H-R,.12,H-R,0x3e4a5a);
      const tall=style==='canyon'?40+r()*45:style==='alley'?10+r()*5:20+r()*28,cx=sx*(H+CORNER/2),cz=sz*(H+CORNER/2);
      b.part(style==='alley'?'matte':'glass',cx,tall/2,cz,CORNER,tall,CORNER,style==='alley'?0x3a2a24:0x1c2d43);
      for(let y=4.6;y<tall-1;y+=2.9){
        b.part('lit',sx*(H-.03),y,cz,.03,.75,CORNER-.8,r()>.3?(style==='alley'?0xffb56b:0x2b6f9b):0x223348);
        b.part('lit',cx,y,sz*(H-.03),CORNER-.8,.75,.03,r()>.3?(style==='alley'?0xffb56b:0x2b6f9b):0x223348);
      }
      b.part('lit',sx*(H-.04),1.9,cz,.03,2.6,CORNER-1.4,pick(r,[0x057f98,0x9d185c,0x8a5a12]));b.part('lit',cx,1.9,sz*(H-.04),CORNER-1.4,2.6,.03,pick(r,[0x057f98,0x9d185c,0x5a2a9d]));
      b.part('lit',cx,tall+.1,cz,CORNER+.1,.12,CORNER+.1,new THREE.Color(pick(r,NEON)).getHex());
      if(r()>.35)kit.sign(g,sx*(H-.03),9+r()*8,cz,pick(r,SHOPS),pick(r,NEON),1.5,5.2,facing(sx));
      else kit.sign(g,cx,8+r()*6,sz*(H-.03),pick(r,ADS),pick(r,NEON),CORNER-1.2,2,sz>0?Math.PI:0);
      // Signals and street-name plates on the corners.
      const px=sx*(R+.3),pz=sz*(R+.3);b.part('solid',px,1.6,pz,.08,3.2,.08,0x39435a);b.part('solid',px,3.1,pz,.26,.8,.22,0x10182b);
      for(let k=0;k<3;k++)b.part('lit',px,3.33-k*.23,pz-sz*.12,.12,.12,.03,k===(hash(i,j,sx,sz)%3)?[0xff386d,0xffc13a,0x2affbd][k]:0x263344);
    }
    const avenue=streetPlate(i,true),street=streetPlate(j,false);
    kit.sign(g,R+.3,3.9,R+.3-.9,avenue,'#7ff7ff',1.7,.5,Math.PI/2);kit.sign(g,-R-.3,3.9,-R-.3+.9,street,'#ffb6e6',1.7,.5,0);
    // Wayfinding near the start: big arrows towards the walk-in places.
    const way={'0,0':[[['地下鉄 ↓','SUBWAY · SOUTH'],'#46f5ff',Math.PI,0,4.4,R+1.2],[['ラーメン ↑','RAMEN · NORTH'],'#ff4d5e',0,0,4.4,-R-1.2]],
      '0,-1':[[['ギャラリー →','GALLERY · MINT HERE'],'#ff32b5',0,0,5,R+1.2]],'1,-1':[[['ギャラリー ↑','GALLERY AHEAD'],'#ff32b5',Math.PI/2,-R-1.2,5,0]]}[i+','+j];
    for(const [pair,colour,ry,x,y,z] of way??[]){kit.sign(g,x,y,z,pair,colour,3.6,.9,ry);kit.halo(g,x,y,z,5,colour,.45);}
    for(let k=0;k<3;k++){const y=9+k*1.5+r(),pts=[];for(let s=0;s<12;s++){const p=t=>new THREE.Vector3(-H+t*2*H,y-Math.sin(t*Math.PI)*.8,-H+t*2*H);pts.push(p(s/12),p((s+1)/12));}g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),cableMaterial));}
    const meshes=b.finish(g);
    return {group:g,meshes,geometries:g.children.filter(c=>c.isLineSegments).map(c=>c.geometry),pinned:false,detail:detailGroup(g),centre:new THREE.Vector3(i*PITCH,0,j*PITCH)};
  }
  function streetPlate(n,avenue){
    const A=[['中央通り','CHUO-DORI'],['桜通り','SAKURA-DORI'],['電脳通り','DENNO-DORI'],['月見通り','TSUKIMI-DORI'],['鉄道通り','TETSUDO-DORI'],['夜市通り','YOICHI-DORI']];
    const S=[['銀河街','GINGA-GAI'],['提灯横丁','CHOCHIN ALLEY'],['雨音街','AMAOTO-GAI'],['港町','MINATO-MACHI'],['光通り','HIKARI-DORI'],['夢見坂','YUMEMI-ZAKA']];
    return (avenue?A:S)[mod(n,6)];
  }
  function get(key){
    let entry=cache.get(key);
    if(!entry){const [kind,a,b]=key.split(':'),i=Number(a),j=Number(b);entry=kind==='j'?junction(i,j):segment(kind,i,j);entry.key=key;cache.set(key,entry);}
    return entry;
  }
  function dispose(entry){
    scene.remove(entry.group);entry.group.traverse(object=>{if(object.isInstancedMesh)object.dispose();else if(object.isLineSegments)object.geometry.dispose();});
    animated.drones=animated.drones.filter(d=>d.key!==entry.key);animated.trains=animated.trains.filter(t=>t.key!==entry.key);cache.delete(entry.key);
  }
  // Load what can be seen from here: this street both ways, nearby cross streets in full, distant ones briefly.
  let lastKey='';
  function update(walker){
    const cellKey=Math.round(walker.x/4)+':'+Math.round(walker.z/4)+':'+walker.h+':'+walker.mode+':'+(walker.y<-1);
    if(cellKey===lastKey)return;lastKey=cellKey;
    const need=new Set(),RANGE=140;
    const line=(axisZ,fixedIndex,centre,range)=>{
      for(let k=Math.floor((centre-range)/PITCH);k<=Math.ceil((centre+range)/PITCH);k++){
        if(axisZ){need.add('v:'+fixedIndex+':'+(k+1));need.add('j:'+fixedIndex+':'+k);}else{need.add('h:'+k+':'+fixedIndex);need.add('j:'+k+':'+fixedIndex);}
      }
    };
    const street=walker.mode==='street'||walker.mode==='turn';
    const nearJunction=Math.min(Math.abs(walker.x-Math.round(walker.x/PITCH)*PITCH),Math.abs(walker.z-Math.round(walker.z/PITCH)*PITCH))<30;
    const headings=street&&!nearJunction&&walker.mode!=='turn'?[walker.h]:[walker.h,(walker.h+1)%4];
    const indoors=!street&&walker.place&&!walker.place.remote;
    // Underground, only the station itself; inside a shop, its own street seen through the glass.
    if(indoors&&walker.y<-1)headings.length=0;
    else if(indoors){const d=walker.place.door,axisZ=d.dir%2===1;line(axisZ,Math.round((axisZ?d.x:d.z)/PITCH),axisZ?d.z:d.x,PITCH*.8);headings.length=0;}
    for(const h of headings){
      const axisZ=h%2===0,fixed=Math.round((axisZ?walker.x:walker.z)/PITCH),c=axisZ?walker.z:walker.x;
      line(axisZ,fixed,c,RANGE);
      for(let k=Math.floor((c-RANGE)/PITCH);k<=Math.ceil((c+RANGE)/PITCH);k++){
        const d=Math.abs(k*PITCH-c);line(!axisZ,k,fixed*PITCH,d<45?RANGE-d:PITCH*.6);
      }
    }
    for(const key of Object.keys(SPECIAL))need.add(key);
    for(const key of need)get(key).needed=true;
    for(const entry of cache.values()){
      if(entry.detail)entry.detail.visible=Math.hypot(entry.centre.x-walker.x,entry.centre.z-walker.z)<(indoors?40:78);
      if(need.has(entry.key)||entry.pinned){if(!entry.group.parent)scene.add(entry.group);entry.used=performance.now();}
      else if(entry.group.parent)scene.remove(entry.group);
    }
    if(cache.size>140)[...cache.values()].filter(e=>!e.pinned&&!e.group.parent).sort((a,b)=>a.used-b.used).slice(0,cache.size-120).forEach(dispose);
  }
  function tick(time){
    for(const {group,seed} of animated.drones){group.position.set(Math.sin(time*.22+seed)*1.5,4.3+Math.sin(time*.8+seed)*.18,ZC+Math.sin(time*.16+seed)*9);group.rotation.z=Math.sin(time*.4+seed)*.06;}
    for(const {group,seed} of animated.trains)group.position.x=(time*5+seed)%90-50;
    for(const item of animated.steam){const t=(time*.35+item.seed)%1;item.sprite.position.y=item.y+t*1.3;item.sprite.material.opacity=.22*(1-t);item.sprite.scale.setScalar(.35+t*.7);}
    for(const item of animated.spin)item.object.rotation[item.axis??'y']=time*(item.speed??.6);
    for(const fn of animated.custom)fn(time);
  }
  // Pre-build the walk-in places so their lights exist from the first frame.
  for(const key of Object.keys(SPECIAL)){const entry=get(key);scene.add(entry.group);}
  return {update,tick,places,cache,animated};
}
