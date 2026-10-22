import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTabletopAnimator} from '../public/tabletop/animation.js';
import {createTabletopInteractions} from '../public/tabletop/interactions.js';

const location=id=>({id,kind:'location',color:'red',symbol:'sun'});
const tower=id=>({id,kind:'tower',left:'sun',right:'moon'});
const player=(hand=[],labyrinth=[])=>({hand,labyrinth,doors:[]});
const game=(mode,card,seat=0)=>({mode,phase:'action',status:'active',active:seat,turn:1,
  deckCount:40,shuffleSerial:0,players:mode==='coop'?[player(seat===0?[card]:[]),player(seat===1?[card]:[])]:[player([card])],
  shared:[],draft:[],discard:[],limbo:[],expansion:{towers:{alignment:[]}}});
const R=(left,top=30,width=60)=>({left,top,width,height:width*1.42});

function element(rect,kind='card',id='a',record=()=>{}){
  const flags=new Set();
  const el={dataset:{ttMotionId:id,ttCard:id},className:kind,attributes:[],children:[],
    classList:{add:x=>flags.add(x),remove:x=>flags.delete(x),toggle(){},contains:x=>flags.has(x)},
    style:{setProperty(){},removeProperty(){}},
    getBoundingClientRect:()=>rect,
    matches:s=>kind==='card'&&s.includes('.card'),
    cloneNode(){return element(rect,kind,id,record);},
    querySelectorAll(){return [];},
    removeAttribute(){},setAttribute(){},appendChild(child){this.children.push(child);return child;},
    remove(){},animate(frames,options){record({frames,options});return {cancel(){},finished:new Promise(()=>{})};}
  };
  return el;
}
function sceneHarness(){
  const flights=[],source=R(12),destination=R(470),release=R(365);
  let cards=[element(source,'card','a',x=>flights.push(x))];
  const dock=element(R(250),'pile','',x=>flights.push(x));
  const board=element(R(0),'tt2-root','',x=>flights.push(x));
  const root={
    querySelectorAll(selector){return selector.includes('[data-tt-motion-id]')?cards:[];},
    querySelector(selector){
      if(selector==='.tt6-table-slot .tt2-root')return board;
      if(selector.includes('inspectPile:discard'))return dock;
      if(selector.includes('tt5-alignment'))return element(destination,'pile');
      return null;
    }
  };
  const doc={hidden:false,documentElement:{dataset:{motion:'normal'}},
    body:{appendChild(){}},createElement:()=>element(R(0),'stage','',x=>flights.push(x))};
  return {root,doc,source,destination,release,flights,
    toLabyrinth(){cards=[element(destination,'card','a',x=>flights.push(x))];},
    toDiscard(){cards=[];}};
}

