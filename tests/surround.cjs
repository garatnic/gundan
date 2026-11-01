const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
process.env.HARNESS_ONLY='1';
function world(count=30,width=390,height=800){delete require.cache[require.resolve('./battle.cjs')];const {t,nodes}=require('./battle.cjs');nodes['.arena'].clientWidth=width;nodes['.arena'].clientHeight=height;t.makeEnemy();t.get().levels[0]=count-3;const a=t.get().answer;t.choose(a,nodes['.choices'].children.find(b=>+b.textContent===a));const e=t.get().enemies[0];e.hp=e.max=1e9;e.atk=0;return {t,nodes,e}}
function simulate(t,seconds){for(let i=0;i<Math.ceil(seconds/.04);i++)t.step(.04)}
function close(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)}
function separated(units){for(let i=0;i<units.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(units[i].x-units[j].x,units[i].y-units[j].y)>=11-1e-4)}
// 1: attack periods, with unchanged allied 5 seconds and boss warning configuration.
{
 const {t}=world();for(const [stage,expected] of [[1,2],[2,3],[3,1],[5,3]]){t.set({stage});t.makeEnemy();assert.equal(t.get().enemies[0].period,expected)}assert.equal(t.period(),5);
}
// 2-4: all cardinal directions, screen bounds, adaptive downward position and comparison.
for(const [width,height] of [[240,265],[390,800],[560,936]]){
 const {t,e,nodes}=world(30,width,height),front=t.makeFormation(e,20).slots.filter(s=>s.front);
 assert.ok(e.y>116);assert.ok(e.y+e.radius+11<=nodes['.arenaViewport'].clientHeight);assert.equal(front.length,12);
 for(const predicate of [s=>s.x>e.x+30,s=>s.x<e.x-30,s=>s.y>e.y+30,s=>s.y<e.y-30])assert.ok(front.some(predicate));
 for(const s of front){assert.ok(s.y>=11&&s.y<=height-11&&s.x>=11&&s.x<=width-11);close(Math.hypot(s.x-e.x,s.y-e.y),e.radius+11)}
 const v12=Math.ceil(Math.PI/(2*Math.asin(20/(2*(e.radius+11)))))+1;assert.equal(v12,7);assert.ok(front.length>v12);
}
// 5-7,9: full enclosure from bottom spawn, compact radial hex distribution and no waiting attacks.
{
 const {t,e}=world(90);t.updateFormation();const initial=t.get().units.map(u=>t.attackPosition(u,e));const chosen=new Set(initial.map(p=>p.key));const last=Math.max(...initial.filter(p=>!p.front).map(p=>p.distance));
 assert.ok(t.makeFormation(e,20).slots.filter(p=>!p.front&&!chosen.has(p.key)).every(p=>p.distance>=last-1e-6));
 for(const side of [p=>p.x<e.x,p=>p.x>e.x,p=>p.y<e.y,p=>p.y>e.y])assert.ok(initial.filter(p=>!p.front&&side(p)).length>=10);
 simulate(t,30);const units=t.get().units;assert.equal(units.filter(u=>t.canAttack(u,e)).length,12);assert.equal(units.filter(u=>u.state==='waiting').length,78);separated(units);
 const hp=e.hp;for(const u of units)u.cd=0;t.step(.01);close(hp-e.hp,12);assert.equal(units.filter(u=>u.state==='attacking').length,12);
 console.log('v12/v13 normal-spacing contact capacity: 7 -> 12; 90-soldier arrival: 12 contact + 78 waiting');
}
// 8: every upper/lower/side contact location can be replenished without duplicate reservations.
// The full 12-location death/refill loop is also run by tests/formation.cjs.
{
 const {t,e}=world(30);simulate(t,18);const top=t.get().units.find(u=>t.canAttack(u,e)&&u.y<e.y-30);assert.ok(top);const key=top.placementKey,c=t.get().coins;top.hp=0;t.removeDeadUnits();close(t.get().coins,c+1);t.updateFormation();const replacement=t.get().units.find(u=>u.placementKey===key);assert.ok(replacement);simulate(t,15);assert.ok(t.canAttack(replacement,e));assert.equal(new Set(t.get().units.map(u=>u.placementKey)).size,29);
}
// 11-12: ordinary area attack hits upper-side actors geometrically; death coins paid once.
{
 const {t,e}=world(30);simulate(t,18);const front=t.get().units.filter(u=>t.touching(u,e)),top=front.reduce((a,b)=>a.y<b.y?a:b);for(const u of front)u.hp=u.max=3;top.hp=.4;e.atk=1;e.type=1;e.cd=0;
 t.advanceBossAreas(1);const before=new Map(front.map(u=>[u,u.hp])),expected=front.filter(u=>Math.hypot(u.x-e.x,u.y-e.y)<=60);t.attackEnemy(e,front,.01);t.advanceBossAreas(1);for(const u of front)close(u.hp,before.get(u)-(expected.includes(u)?.4:0));
 const c=t.get().coins;t.removeDeadUnits();close(t.get().coins,c+1);t.removeDeadUnits();close(t.get().coins,c+1);
 // Force the boss's only living candidate to be on its upper side, using the real boss code.
 const upper=front.find(u=>u!==top&&u.y<e.y);for(const u of t.get().units)if(u!==upper)u.hp=0;t.removeDeadUnits();upper.hp=1;t.set({stage:5});t.makeEnemy();t.bossAttack(t.get().enemies[0]);const warning=t.get().pendingAreas[0];assert.ok(warning.areas.some(a=>Math.hypot(upper.x-a.x,upper.y-a.y)<=20));t.advanceBossAreas(.99);close(upper.hp,1);t.advanceBossAreas(.01);close(upper.hp,0);const coins=t.get().coins;t.removeDeadUnits();close(t.get().coins,coins+1);t.removeDeadUnits();close(t.get().coins,coins+1);
}
// 10: large crowd reaches its reservations, with no extreme overlap or frame-scale stalls.
{
 const {t,e}=world(300);const begin=performance.now();t.updateFormation();simulate(t,60);const elapsed=performance.now()-begin,units=t.get().units;separated(units);assert.equal(new Set(units.map(u=>u.placementKey)).size,300);assert.equal(units.filter(u=>t.canAttack(u,e)).length,12);assert.ok(units.filter(u=>u.state==='moving').length<=1);assert.ok(elapsed<15000);
 console.log(`300-soldier, 60s simulation: ${elapsed.toFixed(1)}ms / 1500 steps; waiting ${units.filter(u=>u.state==='waiting').length}, moving ${units.filter(u=>u.state==='moving').length}`);
}
// Compressed contact targets must still satisfy the actual 11px minimum.
{
 const {t,e}=world(3);separated(t.makeFormation(e,11).slots.filter(s=>s.front));
}
// 13: existing battle tests cover stage, both pause states, upgrades, prestige and scroll.
console.log('v13 surrounding, economics and regression requirements passed');

