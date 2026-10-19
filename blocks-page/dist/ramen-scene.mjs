// A reusable serving on the actual counter. All geometry is local and procedural.
export function createRamenServing(kit,group,animated,keep,{x,y,z}){
 const {THREE}=kit,table=new THREE.Group();table.position.set(x,y,z);group.add(table);
 const bowl=new THREE.Group();table.add(bowl);bowl.visible=false;
 const material=colour=>keep(new THREE.MeshStandardMaterial({color:colour,roughness:.65,metalness:.05}));
 const shell=keep(new THREE.SphereGeometry(.58,20,12,0,Math.PI*2,Math.PI/2,Math.PI/2));
 const white=material(0xffe4bc),mesh=new THREE.Mesh(shell,white);mesh.position.y=.35;bowl.add(mesh);
 const rim=new THREE.Mesh(keep(new THREE.TorusGeometry(.58,.035,8,24)),white);rim.rotation.x=Math.PI/2;rim.position.y=.35;bowl.add(rim);
 const dishes={};
 for(const [id,colour] of [['shoyu',0xe9a23b],['miso',0xe35130],['garden',0x94b768]]){
  const food=new THREE.Group();food.position.y=.34;bowl.add(food);dishes[id]=food;
  const broth=new THREE.Mesh(keep(new THREE.CylinderGeometry(.54,.54,.025,24)),material(colour));food.add(broth);
  const noodles=new THREE.Group();food.add(noodles);
  const noodleGeometry=keep(new THREE.TorusGeometry(.25,.018,5,18)),noodleMaterial=material(0xffdb8a);
  for(let i=0;i<7;i++){const strand=new THREE.Mesh(noodleGeometry,noodleMaterial);strand.rotation.set(Math.PI/2,0,i*.7);strand.scale.set(1-i*.08,.7,1);strand.position.set(Math.sin(i*2)*.14,.035+i*.007,Math.cos(i*2)*.13);noodles.add(strand);}
  const topping=kit.builder();
  if(id==='garden'){
   for(let i=0;i<3;i++)topping.part('matte',-.25+i*.18,.09,-.15,.13,.12,.12,0xfff0cc,0,.2);
  }else{
   topping.ball(-.22,.085,-.13,.18,.06,.14,0xfff9e3);topping.ball(-.22,.13,-.13,.09,.02,.07,0xffa126);
  }
  for(let i=0;i<5;i++)topping.part('matte',.22+i*.025,.07,-.18+i*.09,.05,.04,.17,0x25834a,.7);
  topping.ball(.06,.075,.2,.12,.035,.12,0xffeed9);topping.ball(.06,.115,.2,.065,.015,.065,id==='miso'?0xe9413e:0xf46a96);
  topping.finish(food);food.visible=false;
 }
 const sticks=kit.builder();for(const dz of [-.055,.055])sticks.part('matte',.1,.49,.1+dz,1.45,.025,.025,0xd9ad7e,.35);sticks.finish(bowl);
 const receipt=kit.sign(table,0,.025,1.15,['ごちそうさま','0 ETH · ON THE HOUSE'],'#ffb51b',1.2,.6,0,'paper');receipt.rotation.x=-Math.PI/2;receipt.visible=false;
 const steam=[];
 for(let i=0;i<3;i++){
  const sprite=new THREE.Sprite(keep(kit.glowMaterial('#fff2d5',.3).clone()));sprite.position.set((i-1)*.2,.85,0);sprite.scale.set(.3,.6,1);bowl.add(sprite);steam.push(sprite);
 }
 let state={phase:'menu',meal:null,bites:0},lastTime=0,thanksUntil=0;
 function setMeal(next){
  state={...next};bowl.visible=['served','receipt'].includes(state.phase);receipt.visible=state.phase==='receipt';
  for(const [id,food] of Object.entries(dishes)){food.visible=id===state.meal&&state.phase==='served';food.scale.setScalar(1-state.bites*.18);}
  steam.forEach(s=>{s.visible=state.phase==='served';});
 }
 animated.custom.push(time=>{
  lastTime=time;
  if(state.phase!=='served')return;
  steam.forEach((s,i)=>{const f=(time*.35+i/3)%1;s.position.y=.65+f*.8;s.material.opacity=.25*(1-f);s.scale.set(.25+f*.3,.4+f*.4,1);});
 });
 return {setMeal,thank(){thanksUntil=lastTime+2.5;},get bowing(){return thanksUntil>lastTime;},get phase(){return state.phase;},get visible(){return bowl.visible;},get meal(){return state.meal;},get receiptVisible(){return receipt.visible;}};
}
