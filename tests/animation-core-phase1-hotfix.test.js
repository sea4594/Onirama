import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planGameTransitions,flightGeometry,cardFlightRects} from '../public/tabletop/animation.js';

const c=id=>({kind:'location',id,color:'red',symbol:'sun'});
const player=(hand=[],labyrinth=[],doors=[])=>({hand,labyrinth,doors});
const solo=(overrides={})=>({mode:'solo',phase:'action',status:'active',turn:0,active:0,deckCount:50,players:[player([c('a'),c('b'),c('c'),c('d')])],discard:[],limbo:[],...overrides});
const coop=(overrides={})=>({mode:'coop',phase:'draft',status:'active',turn:0,active:0,deckCount:50,players:[player(),player()],shared:[],draft:[],discard:[],limbo:[],...overrides});
const source=readFileSync(new URL('../public/tabletop/animation.js',import.meta.url),'utf8');

test('moving a single card out of a hand does not move all shifted siblings',()=>{
 const old=solo();
 const next=solo({players:[player([c('b'),c('c'),c('d')],[c('a')])]});
 assert.deepEqual(planGameTransitions(old,next).moved,['a']);
 assert.deepEqual(planGameTransitions(old,solo({players:[player([c('b'),c('c'),c('d'),c('a')])]})).moved,[],'same-zone reorder is not four transfers');
 assert.deepEqual(planGameTransitions(old,solo({players:[player([c('a'),c('c'),c('d')])]})).moved,[],'removing one card does not animate neighbors');
});

test('transfers into existing discard and limbo zones are detected exactly once',()=>{
 const previous=solo({discard:[c('old-discard')],limbo:[c('old-limbo')]});
 const discard=solo({players:[player([c('b'),c('c'),c('d')])],discard:[c('old-discard'),c('a')],limbo:[c('old-limbo')]});
 const limbo=solo({players:[player([c('b'),c('c'),c('d')])],discard:[c('old-discard')],limbo:[c('old-limbo'),c('a')]});
 assert.deepEqual(planGameTransitions(previous,discard).toDiscard,['a']);
 assert.deepEqual(planGameTransitions(previous,limbo).toLimbo,['a']);
 assert.deepEqual(planGameTransitions(previous,discard).moved,['a']);
 assert.deepEqual(planGameTransitions(previous,limbo).moved,['a']);
});

test('a draft becoming a concealed partner card receives one transfer',()=>{
 const previous=coop({draft:[c('one')],players:[player(),player()]});
 const next=coop({draft:[],players:[player(),player([{id:'one',kind:'hidden'}])]});
 const plan=planGameTransitions(previous,next);
 assert.deepEqual(plan.toHidden,['one']);
 assert.deepEqual(plan.draftToHand,['one']);
 assert.deepEqual(plan.moved,[]);
 assert.match(source,/for\(const id of plan\.toHidden\)/);
 assert.doesNotMatch(source,/for\(const id of plan\.draftToHand/,'draft-to-hidden should use the single concealed transfer');
});

test('reordering a Tower or a Dreamcatcher stack does not produce unrelated flights',()=>{
 const old=solo({expansion:{towers:{alignment:[c('t1'),c('t2')]},dreamcatchers:{stacks:[[c('e1'),c('e2')]]}}});
 const next=solo({expansion:{towers:{alignment:[c('new'),c('t1'),c('t2')]},dreamcatchers:{stacks:[[c('e2'),c('e1')]]}}});
 const p=planGameTransitions(old,next);
 assert.deepEqual(p.moved,[]);
 assert.deepEqual(p.drawn,['new']);
});

test('landscape shelf and concealed backs are included in motion capture',()=>{
 assert.match(source,/\.tt6-hand-shelf \[data-tt-motion-id\]/);
 assert.match(source,/\.tt6-hand-shelf \.tt6-opponent \.tt6-card-back/);
});

test('flight geometry scales uniformly and keeps normal card aspect',()=>{
 const from={left:10,top:50,width:90,height:90};
 const to={left:180,top:100,width:40,height:90};
 const geometry=cardFlightRects(from,to);
 assert(Math.abs(geometry.from.height/geometry.from.width-1.42)<1e-9);
 assert(Math.abs(geometry.to.height/geometry.to.width-1.42)<1e-9);
 const flight=flightGeometry(geometry.from,geometry.to);
 assert(flight && flight.scale>0);
 assert.equal(flight.dx,55-200);
 assert.equal(flight.dy,95-145);
 assert.match(source,/scale\(\$\{scale\}\)/);
 assert.doesNotMatch(source,/scale\(\$\{sx\},\$\{sy\}\)/);
});
