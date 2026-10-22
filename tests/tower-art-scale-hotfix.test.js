import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
import {newGame,viewFor} from '../engine/game.js';

const styles=readFileSync(new URL('../public/tabletop/card-system.css',import.meta.url),'utf8');
const art=styles.slice(styles.indexOf('/* Tower artwork is a single card-relative composition'));
const face=card=>renderCard(card,{select:true});
const tower={id:'tower-test',kind:'tower',color:'green',number:12,left:'sun+moon',right:'moon+sun'};

test('cooperative Tower draft cards keep complete, same-sized face artwork',()=>{
 const draft=face(tower);
 assert.match(draft,/class="card green card-kind-tower/);
 assert.equal((draft.match(/tt8-tower-mark"/g)||[]).length,4);
 assert.equal((draft.match(/<svg class="ui-icon"/g)||[]).length,5,'four edge marks and the central tower emblem');
 assert.match(draft,/tt11-tower-number">12<\/strong>/);
 // Selecting or minimizing a card must not cause a separate Tower drawing.
 const small=renderCard(tower,{tiny:true}),staticCard=renderCard(tower);
 const getFace=h=>h.match(/<span class="tt5-tower-face">([\s\S]*?)<\/span><\/div>/)?.[1];
 assert.equal(getFace(small),getFace(staticCard));
 assert.equal(getFace(staticCard),getFace(draft.replace('</button>','</div>')));
});

test('Tower emblem and sun/moon icons use card-relative dimensions, not viewport or em font scaling',()=>{
 assert.match(art,/\.card\.card-kind-tower\{container-type:inline-size!important\}/);
 assert.match(art,/\.card\.card-kind-tower \.tt5-tower-face>\.tt11-tower-emblem\{[\s\S]*?width:50%!important;height:34%!important/);
 assert.match(art,/\.card\.card-kind-tower \.tt5-tower-face>\.tt11-tower-emblem>\.ui-icon\{[\s\S]*?width:100%!important;height:100%!important/);
 assert.match(art,/\.card\.card-kind-tower \.tt8-tower-mark>\.ui-icon\{[\s\S]*?width:100%!important;height:100%!important/);
 assert.match(art,/\.card\.card-kind-tower \.tt5-tower-face>\.tt11-tower-number\{[\s\S]*?font-size:26cqw!important/);
 assert.doesNotMatch(art,/\d+(?:\.\d+)?vw|\d+(?:\.\d+)?em\b/);
 assert.doesNotMatch(art,/\.tt6-draft|\.tt6-hand|\.tt8-towers-slot/,'face artwork must not change with card location');
});

test('Tower artwork remains identical across solo, both multiplayer seats and all difficulty settings',()=>{
 for(const mode of ['solo','coop']){
  for(const expansions of [['towers'],['towers','glyphs','oniverse']]){
   const game=newGame({seed:90210,mode,config:{expansions},interactiveDraw:true});
   const state=viewFor(game,0);
   const candidate=(game.deck||[]).find(c=>c.kind==='tower')||game.moduleState?.towers?.alignment?.[0];
   assert(candidate,`Tower exists for ${mode}: ${expansions}`);
   for(const seat of mode==='coop'?[0,1]:[0]){
    assert(viewFor(game,seat));
    const rendered=renderCard(candidate,{select:true,tiny:seat===1});
    assert.match(rendered,/tt5-tower-face/);
    assert.match(rendered,/tt11-tower-emblem/);
    assert.match(rendered,/tt11-tower-number/);
   }
  }
 }
});
