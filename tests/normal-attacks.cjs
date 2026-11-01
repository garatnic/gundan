const assert=require('node:assert/strict'),vm=require('node:vm');
process.env.HARNESS_ONLY='1';
function world(n=6,type=0){delete require.cache[require.resolve('./battle.cjs')];const w=require('./battle.cjs'),{t,nodes}=w;t.get().levels[0]=n-3;const a=t.get().answer;t.choose(a,nodes['.choices'].children.find(b=>+b.textContent===a));const e=t.get().enemies[0];e.type=type;e.period=[2,3,1][type];e.hp=e.max=1e9;t.updateFormation();const slots=t.makeFormation(e,20).slots;for(const [i,u] of t.get().units.entries()){Object.assign(u,{x:slots[i].x,y:slots[i].y,hp:10,max:10,cd:100});}vm.runInContext('globalThis.savedRandom=Math.random;Math.random=()=>0',w.context);return {...w,e,units:t.get().units};}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)}
function start(w){w.t.attackEnemy(w.e,w.units.filter(u=>w.t.touching(u,w.e)),.01);return w.t.get().pendingAreas[0]}
// Multipliers, decimals, fixed geometry and a full warning second, at both base attack levels.
for(const type of [0,1,2])for(const base of [1,2]){
 const w=world(1,type);w.e.atk=base;const g=start(w);near(g.damage,base*[1,.4,.6][type]);near(g.remaining,1);near(g.areas[0].radius,type===1?60:22);
 w.t.advanceBossAreas(.99);near(w.units[0].hp,10);w.t.advanceBossAreas(.01);near(w.units[0].hp,10-base*[1,.4,.6][type]);assert.equal(w.t.get().pendingAreas.length,0);
}
// Preserve v14's boss-skipping normal rotation and base growth, HP and rewards.
{const {t}=world(1);const types=[0,1,2,0,'boss',1,2,0,1,'boss',2,0,1,2,'boss',0];for(let stage=1;stage<=16;stage++){t.set({stage});t.makeEnemy();const e=t.get().enemies[0];assert.equal(e.boss?'boss':e.type,types[stage-1]);assert.equal(e.atk,1+Math.floor((stage-1)/5));assert.equal(e.max,Math.ceil(20*1.25**(stage-1)*(e.boss?1.7:1)));assert.equal(e.reward,Math.ceil(5*1.2**(stage-1))*(e.boss?3:1));}}
// Stationary warning, dodge, entering collateral, center-only radius boundary.
{
 const w=world(4),g=start(w),a=g.areas[0];w.units[0].x+=100;Object.assign(w.units[1],{x:a.x+20,y:a.y});Object.assign(w.units[2],{x:a.x+40,y:a.y});Object.assign(w.units[3],{x:a.x,y:a.y+22});
 assert.equal(w.t.touching(w.units[1],w.e),false);w.t.advanceBossAreas(1);near(w.units[0].hp,10);near(w.units[1].hp,9);near(w.units[2].hp,10);near(w.units[3].hp,9);near(a.x,g.areas[0].x);
}
// Lethal targets are randomized, then minimum HP ties; noncontacts excluded even with range.
{
 const w=world(4);w.units[0].hp=.8;w.units[1].hp=.4;w.units[2].hp=.01;w.units[2].y+=100;w.units[2].attackRange=200;
 let g=start(w);near(g.areas[0].x,w.units[0].x);w.t.makeEnemy();w.e=w.t.get().enemies[0];vm.runInContext('Math.random=()=>.99',w.context);g=start(w);near(g.areas[0].x,w.units[1].x);
 w.t.makeEnemy();w.e=w.t.get().enemies[0];w.units[0].hp=4;w.units[1].hp=2;w.units[3].hp=2;g=start(w);near(g.areas[0].x,w.units[3].x);
}
// Tank priority is structural only; no tank stats or unit type are added to production.
for(const type of [0,2]){
 const w=world(3,type);w.units[0].hp=.1;w.units[1].type='tank';w.units[1].hp=10;let g=start(w);near(g.areas[0].x,w.units[1].x);
 w.t.makeEnemy();w.e=w.t.get().enemies[0];w.e.type=type;w.units[1].y+=100;g=start(w);near(g.areas[0].x,w.units[0].x);
}
// Fast targeting ignores HP: every contacted candidate can be selected uniformly by RNG bins.
{
 const w=world(4,2);w.units.forEach((u,i)=>u.hp=i===0?.1:10);for(let i=0;i<4;i++){w.t.makeEnemy();w.e=w.t.get().enemies[0];w.e.type=2;vm.runInContext(`Math.random=()=>${(i+.5)/4}`,w.context);const g=start(w);near(g.areas[0].x,w.units[i].x);near(g.areas[0].y,w.units[i].y);}
}
// No contacted soldier => no punches, including extended allied attack range.
for(const type of [0,2]){const w=world(1,type);w.units[0].y+=100;w.units[0].attackRange=200;assert.equal(start(w),undefined);}
// Whole-circle, first rear shell and representative hit counts from actual layouts.
{
 const w=world(90,1),g=start(w);near(g.areas[0].x,w.e.x);near(g.areas[0].y,w.e.y);
 const expected=w.units.filter(u=>Math.hypot(u.x-w.e.x,u.y-w.e.y)<=60);w.t.advanceBossAreas(1);assert.equal(w.units.filter(u=>u.hp<10).length,expected.length);assert.equal(expected.length,18);
 for(const predicate of [u=>u.x<w.e.x,u=>u.x>w.e.x,u=>u.y<w.e.y,u=>u.y>w.e.y])assert.ok(expected.some(predicate));
 for(const spacing of [20,11]){const slots=w.t.makeFormation(w.e,spacing).slots,counts=slots.filter(s=>s.front).map(p=>slots.filter(s=>Math.hypot(s.x-p.x,s.y-p.y)<=22).length);console.log(`Radius22 spacing${spacing}: ${Math.min(...counts)}–${Math.max(...counts)} hits; radius60: ${slots.filter(s=>s.distance<=60).length} hits`);}
}
// Starts are period-separated; fast has one warning, full damage only at 1s then next starts.
for(const type of [0,1,2]){
 const w=world(1,type);w.units[0].hp=100;start(w);const starts=[0];let previous=w.t.get().pendingAreas[0];
 for(let i=1;i<=601;i++){w.t.advanceBossAreas(.01);w.t.attackEnemy(w.e,w.units,.01);assert.ok(w.t.get().pendingAreas.length<=1);const g=w.t.get().pendingAreas[0];if(g&&g!==previous)starts.push(i/100);previous=g;}
 for(let i=1;i<starts.length;i++)near(starts[i]-starts[i-1],[2,3,1][type]);assert.ok(starts.length>=3);
}
// Pause both ways, scroll independence, death/stage/prestige cleanup and carried HP/cooldown.
{
 const w=world(4),g=start(w);w.t.set({remaining:0});w.t.frame(100);w.t.frame(140);near(g.remaining,1);
 w.t.set({coins:100,remaining:2});w.nodes['.upgrades'].children[1].onclick();w.t.frame(180);near(g.remaining,1);w.nodes['.resume'].onclick();
 w.nodes['.arenaViewport'].scrollTop=500;w.t.advanceBossAreas(1);assert.ok(w.units.some(u=>u.hp===9));
 w.e.cd=0;start(w);w.e.hp=0;w.t.advanceBossAreas(.01);assert.equal(w.t.get().pendingAreas.length,0);
 vm.runInContext('Math.random=globalThis.savedRandom',w.context);const u=w.units[0],before=[u.hp,u.x,u.y,u.cd];w.t.win();assert.deepEqual([u.hp,u.x,u.y,u.cd],before);assert.equal(w.t.get().stage,2);
 w.e=w.t.get().enemies[0];w.e.type=1;start(w);w.t.makeEnemy();assert.equal(w.t.get().pendingAreas.length,0);
 w.e=w.t.get().enemies[0];w.e.type=1;start(w);w.t.set({cleared:10,remaining:0});w.nodes['.prestige'].onclick();assert.equal(w.t.get().pendingAreas.length,0);
}
// Boss implementation/config is byte-for-byte unchanged from the v14 baseline when supplied.
if(process.env.BASELINE_SOURCE){const fs=require('node:fs'),old=fs.readFileSync(process.env.BASELINE_SOURCE,'utf8'),now=fs.readFileSync('Index.html','utf8');for(const pattern of [/const bossAreaAttack=\{[^;]+;/,/function bossAttack\(enemy\)\{[\s\S]*?\n\}/])assert.equal(now.match(pattern)[0],old.match(pattern)[0]);}
// Decimal deaths pay exactly one coin each, no duplicate victim resolution.
{const w=world(3,2);w.units.forEach(u=>u.hp=.6);start(w);w.t.advanceBossAreas(1);const dead=w.units.filter(u=>u.hp===0).length;assert.ok(dead>=2);w.t.removeDeadUnits();near(w.t.get().coins,dead);w.t.advanceBossAreas(1);w.t.removeDeadUnits();near(w.t.get().coins,dead);}
console.log('v15 normal attacks: all requirements passed');
