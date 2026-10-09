import test from 'node:test';
import assert from 'node:assert/strict';
import {planGameTransitions} from '../public/tabletop/animation.js';
import {renderCard} from '../public/tabletop/cards.js';
const card=(id,kind='location')=>({id,kind,color:'red',symbol:'sun'});
const solo=(rest={})=>({mode:'solo',phase:'action',status:'active',turn:1,active:0,deckCount:70,discard:[],limbo:[],players:[{hand:[card('a'),card('b')],labyrinth:[],doors:[]}],...rest});
test('Phase 7 identifies play, refill, and discard movement from public views',()=>{
 const a=solo(),b=solo({deckCount:69,players:[{hand:[card('b'),card('c')],labyrinth:[card('a')],doors:[]}]});
 const p=planGameTransitions(a,b);
 assert(p.moved.includes('a'));assert(p.drawn.includes('c'));assert.equal(p.draw,1);
 const d=solo({deckCount:69,discard:[card('a')],players:[{hand:[card('b'),card('c')],labyrinth:[],doors:[]}]});
 assert(planGameTransitions(a,d).moved.includes('a'));
});
test('Phase 7 handles draft movement between visible cards without revealing hidden hands',()=>{
 const a={mode:'coop',phase:'draft',turn:1,active:0,status:'active',deckCount:56,discard:[],limbo:[],draft:[card('d1'),card('d2')],shared:[],players:[{hand:[],labyrinth:[],doors:[]},{hand:[{id:'secret',kind:'hidden'}],labyrinth:[],doors:[]}]};
 const b={...a,active:1,draft:[card('d2')],players:[{hand:[card('d1')],labyrinth:[],doors:[]},a.players[1]]};
 const p=planGameTransitions(a,b);assert(p.moved.includes('d1'));assert(!p.moved.includes('secret'));assert(p.draft);assert(p.turn);
 assert.doesNotMatch(renderCard({id:'secret',kind:'hidden'}),/data-tt-motion-id=/);
});
test('Phase 7 signals Limbo reshuffle and changes in turn, phase, and result',()=>{
 const a=solo({deckCount:1,limbo:[card('n','nightmare')],phase:'decision',pending:{type:'nightmare'}});
 const b=solo({deckCount:2,limbo:[],turn:2,active:0,phase:'action',status:'won'});
 const p=planGameTransitions(a,b);assert(p.shuffle);assert(p.turn);assert(p.phase);assert(p.finished);
});
test('Phase 7 ignores initial views and incompatible game modes',()=>{
 const a=solo();assert.equal(planGameTransitions(null,a),null);assert.equal(planGameTransitions(a,{...a,mode:'coop'}),null);
});
test('Phase 7 adds presentation-only card tags to visible cards',()=>{
 const html=renderCard(card('visible-1'),{select:true});
 assert.match(html,/data-tt-motion-id="visible-1"/);
 assert.match(html,/data-pick="visible-1"/);
});
test('Phase 7 animates revealed decision cards, but does not enumerate deck-search options',()=>{
 const a=solo({deckCount:60}),b=solo({deckCount:55,phase:'decision',pending:{type:'prophecy',cards:[card('look1'),card('look2')]}});
 const p=planGameTransitions(a,b);assert(p.drawn.includes('look1'));assert(p.drawn.includes('look2'));
 const secret={...b,pending:{type:'happyFetch',options:[card('not-yet-visible')]}};
 assert(!planGameTransitions(a,secret).drawn.includes('not-yet-visible'));
});
test('Phase 7 tracks moves into and out of a concealed cooperative hand using only public identifiers',()=>{
 const hidden={id:'drafted',kind:'hidden'};
 const original={mode:'coop',phase:'draft',status:'active',turn:1,active:0,deckCount:60,discard:[],limbo:[],draft:[card('drafted')],players:[{hand:[],labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}]};
 const after={...original,active:1,draft:[],players:[original.players[0],{hand:[hidden],labyrinth:[],doors:[]}]};
 const draft=planGameTransitions(original,after);
 assert.deepEqual(draft.toHidden,['drafted']);assert(!draft.drawn.includes('drafted'));
 const played={...after,phase:'action',players:[original.players[0],{hand:[],labyrinth:[card('drafted')],doors:[]}]};
 const reveal=planGameTransitions(after,played);
 assert.deepEqual(reveal.fromHidden,['drafted']);assert(!reveal.drawn.includes('drafted'));
});
