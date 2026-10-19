// Street navigation on a square city grid plus walkable interiors. Pure state with no rendering,
// so routes, turns, doors and room bounds are unit tested.
export const PITCH=46,FACADE=5.7,EYE=1.68;
// Headings: 0 north (-z), 1 east (+x), 2 south (+z), 3 west (-x). Vectors are [x,z].
export const FORWARD=[[0,-1],[1,0],[0,1],[-1,0]];
export const yawOf=h=>[0,-Math.PI/2,Math.PI,Math.PI/2][h];
const CRUISE=2.3,RUN=5.6,BACK=1.6,ROUTE=7.5,EPS=1e-6;
// Cruising pauses briefly at each junction and doorway so turn-offs are obvious; holding forward runs straight past.
const STOP={junction:.9,door:1.1},BRAKE=2.4;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const mod=(n,m)=>((n%m)+m)%m;
const ease=t=>t*t*(3-2*t);

const AVENUES=[['中央通り','CHUO-DORI'],['桜通り','SAKURA-DORI'],['電脳通り','DENNO-DORI'],['月見通り','TSUKIMI-DORI'],['鉄道通り','TETSUDO-DORI'],['夜市通り','YOICHI-DORI']];
const STREETS=[['銀河街','GINGA-GAI'],['提灯横丁','CHOCHIN ALLEY'],['雨音街','AMAOTO-GAI'],['港町','MINATO-MACHI'],['光通り','HIKARI-DORI'],['夢見坂','YUMEMI-ZAKA']];
// North-south avenues and east-west streets have names; the block number is the chōme.
export function streetName(x,z,h){
  const ns=h%2===0,line=Math.round((ns?x:z)/PITCH),block=Math.floor((ns?-z:x)/PITCH);
  const [jp,en]=(ns?AVENUES:STREETS)[mod(line,6)];
  return {jp,en,chome:mod(block,9)+1};
}

// Walk-in places. A door sits on a street centreline point; dir points from the street into the building.
// Areas are [a0,a1,b0,b1,flag?] in door space: a is depth from the street centre, b runs along the street.
export const REMOTE_Z=-2600;
export const PLACES={
  ramen:{id:'ramen',jp:'ラーメン',en:'Ramen shop',door:{x:0,z:-23,dir:3},depth:10,width:15,height:4.4,
    areas:[[FACADE+.7,FACADE+9.1,-6.6,6.6]]},
  gallery:{id:'gallery',jp:'ギャラリー',en:'Gallery',door:{x:23,z:-46,dir:0},depth:12,width:18,height:5.4,
    areas:[[FACADE+.7,FACADE+11.1,-8.1,8.1]]},
  // Street-level hall, stairs down, the concourse, ticket gates and the platform.
  station:{id:'station',jp:'地下鉄',en:'Subway',door:{x:0,z:23,dir:1},depth:30,width:34,
    areas:[[FACADE+.6,16.8,-1.3,1.3],[16.8,20.5,-7,7],[20.5,22.2,-6.2,6.2,'gate'],[22.2,29.3,-15.5,15.5,'gate']],
    floor:a=>a<8.2?0:a<16.8?-(a-8.2)/8.6*6:-6,gateA:20.5,board:29.25,
    inPath:[[8.2,0],[16.8,0],[18.6,0]],outPath:[[16.8,0],[8.2,0]]},
  // The rural platform at the end of the line, in the journey scene's coordinates.
  remote:{id:'remote',jp:'桜川',en:'Sakuragawa',remote:true,areas:[[2.5,9,-22,22],[9,15,-8,8]],floor:()=>1.1,boardBelow:2.6}
};
export const DOORS=Object.values(PLACES).filter(place=>place.door);
export function frameOf(place){
  if(place.remote)return {at:(a,b)=>({x:a,z:REMOTE_Z+b}),local:(x,z)=>({a:x,b:z-REMOTE_Z})};
  const door=place.door,[dx,dz]=FORWARD[door.dir],[tx,tz]=FORWARD[(door.dir+1)%4];
  return {at:(a,b)=>({x:door.x+dx*a+tx*b,z:door.z+dz*a+tz*b}),local:(x,z)=>({a:(x-door.x)*dx+(z-door.z)*dz,b:(x-door.x)*tx+(z-door.z)*tz})};
}
const floorOf=(place,a)=>place.floor?place.floor(a):0;
function doorSide(place,h){const dir=place.door.dir;return dir===(h+3)%4?'left':dir===(h+1)%4?'right':null;}
const sideHeading=(h,side)=>side==='left'?(h+3)%4:side==='right'?(h+1)%4:(h+2)%4;
const nearest=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

