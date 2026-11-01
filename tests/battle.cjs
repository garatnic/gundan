process.env.PHASE??='E';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.children=[];this.style={};this.classList={add(){}};this.clientWidth=390;this.clientHeight=800;this.scrollTop=0;this.disabled=false;this.textContent='';this.isConnected=true;this.offsetHeight=44}
 appendChild(e){this.children.push(e);e.parent=this;return e} remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 replaceChildren(){this.children=[]} querySelector(s){this.nodes??={};return this.nodes[s]??(this.nodes[s]=new Element())}
 querySelectorAll(s){return s==='.upgrade'?nodes['.upgrades'].children:[]}
 setAttribute(){} removeAttribute(){}
 getBoundingClientRect(){return {height:44}}
 set innerHTML(s){this.html=s} get innerHTML(){return this.html}
}
const nodes={};for(const s of ['.arena','.choices','.message','.wallet','.stage','.bar','.enemyStats','.state','.progressText','.upgrades','.prestige','.enemy','.expression','.refresh-build','.question','.resume','.question-slot','.battlefield','.arenaViewport'])nodes[s]=new Element();
nodes['.arenaViewport'].clientHeight=265;
const root=new Element();root.querySelector=s=>nodes[s];root.querySelectorAll=s=>s==='.upgrade'?nodes['.upgrades'].children:[];
let callback;const context={console,URL,location:{href:'https://example.com/Index.html',replace(){}},document:{hidden:false,addEventListener(){},getElementById:()=>root,querySelector:s=>s.includes('meta')?{content:'test'}:nodes['.refresh-build'],createElement:()=>new Element()},requestAnimationFrame:f=>callback=f};
const html=fs.readFileSync(process.env.BATTLE_SOURCE||'Index.html','utf8');let source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.replace('})();',`globalThis.test={damage,hpPercent,hpText,updateFormation,attackPosition,canAttack,touching,surfaceDistance,unitTypes,formationRules,makeFormation,attackEnemy,moveUnit,spatialIndex,removeDeadUnits,clearAllUnits,period,step,choose,frame,win,makeEnemy,bossAttack,advanceBossAreas,combatMode,get:()=>({coins,stage,prestige,cleared,correct,levels,costs,units,enemies,remaining,pendingAreas,strategyPaused,answer}),set:s=>{if('remaining'in s)remaining=s.remaining;if('coins'in s)coins=s.coins;if('stage'in s)stage=s.stage;if('cleared'in s)cleared=s.cleared;}};})();`);
vm.createContext(context);vm.runInContext(source,context);const t=context.test;
if(process.env.HARNESS_ONLY){module.exports={t,nodes,context};return;}
function state(){return t.get()}function answer(){const a=state().answer;const b=nodes['.choices'].children.find(b=>+b.textContent===a);t.choose(a,b)}
function tick(dt){const s=state();t.set({remaining:Math.max(0,s.remaining-dt)});t.step(dt)}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)}
// Fractional HP survives and repeated decimal subtraction dies exactly once.
const actor={hp:1,max:1};t.damage(actor,.25);near(actor.hp,.75);near(t.hpPercent(actor),75);for(let i=0;i<3;i++)t.damage(actor,.25);assert.equal(actor.hp,0);
const decimal={hp:.3,max:.3};for(let i=0;i<3;i++)t.damage(decimal,.1);assert.equal(decimal.hp,0);const tiny={hp:1e-18,max:1e-18};t.damage(tiny,1e-19);assert.ok(tiny.hp>0);assert.equal(t.hpText(tiny.hp),'<0.01');
answer();assert.equal(state().units.length,3);const u=state().units[0],e=state().enemies[0];near(t.period(),5);near(e.period,2);
// A fatal allied hit cannot be followed by a dead enemy attack. Transition is once.
t.updateFormation();for(const a of state().units){const p=t.attackPosition(a,e);a.x=p.x;a.y=p.y;a.cd=.8}
u.cd=0;e.hp=.25;const oldHp=u.hp,oldCoins=state().coins,oldRemaining=state().remaining;
t.step(.01);assert.equal(state().stage,2);near(state().enemies[0].period,3);assert.equal(u.hp,oldHp);near(state().coins-oldCoins,5);near(state().remaining,oldRemaining);near(u.cd,5);t.win();assert.equal(state().stage,2);near(state().coins-oldCoins,5);
// Boss warning: at least one living ally in radius, full 1 second, deduplicated damage.
t.set({stage:5});t.makeEnemy();const boss=state().enemies[0];near(boss.period,3);for(const a of state().units){a.hp=2;a.max=2}t.bossAttack(boss);assert.equal(state().pendingAreas.length,1);const group=state().pendingAreas[0],area=group.areas[0];assert.ok(state().units.some(a=>Math.hypot(a.x-area.x,a.y-area.y)<=20));u.x=area.x;u.y=area.y;t.advanceBossAreas(.99);assert.equal(u.hp,2);t.advanceBossAreas(.01);assert.equal(u.hp,1);assert.equal(state().pendingAreas.length,0);
// Death coins are paid once, wipeout preserves stage and enemy HP.
for(const a of state().units)a.hp=0;const n=state().units.length,c=state().coins,h= boss.hp;t.step(.01);assert.equal(state().units.length,0);near(state().coins,c+n);t.step(.01);near(state().coins,c+n);assert.equal(state().stage,5);near(boss.hp,h);
if(process.env.PHASE!=='B'){
 t.set({remaining:0});answer();assert.equal(state().remaining,3);const before=state().units.length;t.set({remaining:1.2});answer();assert.equal(state().units.length,before+3);assert.equal(state().remaining,3);assert.ok(nodes['.choices'].children.every(b=>!b.disabled));
 const wrong=nodes['.choices'].children.find(b=>+b.textContent!==state().answer),a=state().answer;t.choose(+wrong.textContent,wrong);assert.equal(state().answer,a);assert.equal(state().remaining,3);assert.equal(state().units.length,before+3);assert.equal(wrong.disabled,true);
 // Zero timer freezes simulation, answer resumes.
 t.set({remaining:.02});t.frame(100);t.frame(140);assert.equal(state().remaining,0);const x=state().units[0].x;t.frame(180);assert.equal(state().units[0].x,x);answer();assert.equal(state().remaining,3);
}
if(['D','E'].includes(process.env.PHASE)){
 t.set({coins:100,remaining:1.2});const oldAnswer=state().answer,oldChoices=nodes['.choices'].children,unit=state().units[0],oldHp=unit.hp,oldMax=unit.max;
 nodes['.upgrades'].children[3].onclick();assert.equal(state().strategyPaused,true);near(unit.hp,oldHp+1);near(unit.max,oldMax+1);const x=unit.x;t.frame(220);near(state().remaining,1.2);near(unit.x,x);nodes['.upgrades'].children[1].onclick();assert.equal(state().strategyPaused,true);nodes['.resume'].onclick();assert.equal(state().strategyPaused,false);assert.equal(state().answer,oldAnswer);assert.equal(nodes['.choices'].children,oldChoices);near(state().remaining,1.2);
 t.set({coins:0});nodes['.upgrades'].children[0].onclick();assert.equal(state().strategyPaused,false);
 t.set({remaining:0,coins:100});const countBefore=state().units.length;nodes['.upgrades'].children[0].onclick();assert.equal(state().units.length,countBefore);nodes['.resume'].onclick();assert.equal(t.combatMode(),'autoPaused');
 // Wrong-choice state and boss warning time survive strategy pause.
 const wrong=nodes['.choices'].children.find(b=>+b.textContent!==state().answer);t.choose(+wrong.textContent,wrong);t.set({stage:5});t.makeEnemy();t.bossAttack(state().enemies[0]);const warning=state().pendingAreas[0];t.set({coins:100,remaining:1.2});nodes['.upgrades'].children[1].onclick();t.frame(260);near(warning.remaining,1);assert.equal(wrong.disabled,true);nodes['.resume'].onclick();assert.equal(wrong.disabled,true);near(warning.remaining,1);
 t.set({cleared:10,remaining:1});nodes['.prestige'].onclick();assert.equal(state().prestige,0);t.set({remaining:1,coins:100});nodes['.upgrades'].children[3].onclick();const totalCorrect=state().correct;nodes['.prestige'].onclick();assert.equal(state().correct,totalCorrect);assert.equal(state().prestige,1);assert.equal(state().stage,1);assert.equal(state().coins,0);assert.equal(state().units.length,0);assert.equal(state().pendingAreas.length,0);assert.equal(state().strategyPaused,false);assert.deepEqual(Array.from(state().levels),[0,0,0,0]);
}
if(process.env.PHASE==='E'){
 nodes['.arena'].clientHeight=800;nodes['.arenaViewport'].scrollTop=320;answer();const u=state().units[0];assert.ok(u.y>=nodes['.battlefield'].clientHeight-30);const x=u.x,y=u.y;tick(.04);assert.ok(u.y<y);near(Math.hypot(u.x-x,u.y-y),175*.04);assert.equal(nodes['.arenaViewport'].scrollTop,320);
}
// Syntax compilation above is also the game JavaScript syntax check.
console.log(`Phase ${process.env.PHASE||'E'}: all battle regression checks passed`);


