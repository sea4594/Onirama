import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalGameKey,createOptimisticQueue} from '../public/firebase-optimistic.js';
import {fitDenizenCards} from '../public/tabletop/denizen-fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderDenizenTabletop} from '../public/tabletop/expansions.js';

const pause=()=>new Promise(resolve=>setImmediate(resolve));
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {resolve,reject,promise};};

test('multiplayer game fingerprints ignore object key order, not actual card order',()=>{
 const game={players:[{hand:[{id:'a',kind:'location'},{id:'b',kind:'location'}],doors:[{color:'red'}]}],expansion:{book:{active:true}},phase:'action'};
 const reordered={phase:'action',expansion:{book:{active:true}},players:[{doors:[{color:'red'}],hand:[{kind:'location',id:'a'},{kind:'location',id:'b'}]}]};
 assert.equal(canonicalGameKey({game}),canonicalGameKey({game:reordered}));
 assert.notEqual(canonicalGameKey({game}),canonicalGameKey({game:{...reordered,players:[{...reordered.players[0],hand:[...reordered.players[0].hand].reverse()}]}}));
 assert.equal(canonicalGameKey({game:null}),canonicalGameKey({}));
});

test('queued valid multiplayer actions survive Firestore map key reordering',async()=>{
 let latest={version:1,game:{phase:'action',resources:{blue:2,red:1},turn:4}};
 const writes=[],shown=[],failures=[];
 const q=createOptimisticQueue({
  latest:()=>latest,
  predict:(room,cmd)=>({version:room.version+1,game:{...room.game,turn:room.game.turn+cmd}}),
  submit:(cmd,baseGame)=>{const gate=pending();writes.push({cmd,baseGame,gate});return gate.promise;},
  present:(room)=>shown.push(room.game.turn),failed:e=>failures.push(e)
 });
 const a=q.enqueue(1),b=q.enqueue(1);
 assert.deepEqual(shown,[5,6]);
 writes[0].gate.resolve({version:2,game:{turn:5,resources:{red:1,blue:2},phase:'action'}});
 await a.settled;await pause();
 assert.equal(writes.length,2,'second action proceeds rather than being rejected as diverged');
 assert.equal(writes[1].baseGame,canonicalGameKey({game:{turn:5,phase:'action',resources:{red:1,blue:2}}}));
 writes[1].gate.resolve({version:3,game:{turn:6,phase:'action',resources:{blue:2,red:1}}});
 await b.settled;
 assert.equal(failures.length,0);
 assert.equal(q.hasPending(),false);
 const firebase=readFileSync('public/firebase-room.js','utf8');
 assert.match(firebase,/if\(canonicalGameKey\(before\)!==expectedGame\)/,'transaction and queue must compare using the same canonical representation');
});

function mkStyle(){const seen=[];return {seen,setProperty:(name,value,priority)=>seen.push([name,value,priority])};}
function mockCard(){return {style:mkStyle()};}
function mkHolder(type){
 const inner=mockCard(),button=type==='tt17-denizen-reserve'?null:{style:mkStyle(),querySelector:s=>s===':scope > .card'?inner:null};
 return {style:mkStyle(),classList:{contains:n=>n===type},querySelector:s=>s===':scope > .card'?inner:s===':scope > .tt17-denizen-card'?button:null,inner,button};
}
test('Denizen fitter sizes the actual cards and buttons, not just a CSS variable on their lane',()=>{
 const holders=[mkHolder('tt17-denizen-holder'),mkHolder('tt17-denizen-holder'),mkHolder('tt17-denizen-reserve')];
 const values=[];
 const lane={children:holders,clientWidth:140,style:{setProperty:(name,value)=>values.push([name,value])}};
 assert.equal(fitDenizenCards({querySelectorAll:()=>[lane]}),1);
 assert.deepEqual(values,[['--tt35-measured-width','44px']]);
 for(const h of holders){
  for(const node of [h,h.button,h.inner].filter(Boolean)){
   for(const prop of ['width','height','min-width','max-width','aspect-ratio']){
    const record=node.style.seen.find(([n])=>n===prop);
    assert(record,`${prop} must be applied directly to each rendered element`);
    assert.equal(record[2],'important',`${prop} must beat old high-specificity card rules`);
   }
   assert.equal(node.style.seen.find(([n])=>n==='width')[1],'44px');
   assert.equal(node.style.seen.find(([n])=>n==='height')[1],'62.48px');
  }
 }
});

test('Denizens start as complete cards even before the first resize measurement',()=>{
 for(const mode of ['solo','coop']){
  const g=newGame({mode,seed:27222,config:{expansions:['oniverse']}});
  const d=g.moduleState.oniverse.zones;
  d.rallied=d.unused.slice(0,4).map((c,i)=>({...c,owner:mode==='solo'?0:i%2}));
  const html=renderDenizenTabletop(viewFor(g,0),{owner:mode==='solo'?null:0});
  assert.match(html,/class="tt17-denizen-holder" style="width:44px!important;min-width:44px!important;flex:0 0 44px!important;height:62.48px!important"/);
  assert.match(html,/tt17-denizen-card/);
 }
});
