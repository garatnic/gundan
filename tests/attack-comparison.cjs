// Reference experiment only: fixed durable enemy, no rewards/upgrades, 90 bottom spawns,
// 30 combat seconds (automatic math pauses bypassed), deterministic RNG, 390x800 world.
const vm=require('node:vm'),path=require('node:path');process.env.HARNESS_ONLY='1';
for(const source of process.argv.slice(2))for(const stage of [1,2,3]){
 process.env.BATTLE_SOURCE=path.resolve(source);delete require.cache[require.resolve('./battle.cjs')];const {t,nodes,context}=require('./battle.cjs');
 vm.runInContext('let seed=12345;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)',context);
 t.set({stage});t.makeEnemy();t.get().levels[0]=87;const a=t.get().answer;t.choose(a,nodes['.choices'].children.find(b=>+b.textContent===a));const e=t.get().enemies[0];e.hp=e.max=1e9;
 for(let i=0;i<750;i++)t.step(.04);
 console.log(JSON.stringify({source:path.basename(source),stage,deaths:90-t.get().units.length,survivors:t.get().units.length,coins:t.get().coins,totalHP:+t.get().units.reduce((sum,u)=>sum+u.hp,0).toFixed(2)}));
}
