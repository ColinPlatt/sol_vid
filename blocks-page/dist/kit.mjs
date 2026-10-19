// Shared Three.js materials, bilingual neon sign textures and instancing helpers for the city and journey.
import * as THREE from './vendor/three.module.min.js';

export const NEON=['#00edff','#ff20ad','#b04bff','#ffb51b','#72ff78','#ff4d5e'];
// Japanese leads; English is a smaller secondary line.
export const SHOPS=[['ラーメン','RAMEN'],['居酒屋','IZAKAYA'],['カラオケ','KARAOKE'],['寿司','SUSHI'],['喫茶','CAFE'],['薬局','PHARMACY'],['書店','BOOKS'],['電気','ELECTRONICS'],
  ['ゲーセン','ARCADE'],['ホテル','HOTEL'],['焼鳥','YAKITORI'],['餃子','GYOZA'],['バー','BAR'],['古着','VINTAGE'],['修理','REPAIR'],['占い','FORTUNES'],['銭湯','BATHHOUSE'],
  ['映画','CINEMA'],['音盤','RECORDS'],['義体','CYBERWARE'],['回線','NETWORK'],['記憶','MEMORIES'],['屋台','STREET FOOD'],['麻雀','MAHJONG'],['漫画','MANGA'],
  ['診療所','CLINIC'],['酒','SAKE'],['質屋','PAWN'],['夢','DREAMS'],['未来','FUTURE'],['電脳','CYBER'],['不夜城','NIGHTLESS CITY'],['花屋','FLORIST'],['茶屋','TEA HOUSE']];
export const SMALL=[['営業中','OPEN'],['24時間','24 HOURS'],['深夜営業','OPEN LATE'],['満室','NO VACANCY'],['空室','VACANCY'],['出口','EXIT'],['駐輪場','BICYCLES'],
  ['禁煙','NO SMOKING'],['準備中','CLOSED'],['大盛','LARGE SERVING'],['半額','HALF PRICE'],['新作','NEW'],['予約','RESERVE'],['生ビール','DRAFT BEER'],['無料','FREE']];
export const ADS=[['未来へ接続','CONNECT TO TOMORROW'],['夢を見る','DREAM AWAKE'],['記憶は永遠','MEMORY IS FOREVER'],['一つのブロック','ONE BLOCK, ONE NIGHT'],['電脳都市','CYBER CITY'],
  ['新しい義体','NEW BODY, NEW YOU'],['雨のち晴れ','RAIN, THEN CLEAR'],['終電のあと','AFTER THE LAST TRAIN'],['眠らない街','THE CITY NEVER SLEEPS']];

