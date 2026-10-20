import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {planGameTransitions,transferTargetRect} from '../public/tabletop/animation.js';
import {planExpansionMotion,expansionMotionSignature,expansionDestinationRect} from '../public/tabletop/animation-expansions.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const card=(id,kind='location')=>({id,kind,color:'blue',symbol:'sun'});
const player=(hand=[],doors=[])=>({hand,doors,labyrinth:[]});
const game=(patch={})=>({mode:'solo',status:'active',phase:'action',active:0,turn:1,deckCount:60,players:[player([card('a'),card('b')])],discard:[],limbo:[],expansion:{},...patch});
const exp=(extras={})=>({towers:{alignment:[],protected:false},dreamcatchers:{active:[true,true,true,true],failsafes:2,stacks:[[],[],[],[]]},premonitions:{faceUp:['blue2'],resolved:[],reserveCount:7},mirrors:{stacks:{sun:[],moon:[]},completed:[]},oniverse:{rallied:[],treasure:[]},book:{goals:[{done:false}],removed:[]},...extras});
const source=readFileSync(new URL('../public/tabletop/animation.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/tabletop/animation.css',import.meta.url),'utf8');

test('Tower insertion makes only the added Tower fly; its protected state gets local emphasis',()=>{
 const a=game({expansion:exp({towers:{alignment:[card('t1','tower')],protected:false}})});
 const b=game({players:[player([card('b')])],expansion:exp({towers:{alignment:[card('t2','tower'),card('t1','tower')],protected:true}})});
 const plan=planGameTransitions(a,b);
 assert.deepEqual(plan.moved,[]); // new tower not previously public
 assert.deepEqual(plan.expansion.towersPlaced,['t2']);
 assert(plan.expansion.towerProtectionChanged);
 assert(!plan.expansion.towersRemoved.length);
});

test('Mirror pair has exactly two physical transfers and an anchored tile when only two cards render',()=>{
 const a=game({expansion:exp()});
 const b=game({players:[player([])],expansion:exp({mirrors:{stacks:{sun:[card('a'),card('b')],moon:[]},completed:['sun']}})});
 const plan=planGameTransitions(a,b);
 assert.deepEqual(new Set(plan.moved),new Set(['a','b']));
 assert.deepEqual(plan.expansion.mirrorPlaced,[{id:'a',name:'sun'},{id:'b',name:'sun'}]);
 assert.deepEqual(plan.expansion.mirrorCompleted,['sun']);
 const tile={left:23,top:15,width:75,height:95};
 assert.equal(transferTargetRect('mirror:sun',null,{mirrors:{sun:tile}}),tile);
 assert.equal(expansionDestinationRect('mirror:sun',null,{mirrors:{sun:tile}}),tile);
});

test('Dreamcatcher failure, Failsafe and return counts remain localized, even with other expansions',()=>{
 const a=game({expansion:exp({dreamcatchers:{active:[true,true,true,true],failsafes:2,stacks:[[card('held')],[],[],[]]}})});
 const b=game({expansion:exp({dreamcatchers:{active:[false,true,true,true],failsafes:1,stacks:[[],[],[],[]]}})});
 const delta=planExpansionMotion(a,b);
 assert.deepEqual(delta.catcherLost,[0]);assert.equal(delta.failsafeSpent,1);
 assert.deepEqual(delta.mirrorPlaced,[]);
});

test('Premonition counters, reveals and resolution trigger without inventing extra card movement',()=>{
 const a=game({expansion:exp()});
 const b=game({players:[player([card('a'),card('b')],[card('d','door')])],expansion:exp()});
 assert.deepEqual(planGameTransitions(a,b).moved,[]);
 assert.deepEqual(planExpansionMotion(a,b).premonitionProgress,['blue2']);
 assert.notEqual(expansionMotionSignature(a),expansionMotionSignature(b));
 const c=game({expansion:exp({premonitions:{faceUp:[],resolved:['blue2'],reserveCount:7}})});
 assert.deepEqual(planExpansionMotion(a,c).premonitionResolved,['blue2']);
 const reveal=game({expansion:exp({premonitions:{faceUp:['blue2','red2'],resolved:[],reserveCount:6}})});
 assert.deepEqual(planGameTransitions(a,reveal).premRevealed,['red2']);
 assert.match(source,/\.tt5-premonitions \.tt14-reserve/);
});

