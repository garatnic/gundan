const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
process.env.HARNESS_ONLY='1';
function battle(n=3,width=390,height=800){delete require.cache[require.resolve('./battle.cjs')];const {t,nodes,context}=require('./battle.cjs');nodes['.arena'].clientWidth=width;nodes['.arena'].clientHeight=height;t.makeEnemy();t.get().levels[0]=n-3;const a=t.get().answer,b=nodes['.choices'].children.find(x=>+x.textContent===a);t.choose(a,b);const e=t.get().enemies[0];e.hp=e.max=1e9;e.atk=0;return {t,nodes,e,context}}
function near(a,b,epsilon=1e-6){assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`)}
function minDistance(units){let min=Infinity;for(let i=0;i<units.length;i++)for(let j=0;j<i;j++)min=Math.min(min,Math.hypot(units[i].x-units[j].x,units[i].y-units[j].y));return min}
function simulate(t,seconds){for(let i=0;i<Math.ceil(seconds/.04);i++)t.step(.04)}
// 1: small squad spawns at normal spacing and arrives without extreme overlap.
{
 const {t,e}=battle(3);assert.ok(minDistance(t.get().units)>=19.999);for(let i=0;i<250;i++){t.step(.04);assert.ok(minDistance(t.get().units)>=11-1e-4)}assert.ok(t.get().units.every(u=>t.canAttack(u,e)));assert.ok(minDistance(t.get().units)>=18);assert.ok(t.get().units.every(u=>u.state==='attacking'));
}
// 2, 3, 4, 6: dense hexagonal waiting rows, unique stable reservations, actual contact only.
{
 const {t,e}=battle(90);t.updateFormation();const units=t.get().units,keys=units.map(u=>u.placementKey);assert.equal(new Set(keys).size,90);
 const positions=units.map(u=>t.attackPosition(u,e));assert.ok(minDistance(positions)>=18-1e-6);assert.ok(positions.some(p=>p.key.startsWith('rear:1:')));assert.ok(positions.some(p=>p.key.startsWith('rear:0:')));
 simulate(t,18);assert.ok(minDistance(units)>=11-1e-4);const attackers=units.filter(u=>t.canAttack(u,e)),waiting=units.filter(u=>u.state==='waiting');console.log('Dense arrival:',{contact:attackers.length,waiting:waiting.length,moving:units.filter(u=>u.state==='moving').length});assert.ok(attackers.length>=3);assert.ok(waiting.length>=70);assert.ok(attackers.length<units.length);
 const hp=e.hp;for(const u of units)u.cd=0;t.step(.01);near(hp-e.hp,units.filter(u=>t.canAttack(u,e)).length,1e-4);
 const stable=units.map(u=>u.placementKey);simulate(t,.4);assert.deepEqual(units.map(u=>u.placementKey),stable);
 // 5: nearest soldier gets a vacant contact reservation; no teleport, no duplicate reservation.
 const front=units.find(u=>t.canAttack(u,e)),vacancy=t.attackPosition(front,e),candidates=units.filter(u=>u!==front&&!t.attackPosition(u,e)?.front).sort((a,b)=>Math.hypot(a.x-vacancy.x,a.y-vacancy.y)-Math.hypot(b.x-vacancy.x,b.y-vacancy.y)||a.id-b.id);
 const replacement=candidates[0],x=replacement.x,y=replacement.y;front.hp=0;t.removeDeadUnits();t.updateFormation();assert.equal(replacement.placementKey,vacancy.key);near(replacement.x,x);near(replacement.y,y);const oldGap=t.surfaceDistance(replacement,e);simulate(t,10);assert.ok(t.surfaceDistance(replacement,e)<oldGap);assert.ok(t.canAttack(replacement,e),'replacement reaches contact');assert.equal(new Set(t.get().units.map(u=>u.placementKey)).size,t.get().units.length);
}
// Every contact-arc vacancy, including both flanks, can be replenished.
for(let location=0;location<7;location++){
 const {t,e}=battle(30);simulate(t,10);const victim=t.get().units.find(u=>u.placementKey==='contact:'+location);assert.ok(victim);victim.hp=0;t.removeDeadUnits();t.updateFormation();const replacement=t.get().units.find(u=>u.placementKey==='contact:'+location);assert.ok(replacement);simulate(t,12);assert.ok(t.canAttack(replacement,e),'flank/center contact refill '+location);
}
// 7,8: timers freeze out of range, never bank attacks; range is independent of placement key.
{
 const {t,e}=battle(1),u=t.get().units[0];t.updateFormation();const p=t.attackPosition(u,e);u.x=p.x;u.y=p.y;u.cd=0;const hp=e.hp;t.step(.04);near(hp-e.hp,1);near(u.cd,5);u.y+=100;simulate(t,.04);near(u.cd,5);u.x=p.x;u.y=p.y;t.step(.04);near(u.cd,4.96);near(hp-e.hp,1);
 const before=u.placementKey;u.x=e.x;u.y=e.y+e.radius+u.radius+15;assert.equal(t.canAttack(u,e),false);u.attackRange=15;assert.equal(t.canAttack(u,e),true);assert.equal(u.placementKey,before);
 const diagonal=t.makeFormation(e,20).slots.find(s=>s.key==='rear:0:0'),straight=t.makeFormation(e,20).slots.find(s=>s.key==='rear:1:0');u.attackRange=22;u.x=diagonal.x;u.y=diagonal.y;assert.equal(t.canAttack(u,e),true);u.x=straight.x;u.y=straight.y;assert.equal(t.canAttack(u,e),false);
 // Two rear distances can be distinguished without row numbers or an attacker count.
 u.attackRange=20;u.x=e.x;u.y=e.y+e.radius+u.radius+21;assert.equal(t.canAttack(u,e),false);u.y-=2;assert.equal(t.canAttack(u,e),true);
}
// 9: stopped frames do not update reservations, movement, cooldown or warning timers.
{
 const {t,nodes,e}=battle(15);t.bossAttack(e);const warning=t.get().pendingAreas[0];t.set({remaining:0});t.frame(100);const before=JSON.stringify(t.get().units.map(u=>[u.x,u.y,u.cd,u.placementKey]));t.frame(140);assert.equal(JSON.stringify(t.get().units.map(u=>[u.x,u.y,u.cd,u.placementKey])),before);near(warning.remaining,1);
 t.set({coins:100,remaining:2});nodes['.upgrades'].children[3].onclick();t.frame(180);assert.equal(JSON.stringify(t.get().units.map(u=>[u.x,u.y,u.cd,u.placementKey])),before);near(warning.remaining,1);near(t.get().remaining,2);nodes['.resume'].onclick();t.frame(220);assert.ok(t.get().units.some(u=>u.placementKey));
}
// 10: stage transition invalidates reservations only; survivor HP/position/cd survive.
{
 const {t,e}=battle(12);simulate(t,10);const u=t.get().units[0];u.cd=2.3;const before=[u.hp,u.x,u.y,u.cd];e.hp=0;t.win();assert.equal(t.get().stage,2);assert.deepEqual([u.hp,u.x,u.y,u.cd],before);assert.equal(u.placementKey,null);t.get().enemies[0].atk=0;t.step(.04);assert.ok(u.placementKey);assert.equal(u.targetId,t.get().enemies[0].id);
 // Following a changed enemy position updates goals with no teleport; no enemy movement is implemented.
 const enemy=t.get().enemies[0],p=t.attackPosition(u,enemy);const x=u.x,y=u.y;enemy.x+=10;t.updateFormation();assert.notEqual(t.attackPosition(u,enemy).x,p.x);near(u.x,x);near(u.y,y);
}
// 11: same world geometry and targets at different scroll offsets.
{
 const {t,nodes,e}=battle(5);t.updateFormation();const u=t.get().units[0],p=t.attackPosition(u,e);u.x=p.x;u.y=p.y;const distance=t.surfaceDistance(u,e);nodes['.arenaViewport'].scrollTop=500;t.updateFormation();near(t.surfaceDistance(u,e),distance);assert.equal(t.canAttack(u,e),true);assert.equal(t.attackPosition(u,e).key,p.key);
}
// 12: local spatial bins, realistic 300-soldier load, report timings rather than a brittle CI threshold.
{
 const {t}=battle(300);const start=performance.now();t.updateFormation();const allocation=performance.now()-start;const begin=performance.now();simulate(t,4);const elapsed=performance.now()-begin;assert.ok(t.get().units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)));assert.ok(minDistance(t.get().units)>=11-1e-4);console.log(`300 soldiers: allocation ${allocation.toFixed(1)}ms; 100 steps ${elapsed.toFixed(1)}ms (${(elapsed/100).toFixed(2)}ms/step)`);assert.ok(elapsed<10000,'300-unit simulation should complete without a multi-second stall per step');
}
// Narrow/small battlefield uses compressed spacing only when regular capacity is exhausted.
{
 const {t,e}=battle(120,240,265);t.updateFormation();assert.equal(new Set(t.get().units.map(u=>u.placementKey)).size,120);assert.ok(minDistance(t.get().units)>=11-1e-4);assert.equal(t.makeFormation(e,20).slots.length<120,true);
 // Spawn into an existing ordinary formation until compression is required.
 const next=battle(5,240,265);next.t.updateFormation();next.t.get().levels[0]=117;const a=next.t.get().answer;next.t.choose(a,next.nodes['.choices'].children.find(b=>+b.textContent===a));next.t.updateFormation();assert.equal(new Set(next.t.get().units.map(u=>u.placementKey)).size,125);
}
console.log('All 12 formation requirements passed');
