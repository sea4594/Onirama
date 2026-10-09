import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDialogController,renderGameDialog} from '../public/tabletop/dialogs.js';
import {planTabletop} from '../public/tabletop/layout.js';

const source=readFileSync('public/app.js','utf8');
const css=readFileSync('public/styles.css','utf8');

test('the only game boards are solo and cooperative; legacy panels cannot resurface',()=>{
 assert.match(source,/if\(g\.mode==='solo'\)return renderSoloTabletop/);
 assert.match(source,/if\(g\.mode==='coop'\)return renderCooperativeTabletop/);
 assert.match(source,/Unsupported game mode/);
 assert.doesNotMatch(source,/function expansionBoard\(/);
 assert.doesNotMatch(source,/function doors\(/);
 assert.doesNotMatch(source,/class="game-layout"/);
 assert.doesNotMatch(css,/\.game-layout\b|\.board-side\b|\.expansion-list\b|\.hero\{/);
});

test('the released shell retains no-login Firebase multiplayer and a current commit',()=>{
 assert.match(source,/firebase\.firebaseAction\(/);
 assert.match(source,/firebase\.joinFirebaseRoom\(/);
 assert.match(source,/BUILD_COMMIT\.slice\(0,8\)/);
 assert.match(source,/9 of 9/);
 assert.doesNotMatch(source,/renderDoors\(/);
});

test('all representative screen sizes retain the complete tabletop zone inventory',()=>{
 for(const [width,height] of [[320,568],[568,320],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  for(const mode of ['solo','coop']){
   const plan=planTabletop({width,height,mode,expansions:['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']});
   assert.ok(plan.zones.length>=10);
   assert.ok(plan.cardWidth>=42);
   assert.ok(plan.regions.core.includes('limbo'));
   assert.ok(plan.regions.core.includes('draw'));
   assert.ok(plan.regions.core.includes('discard'));
   if(mode==='coop')assert.ok(plan.regions.players.includes('shared-hand'));
  }
 }
});

function setupFocus(){
 const state={active:null,overlay:null,dialog:null,opener:null,items:[]};
 function node(attributes={},modal=false){
  const el={id:attributes.id||'',hidden:false,isConnected:true,attributes,
   hasAttribute:k=>Object.hasOwn(attributes,k),getAttribute:k=>attributes[k]??null,
   closest:s=>s==='[data-tt4-dialog]'&&modal?state.dialog:null,
   focus(){state.active=el;},setAttribute(k,v){attributes[k]=v;},removeAttribute(k){delete attributes[k];}};
  return el;
 }
 const root={contains:el=>[state.opener,...state.items].includes(el),
  querySelector:s=>s==='[data-tt4-dialog]'?state.dialog:s==='[data-tt4-overlay]'?state.overlay:s==='#main-content'?state.opener:state.opener,
  querySelectorAll:s=>s==='.nav,.page,.bottom-nav'?[]:state.items,
  addEventListener(){} };
 const documentBackup=globalThis.document;
 globalThis.document={get activeElement(){return state.active;},documentElement:{classList:{toggle(){}}}};
 const controller=createDialogController({root,onDismiss:()=>{state.dismissed=(state.dismissed||0)+1;}});
 const restore=()=>{if(documentBackup===undefined)delete globalThis.document;else globalThis.document=documentBackup;};
 return {state,node,root,controller,restore};
}

test('dialog focus remains on the chosen card after rerender and returns to opener on close',()=>{
 const {state,node,controller,restore}=setupFocus();
 try{
  state.opener=node({'data-action':'openSpells'});state.active=state.opener;
  const before=controller.capture();
  state.overlay={dataset:{tt4Key:'context:spellbook',tt4Overlay:'optional'}};
  state.dialog={contains:el=>state.items.includes(el),querySelectorAll:()=>state.items,focus(){state.active=this;}};
  state.items=[node({'data-action':'spellCost:first'},true),node({'data-action':'spellCost:second'},true)];
  controller.sync(before);assert.equal(state.active,state.items[0]);
  state.active=state.items[1];const snapshot=controller.capture();
  state.items=[node({'data-action':'spellCost:first'},true),node({'data-action':'spellCost:second'},true)];
  controller.sync(snapshot);assert.equal(state.active,state.items[1]);
  const leaving=controller.capture();state.overlay=null;state.dialog=null;
  state.opener=node({'data-action':'openSpells'});state.items=[state.opener];
  controller.sync(leaving);assert.equal(state.active,state.opener);
 }finally{restore();}
});

test('mandatory dialogs cannot be dismissed by clicking a close icon',()=>{
 const required=renderGameDialog({type:'nightmare',html:'<button>Resolve</button>',mandatory:true});
 const optional=renderGameDialog({type:'spellbook',html:'<button>Cast</button>',mandatory:false});
 assert.doesNotMatch(required,/data-action="dialogClose"/);
 assert.match(optional,/data-action="dialogClose"/);
 assert.match(required,/aria-modal="true"/);
});