test('Book of Steps spends the actual number of discarded cards without showing their identities',()=>{
 const paid=Array.from({length:7},(_,i)=>card('pay-'+i));
 const a=game({discard:paid,expansion:exp()});
 const b=game({discard:[],expansion:exp({book:{goals:[{done:false}],removed:paid}})});
 assert.deepEqual(planExpansionMotion(a,b).spellSpent,paid.map(c=>c.id));
 assert.match(source,/stackMotionCounts\(expansion\.spellSpent\.length,0\)/);
 assert.match(source,/queue\(null,deckEl,discard,spellbook,null,false,count\)/);
});

test('Denizen, Treasure Keeper, and Incubus use public zones while guarding hidden draws',()=>{
 const a=game({expansion:exp()});
 const b=game({players:[player([card('b')])],expansion:exp({oniverse:{rallied:[card('den','denizen')],treasure:[card('a')]},incubus:{level:'apprentice',used:true,stored:[card('stored')]}})});
 const delta=planExpansionMotion(a,b);
 assert.deepEqual(delta.rallied,['den']);assert.deepEqual(delta.treasureStored,['a']);
 assert.deepEqual(delta.incubusStored,['stored']);assert(delta.incubusActivated);
 const r={left:3,top:5,width:100,height:135};
 assert.equal(transferTargetRect('incubus',null,{incubus:r}),r);
 assert.equal(transferTargetRect('rallied',null,{denizens:r}),r);
 assert.match(source,/incubusIds\.has\(id\)/);
 assert.match(source,/queue\(null,deckEl,deck,anchors\.incubus,null,false,count\)/);
});

test('Door gain and loss, Book Goal changes, and public Nightmare receive truthful local feedback',()=>{
 const a=game({expansion:exp()});
 const b=game({players:[player([card('a'),card('b')],[card('door','door')])],expansion:exp({book:{goals:[{done:true}],removed:[]}}),phase:'decision',pending:{type:'nightmare',card:card('night','nightmare')}});
 const p=planExpansionMotion(a,b);
 assert.deepEqual(p.doorsGained,['door']);assert(p.bookGoalsChanged);assert(p.nightmareRevealed);
 assert.deepEqual(planExpansionMotion(b,a).doorsLost,['door']);
});

test('combined expansion rendering includes real anchors for both online seats and solo',()=>{
 const expansions=['towers','dreamcatchers','premonitions','mirrors','oniverse','book','glyphs'];
 for(const mode of ['solo','coop']){
  const s=newGame({mode,seed:38,config:{expansions}});
  for(const seat of mode==='coop'?[0,1]:[0]){
   const v=viewFor(s,seat),html=mode==='coop'?renderCooperativeTabletop(v,{seat}):renderSoloTabletop(v);
   for(const zone of ['alignment','catchers','premonitions','mirrors','denizens'])assert.match(html,new RegExp(`data-tt-zone="${zone}"`));
   assert.match(html,/tt32-spell-book/);
   const delta=planExpansionMotion(v,structuredClone(v));
   assert.deepEqual(delta.spellSpent,[]);assert.deepEqual(delta.treasureStored,[]);
   if(mode==='coop')assert.equal(v.players[1-seat].hand.every(c=>c.kind==='hidden'),true);
  }
 }
});

test('all feedback paints in place and respects both reduced-motion settings',()=>{
 assert.match(css,/tt8-expansion-cue/);assert.match(css,/tt8-expansion-loss/);
 assert.match(css,/data-motion="reduced"/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/tt8-expansion-(?:wake|fade)[^{]*\{[^}]*translate/);
});