export function rng(seed){let s=(seed>>>0)||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export const hash=(...n)=>{let h=2166136261;for(const v of n){h=Math.imul(h^(v|0),16777619);h^=h>>>13;}return h>>>0;};
export const pick=(r,list)=>list[Math.floor(r()*list.length)%list.length];

export function createKit(keep){
  const box=keep(new THREE.BoxGeometry(1,1,1)),plane=keep(new THREE.PlaneGeometry(1,1));
  const ball=keep(new THREE.IcosahedronGeometry(1,1)),cone=keep(new THREE.ConeGeometry(1,1,7)),cylinder=keep(new THREE.CylinderGeometry(1,1,1,12));
  const materials={
    solid:keep(new THREE.MeshStandardMaterial({roughness:.5,metalness:.3})),
    glass:keep(new THREE.MeshStandardMaterial({roughness:.2,metalness:.75})),
    lit:keep(new THREE.MeshBasicMaterial({toneMapped:false})),
    matte:keep(new THREE.MeshStandardMaterial({roughness:.9,metalness:0})),
    clear:keep(new THREE.MeshStandardMaterial({color:0x8fd8ff,roughness:.05,metalness:.3,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}))
  };
  const dummy=new THREE.Object3D(),colour=new THREE.Color();
  function batch(group,geometry,material,items){
    if(!items.length)return null;
    const mesh=new THREE.InstancedMesh(geometry,material,items.length);
    items.forEach((item,i)=>{
      dummy.position.set(item.x,item.y,item.z);dummy.scale.set(item.w,item.h,item.d);
      dummy.rotation.set(item.rx||0,item.ry||0,item.rz||0);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,colour.set(item.colour));
    });
    mesh.computeBoundingSphere();group.add(mesh);return mesh;
  }
  // A builder collects boxes by material, then emits one instanced mesh per material.
  function builder(){
    const lists={solid:[],glass:[],lit:[],matte:[],clear:[]},balls=[],cones=[],cylinders=[];
    const b={lists,
      part:(list,x,y,z,w,h,d,colour,ry=0,rz=0,rx=0)=>lists[list].push({x,y,z,w,h,d,colour,ry,rz,rx}),
      ball:(x,y,z,w,h,d,colour,lit=false)=>balls.push({x,y,z,w,h,d,colour,lit}),
      cone:(x,y,z,w,h,d,colour,lit=false)=>cones.push({x,y,z,w,h,d,colour,lit}),
      cylinder:(x,y,z,w,h,d,colour,lit=false)=>cylinders.push({x,y,z,w,h,d,colour,lit}),
      finish(group){
        const meshes=[];for(const [name,items] of Object.entries(lists))meshes.push(batch(group,box,materials[name],items));
        for(const [geometry,items] of [[ball,balls],[cone,cones],[cylinder,cylinders]]){
          meshes.push(batch(group,geometry,materials.matte,items.filter(i=>!i.lit)),batch(group,geometry,materials.lit,items.filter(i=>i.lit)));
        }
        return meshes.filter(Boolean);
      }};
    return b;
  }
  // Soft additive glows.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const g=glowCanvas.getContext('2d'),gradient=g.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,.55)');gradient.addColorStop(.18,'rgba(255,255,255,.1)');gradient.addColorStop(1,'transparent');
  g.fillStyle=gradient;g.fillRect(0,0,64,64);
  const glowMap=keep(new THREE.CanvasTexture(glowCanvas)),glows=new Map();
  function glowMaterial(colour,opacity=.85){
    const key=colour+opacity;
    if(!glows.has(key))glows.set(key,keep(new THREE.SpriteMaterial({map:glowMap,color:colour,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity})));
    return glows.get(key);
  }
  function halo(group,x,y,z,size,colour='#00eaff',opacity){const s=new THREE.Sprite(glowMaterial(colour,opacity));s.position.set(x,y,z);s.scale.set(size,size,1);group.add(s);return s;}
  // Bilingual sign textures: a large Japanese line with a small English translation underneath.
  const signs=new Map();
  const font=(weight,size)=>`${weight} ${size}px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif`;
  function signMaterial([jp,en],colour,ratio,styleName='neon'){
    const r=Math.max(.15,Math.min(8,Math.round(ratio*8)/8)),key=jp+en+colour+r+styleName;if(signs.has(key))return signs.get(key);
    const c=document.createElement('canvas');[c.width,c.height]=r>=1?[r>3.2?1024:512,Math.round((r>3.2?1024:512)/r)]:[Math.round(512*r),512];
    const ctx=c.getContext('2d'),W=c.width,H=c.height;
    const vertical=r<.62,paper=styleName==='noren'||styleName==='lantern',plain=styleName==='plain';
    ctx.fillStyle=paper?(styleName==='noren'?'#7c1022':'#c8302c'):plain?'#05070d':'#0d0920';ctx.fillRect(0,0,W,H);
    const ink=paper?'#fff3e2':colour;
    if(!paper&&!plain){ctx.strokeStyle=colour;ctx.lineWidth=Math.max(4,W/90);ctx.shadowColor=colour;ctx.shadowBlur=18;ctx.strokeRect(7,7,W-14,H-14);}
    ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=paper?'transparent':colour;
    if(vertical){
      const chars=[...jp],en_h=en?H*.12:0,cell=Math.min(W*.8,(H-en_h-30)/chars.length);
      ctx.font=font(800,cell*.9);ctx.shadowBlur=16;
      chars.forEach((ch,i)=>ctx.fillText(ch,W/2,18+cell*(i+.5)));
      if(en){ctx.shadowBlur=4;ctx.globalAlpha=.78;ctx.font=`700 ${Math.min(W*.16,(W-16)/(en.length*.62))}px monospace`;ctx.fillText(en,W/2,H-en_h/2-10);ctx.globalAlpha=1;}
    }else{
      const big=H*(en?.5:.62);ctx.font=font(800,big);ctx.shadowBlur=18;ctx.fillText(jp,W/2,en?H*.4:H/2,W*.9);
      if(en){ctx.shadowBlur=4;ctx.globalAlpha=.78;ctx.font=`700 ${H*.15}px monospace`;ctx.fillText(en.split('').join(String.fromCharCode(8202)),W/2,H*.8,W*.88);ctx.globalAlpha=1;}
    }
    if(!paper){ctx.shadowBlur=0;ctx.globalAlpha=.1;ctx.fillStyle=colour;for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);}
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const material=keep(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));signs.set(key,material);return material;
  }
  function sign(group,x,y,z,pair,colour,w,h,ry=0,style){
    const mesh=new THREE.Mesh(plane,signMaterial(pair,colour,w/h,style));mesh.position.set(x,y,z);mesh.scale.set(w,h,1);mesh.rotation.y=ry;group.add(mesh);return mesh;
  }
  // Procedural advert screens animate without media files.
  const adMaterials=[0,1,2].map(kind=>keep(new THREE.ShaderMaterial({
    uniforms:{time:{value:0}},side:THREE.DoubleSide,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time;
      void main(){vec2 p=vUv-.5;vec3 c;
        ${kind===0?'float r=length(p*vec2(1.,1.4));float rings=pow(.5+.5*cos(r*60.-time*1.5),14.);float eye=1.-smoothstep(.08,.1,length(p*vec2(.9,2.)));c=mix(vec3(.03,.01,.12),vec3(.95,.06,.65),rings*.7)+vec3(.05,.8,.95)*eye;'
        :kind===1?'float wave=sin(p.x*18.+time*2.)*.08+sin(p.x*7.-time)*.05;float band=smoothstep(.02,0.,abs(p.y-wave));float grid=step(.96,fract(vUv.x*24.))+step(.96,fract(vUv.y*14.-time*.3));c=vec3(.02,.03,.1)+vec3(.1,.95,1.)*band+vec3(.25,.05,.4)*grid;'
        :'float t=time*.4;vec2 q=p*3.;float v=sin(q.x+t)+sin(q.y*1.3-t)+sin((q.x+q.y)*.9+t*1.7);c=.5+.5*cos(v+vec3(0.,2.1,4.2));c*=vec3(1.,.35,.9);c=pow(c,vec3(1.6));'}
        c+=vec3(.04,.06,.1)*step(.92,fract(vUv.y*70.));
        float edge=step(.02,vUv.x)*step(vUv.x,.98)*step(.015,vUv.y)*step(vUv.y,.985);gl_FragColor=vec4(mix(vec3(.05,.9,1.),c,edge),1.);}`
  })));
  function screen(group,x,y,z,w,h,ry=0,kind=0){const m=new THREE.Mesh(plane,adMaterials[kind%3]);m.position.set(x,y,z);m.scale.set(w,h,1);m.rotation.y=ry;group.add(m);return m;}
  return {THREE,box,plane,ball,cone,cylinder,materials,batch,builder,halo,glowMaterial,sign,signMaterial,screen,adMaterials};
}