// Exercise the actual animator, not just a textual check. A pending online
// action first renders the OLD game with busy=true; only later will its
// committed Firebase snapshot render the new state.
for(const destination of ['labyrinth','discard','towers']){
  test(`online ${destination} transfer continues from release after pending renders`,()=>{
    const h=sceneHarness(),originalDoc=globalThis.document,originalMedia=globalThis.matchMedia;
    globalThis.document=h.doc;globalThis.matchMedia=()=>({matches:false});
    const animator=createTabletopAnimator({root:h.root});
    try{
      const card=destination==='towers'?tower('a'):location('a');
      const prior=game('coop',card);
      const next=game('coop',card);
      next.players[0].hand=[];
      if(destination==='labyrinth')next.players[0].labyrinth=[card];
      if(destination==='discard')next.discard=[card];
      if(destination==='towers')next.expansion.towers.alignment=[card];
      const version=v=>({online:true,version:v});
      animator.before(prior,'ABCD','#/game',version(20));
      animator.after(prior,'ABCD','#/game',version(20));
      animator.dragRelease('a',h.release);
      // Busy, optimistic, and metadata-only renders must NOT reset the source.
      for(let i=0;i<3;i++){
        animator.before(prior,'ABCD','#/game',version(20));
        animator.after(prior,'ABCD','#/game',version(20));
      }
      animator.before(next,'ABCD','#/game',version(21));
      if(destination==='discard')h.toDiscard();else h.toLabyrinth();
      animator.after(next,'ABCD','#/game',version(21));
      assert.equal(h.flights.length,1,'one card movement, without a restarted flight');
      const frame=h.flights[0].frames[0];
      const target=destination==='discard'?R(250):h.destination;
      const expectedX=h.release.left+h.release.width/2-(target.left+target.width/2);
      assert.match(frame.transform,new RegExp(`translate\\(${expectedX}px,`),
        'flight begins where the player released the card, not at the original hand slot');
    }finally{
      animator.reset();
      if(originalDoc===undefined)delete globalThis.document;else globalThis.document=originalDoc;
      if(originalMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=originalMedia;
    }
  });
}

test('rejected commands, room changes and reduced motion clear stale release points',()=>{
  const h=sceneHarness(),originalDoc=globalThis.document;
  globalThis.document=h.doc;
  const animator=createTabletopAnimator({root:h.root});
  try{
    assert.equal(typeof animator.clearDragRelease,'function');
    animator.dragRelease('a',h.release);
    animator.clearDragRelease();
    animator.viewportChanged();
    animator.resync();
    // These operations must be safe even if no motion stage was constructed.
    animator.before(null,'ABCD','#/multiplayer');
    animator.after(null,'ABCD','#/multiplayer');
  }finally{animator.reset();if(originalDoc===undefined)delete globalThis.document;else globalThis.document=originalDoc;}
});

test('pointerup measures FINAL position; legal hand drops dispatch in coop and solo',()=>{
  const origDoc=globalThis.document,origWindow=globalThis.window;
  for(const mode of ['solo','coop'])for(const pointerType of ['mouse','touch'])for(const target of ['play','discard','towerLeft','towerRight']){
    const c=target.startsWith('tower')?tower('a'):location('a'),g=game(mode,c);
    const board=element(R(0),'board'),source=element(R(12),'card','a');
    source.dataset.ttCard='a';
    source.closest=selector=>selector.includes('[data-tt-card]')?source:null;
    const zone=element(R(450),'drop','');zone.dataset.ttDrop=target;
    zone.closest=selector=>selector.includes('[data-tt-drop]')?zone:null;
    board.contains=el=>el===source||el===zone;
    board.dataset={selectedCard:''};
    board.querySelectorAll=selector=>selector==='[data-tt-card]'?[source]:selector==='[data-tt-drop]'?[zone]:[];
    source.cloneNode=()=>{
      const ghost=element(R(0),'card','a');ghost.style={left:'0px',top:'0px',width:'60px',height:'85.2px'};
      ghost.getBoundingClientRect=()=>R(Number.parseFloat(ghost.style.left),Number.parseFloat(ghost.style.top));
      return ghost;
    };
    const handlers=new Map(),win=new Map(),events=[];
    const root={addEventListener(name,cb){handlers.set(name,cb);},removeEventListener(){},
      querySelector(selector){return selector.startsWith('.tt2-root')?board:null;}};
    globalThis.document={body:{appendChild(){}},elementFromPoint:()=>zone};
    globalThis.window={addEventListener(name,cb){win.set(name,cb);},removeEventListener(){}};
    const controller=createTabletopInteractions({root,getGame:()=>g,getSeat:()=>0,
      onDrop:(id,rect)=>events.push({kind:'drop',id,rect}),onCommand:(action,id)=>events.push({kind:'action',action,id})});
    try{
      handlers.get('pointerdown')({button:0,pointerType,pointerId:1,clientX:25,clientY:45,target:source});
      win.get('pointermove')({pointerId:1,clientX:110,clientY:100,preventDefault(){}});
      // Deliberately NO pointermove at the final release coordinates.
      win.get('pointerup')({pointerId:1,clientX:340,clientY:210});
      assert.deepEqual(events.map(e=>e.kind),['drop','action'],`${mode} ${target} has one valid command`);
      assert.equal(events[0].rect.left,340-(25-12),`${mode} ${target} uses pointerup X`);
      assert.equal(events[0].rect.top,210-(45-30),`${mode} ${target} uses pointerup Y`);
      assert.equal(events[1].action,target);
    }finally{controller.dispose();}
  }
  if(origDoc===undefined)delete globalThis.document;else globalThis.document=origDoc;
  if(origWindow===undefined)delete globalThis.window;else globalThis.window=origWindow;
});

test('action error clears armed drop before a later unrelated action',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/catch\(e\)\{tabletopAnimator\?\.clearDragRelease\?\.\(\);setError\(e\.message\)/);
  assert.match(app,/finally\{busy=false;render\(\);tabletopAnimator\?\.clearDragRelease\?\.\(\);\}/);
});