export class Walker{
  constructor(){Object.assign(this,{x:0,z:34,y:0,h:0,yaw:0,v:0,mode:'street',cruise:true,queued:null,anim:null,place:null,auto:null,returnH:0,gate:false,hold:0,lastStop:null,events:[]});}
  get axisZ(){return this.h%2===0;}
  sign(){const [fx,fz]=FORWARD[this.h];return this.axisZ?fz:fx;}
  coord(){return this.axisZ?this.z:this.x;}
  fixed(){return this.axisZ?this.x:this.z;}
  nextJunction(direction=this.sign()){const c=this.coord()/PITCH;return (direction>0?Math.floor(c+EPS)+1:Math.ceil(c-EPS)-1)*PITCH;}
  point(c){return this.axisZ?{x:this.fixed(),z:c}:{x:c,z:this.fixed()};}
  doorsOnLine(){return DOORS.filter(place=>doorSide(place,this.h)&&Math.abs((this.axisZ?place.door.x:place.door.z)-this.fixed())<.01);}
  // Turn points between two coordinates along the current street, in travel order.
  points(c0,c1,queued){
    const found=[],lo=Math.min(c0,c1),hi=Math.max(c0,c1),forward=c1>c0;
    const inside=c=>forward?c>c0+EPS&&c<=c1+EPS:c<c0-EPS&&c>=c1-EPS;
    if(queued.at!=='door')for(let k=Math.ceil(lo/PITCH-EPS);k*PITCH<=hi+EPS;k++)if(inside(k*PITCH))found.push({c:k*PITCH});
    if(queued.at!=='junction'&&queued.side!=='around')for(const place of this.doorsOnLine()){
      if(queued.place&&queued.place!==place.id)continue;
      const c=this.axisZ?place.door.z:place.door.x;if(inside(c)&&doorSide(place,this.h)===queued.side)found.push({c,place});
    }
    return found.sort((a,b)=>forward?a.c-b.c:b.c-a.c);
  }
  update(dt,input={}){
    this.events.length=0;
    if(this.anim){this.animate(dt);return this.events;}
    if(this.mode==='inside'){this.insideStep(dt,input);return this.events;}
    if(this.mode!=='street')return this.events;
    this.plan();
    // A pause ends early on any input, a queued turn, autopilot or when cruising is switched off.
    const pausing=!this.auto&&!this.queued&&this.cruise&&!input.forward&&!input.back;
    if(this.hold>0){if(pausing){this.hold=Math.max(0,this.hold-dt);this.v=0;return this.events;}this.hold=0;}
    let target=this.auto?this.auto.speed:this.cruise?CRUISE:0;
    if(input.forward)target=Math.max(target,RUN);if(input.back)target=-BACK;
    const stop=this.v>=0?this.stopAhead():null;
    if(stop&&input.forward&&stop.d<BRAKE+3)this.lastStop=stop.key;
    const braking=pausing&&stop&&stop.key!==this.lastStop&&stop.d<BRAKE;
    if(braking)target=Math.min(target,Math.max(.45,CRUISE*stop.d/BRAKE));
    this.v+=(target-this.v)*Math.min(1,dt*(braking?6:3));if(target===0&&Math.abs(this.v)<.02)this.v=0;
    const c0=this.coord(),c1=c0+this.sign()*this.v*dt;
    if(this.queued&&this.v>0){const hit=this.points(c0,c1,this.queued)[0];if(hit){Object.assign(this,this.point(hit.c));this.trigger(hit);return this.events;}}
    if(braking&&(stop.c-c1)*this.sign()<=EPS){
      Object.assign(this,this.point(stop.c));this.yaw=this.nearYaw(this.h);
      this.v=0;this.hold=STOP[stop.kind];this.lastStop=stop.key;this.events.push('pause:'+(stop.place?stop.place.id:'junction'));
      return this.events;
    }
    Object.assign(this,this.point(c1));this.yaw=this.nearYaw(this.h);
    return this.events;
  }
  trigger(hit){
    const side=this.queued.side;this.queued=null;
    if(hit.place)return this.enter(hit.place);
    this.h=sideHeading(this.h,side);this.mode='turn';this.events.push('turn');
    this.play([{yaw:this.nearYaw(this.h),d:side==='around'?1.1:.85}],()=>{this.mode='street';});
  }
  nearYaw(h){return this.yaw+wrap(yawOf(h)-this.yaw);}
  play(frames,done){this.anim={frames,i:0,t:0,from:{x:this.x,z:this.z,y:this.y,yaw:this.yaw},done};}
  animate(dt){
    const a=this.anim,f=a.frames[a.i];a.t+=dt;const k=ease(Math.min(1,a.t/f.d));
    for(const key of ['x','z','y','yaw'])this[key]=a.from[key]+((f[key]??a.from[key])-a.from[key])*k;
    if(a.t<f.d)return;
    a.i++;a.t=0;a.from={x:this.x,z:this.z,y:this.y,yaw:this.yaw};
    if(a.i>=a.frames.length){this.anim=null;a.done?.();}
  }
  pathFrames(place,points,speed=2.6){
    const frame=frameOf(place);let last=frame.local(this.x,this.z);
    return points.map(([a,b])=>{const p=frame.at(a,b),d=Math.max(.35,Math.hypot(a-last.a,b-last.b)/speed);last={a,b};return {...p,y:floorOf(place,a),d};});
  }
  enter(place){
    this.returnH=this.h;this.v=0;this.mode='enter';this.events.push('entering:'+place.id);
    const frames=[{yaw:this.nearYaw(place.door.dir),d:.55},...this.pathFrames(place,place.inPath??[[FACADE+2,0]],3)];
    this.play(frames,()=>{this.mode='inside';this.place=place;if(this.auto?.kind==='route')this.auto=null;this.events.push('entered:'+place.id);});
  }
  leave(){
    if(this.mode!=='inside'||this.place.remote)return;const place=this.place;this.mode='exit';this.events.push('leaving:'+place.id);
    const out=this.yaw+wrap(yawOf((place.door.dir+2)%4)-this.yaw),{a}=frameOf(place).local(this.x,this.z);
    const path=(place.outPath??[]).filter(([pa])=>pa<a-.1);
    this.play([{yaw:out,d:.45},...this.pathFrames(place,path,3.2),{x:place.door.x,z:place.door.z,y:0,d:1.1},{yaw:out+wrap(yawOf(this.returnH)-out),d:.5}],
      ()=>{this.mode='street';this.place=null;this.h=this.returnH;this.events.push('left:'+place.id);});
  }
  // Place the walker inside a place, e.g. for a deep link or after a train ride.
  placeAt(id,a,b,yaw){
    const place=PLACES[id],frame=frameOf(place),p=frame.at(a,b);
    Object.assign(this,p,{y:floorOf(place,a),mode:'inside',place,anim:null,auto:null,v:0,queued:null});
    if(place.door){this.h=(place.door.dir+1)%4;this.returnH=this.h;}
    this.yaw=yaw??(place.door?yawOf(place.door.dir):0);
  }
  insideStep(dt,input){
    const place=this.place,frame=frameOf(place);
    this.yaw+=((input.left?1:0)-(input.right?1:0))*1.8*dt;
    const move=((input.forward?1:0)-(input.back?1:0))*2.5*dt;if(!move)return;
    const x=this.x-Math.sin(this.yaw)*move,z=this.z-Math.cos(this.yaw)*move,{a,b}=frame.local(x,z);
    if(place.door&&a<FACADE+.7-1e-4&&Math.abs(b)<1.3){this.leave();return;}
    if(place.board&&a>place.board&&this.gate){this.events.push('board');return;}
    if(place.boardBelow&&a<place.boardBelow&&Math.abs(b)<14){this.events.push('board');return;}
    let best=null;
    for(const [a0,a1,b0,b1,flag] of place.areas){
      if(flag==='gate'&&!this.gate)continue;
      const pa=nearest(a,a0,a1),pb=nearest(b,b0,b1),d=Math.hypot(pa-a,pb-b);
      if(!best||d<best.d)best={a:pa,b:pb,d};
    }
    if(place.gateA&&!this.gate&&a>place.gateA-.05)this.events.push('gate-closed');
    Object.assign(this,frame.at(best.a,best.b));this.y=floorOf(place,best.a);
  }
  // Left/right: turn now if a junction or matching door is close, otherwise at the next one. Repeating cancels.
  queue(side){
    if(this.mode!=='street'||this.anim)return;this.auto=null;
    if(this.queued?.side===side){this.queued=null;return;}
    const c=this.coord(),near=this.points(c-this.sign()*3.2,c+this.sign()*3.2,{side,at:'any'}).sort((p,q)=>Math.abs(p.c-c)-Math.abs(q.c-c))[0];
    this.queued={side,at:'any'};
    if(near){const target=this.point(near.c);this.mode='turn';this.play([{...target,d:Math.max(.25,Math.abs(near.c-c)/4)}],()=>{this.mode='street';this.trigger(near);});}
  }
  turnAround(){
    if(this.anim)return;this.auto=null;
    if(this.mode==='inside'){this.play([{yaw:this.yaw+Math.PI,d:1}],null);return;}
    if(this.mode!=='street')return;this.queued=null;this.v=0;this.h=(this.h+2)%4;this.mode='turn';
    this.play([{yaw:this.nearYaw(this.h),d:1.1}],()=>{this.mode='street';});
  }
  // Autopilot: wandering for the overview, or a shortest route to a door.
  route(id){const place=PLACES[id];if(!place?.door)return;this.auto={kind:'route',place,speed:ROUTE,key:null};this.queued=null;}
  wander(){this.auto={kind:'wander',speed:CRUISE,key:null};}
  plan(){
    const auto=this.auto;if(!auto||this.mode!=='street')return;
    if(auto.kind==='route'){
      const place=auto.place,side=doorSide(place,this.h),dc=this.axisZ?place.door.z:place.door.x,c=this.coord();
      const sameLine=side&&Math.abs((this.axisZ?place.door.x:place.door.z)-this.fixed())<.01;
      const lo=Math.floor(dc/PITCH)*PITCH;
      if(sameLine&&c>=lo-EPS&&c<=lo+PITCH+EPS){
        if((dc-c)*this.sign()>=0){this.queued={side,at:'door',place:place.id};return;}
        this.turnAround();this.auto=auto;auto.key=null;return;
      }
    }
    const next=this.nextJunction(),key=next+':'+this.fixed()+':'+this.h;
    if(auto.key===key)return;auto.key=key;
    const node={i:Math.round((this.axisZ?this.fixed():next)/PITCH),j:Math.round((this.axisZ?next:this.fixed())/PITCH)};
    const heading=auto.kind==='route'?this.routeHeading(node,auto.place.door):this.wanderHeading(node);
    const turn=(heading-this.h+4)%4;
    this.queued=turn===0?null:{side:turn===1?'right':turn===3?'left':'around',at:'junction'};
  }
  wanderHeading(node){
    const hash=mod(Math.imul(node.i*73856093^node.j*19349663,2654435761)>>>8,100);
    const options=[this.h,(this.h+3)%4,(this.h+1)%4].filter(h=>{const [fx,fz]=FORWARD[h];return Math.abs(node.i+fx)<=2&&Math.abs(node.j+fz)<=2;});
    if(!options.length)return(this.h+2)%4;
    return options.includes(this.h)&&hash<55?this.h:options[hash%options.length];
  }
  // Breadth-first search over junctions, returning the heading to leave this junction.
  routeHeading(start,door){
    const goals=new Map(),k=(i,j)=>i+','+j;
    if(door.dir%2===0){const i=Math.floor(door.x/PITCH),j=Math.round(door.z/PITCH);goals.set(k(i,j),1);goals.set(k(i+1,j),3);}
    else{const i=Math.round(door.x/PITCH);goals.set(k(i,Math.ceil(door.z/PITCH)),0);goals.set(k(i,Math.floor(door.z/PITCH)),2);}
    if(goals.has(k(start.i,start.j)))return goals.get(k(start.i,start.j));
    const seen=new Set([k(start.i,start.j)]),queue=[start];
    while(queue.length){
      const n=queue.shift();
      for(let h=0;h<4;h++){
        const [fx,fz]=FORWARD[h],m={i:n.i+fx,j:n.j+fz,first:n.first??h},key=k(m.i,m.j);
        if(seen.has(key)||Math.abs(m.i-start.i)>12||Math.abs(m.j-start.j)>12)continue;
        if(goals.has(key))return m.first;seen.add(key);queue.push(m);
      }
    }
    return this.h;
  }
  // What is near: for prompts.
  // The next junction or doorway ahead on this street, with its distance.
  stopAhead(){
    const c=this.coord(),sg=this.sign(),j=this.nextJunction();
    let best={c:j,d:(j-c)*sg,kind:'junction',place:null};
    for(const place of this.doorsOnLine()){
      const dc=this.axisZ?place.door.z:place.door.x,d=(dc-c)*sg;
      if(d>EPS&&d<best.d)best={c:dc,d,kind:'door',place};
    }
    best.key=this.h+':'+this.fixed()+':'+best.c;
    return best;
  }
  nearby(){
    if(this.mode!=='street')return{};
    const c=this.coord(),sg=this.sign(),next=this.nextJunction();
    const door=this.doorsOnLine().map(place=>({place,ahead:((this.axisZ?place.door.z:place.door.x)-c)*sg})).filter(d=>d.ahead>-3&&d.ahead<16).sort((p,q)=>Math.abs(p.ahead)-Math.abs(q.ahead))[0];
    return {junction:Math.abs(next-c),door:door?{place:door.place,side:doorSide(door.place,this.h),ahead:door.ahead}:null};
  }
}
