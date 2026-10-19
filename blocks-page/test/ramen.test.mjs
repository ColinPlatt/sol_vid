import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Diner,MENU} from '../dist/ramen.mjs';
import {tipRecipient} from '../dist/tip.mjs';

test('each free meal reaches a receipt after three bites and can be ordered again',()=>{
 const diner=new Diner();
 for(const meal of MENU){
  assert.equal(diner.order(meal.id),true);assert.equal(diner.phase,'cooking');
  assert.equal(diner.bite(),false);assert.equal(diner.order(meal.id),false);
  assert.equal(diner.serve(),true);assert.equal(diner.serve(),false);
  assert.equal(diner.bite(),true);assert.equal(diner.bite(),true);assert.equal(diner.phase,'served');
  assert.equal(diner.bite(),true);assert.equal(diner.phase,'receipt');assert.equal(diner.bite(),false);
  assert.equal(diner.snapshot().meal,meal.id);assert.equal(diner.again(),true);
 }
 assert.equal(diner.orderNumber,3);
});
test('invalid actions do not invent a meal and visitors can finish early',()=>{
 const diner=new Diner();assert.equal(diner.finish(),false);assert.equal(diner.serve(),false);
 assert.equal(diner.order('not-a-meal'),false);assert.equal(diner.again(),false);assert.equal(diner.phase,'menu');
 diner.order('garden');diner.serve();assert.equal(diner.finish(),true);assert.equal(diner.phase,'receipt');assert.equal(diner.bites,0);
 assert.equal(diner.finish(),false);assert.equal(diner.again(),true);assert.equal(diner.meal,null);
});
test('tip recipients agree with the confirmed deployment manifests',async()=>{
 for(const [chainId,chainHex,name] of [[8453,'0x2105','blocks-video-v3-base'],[8453,'0x2105','blocks-video-v4-base'],[11155111,'0xaa36a7','blocks-video-v3-sepolia']]){
  const manifest=JSON.parse(await readFile(new URL('../../deployments/'+name+'.json',import.meta.url)));
  assert.equal(manifest.chain_id,chainId);assert.equal(tipRecipient({chainId,chainHex}).toLowerCase(),manifest.deployer.toLowerCase());
 }
});
