import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARD_MOTION,cardTransferDuration} from '../public/tabletop/animation-timing.js';
import {revealCenter,cardFlightRects,flightGeometry,createTabletopAnimator,planGameTransitions} from '../public/tabletop/animation.js';
import {replayFrameDelay} from '../public/replay-playback.js';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('public/tabletop/animation.js');
const css=read('public/tabletop/animation.css');
const app=read('public/app.js');
const area=(x,y,width=65,height=92)=>({left:x,top:y,width,height});
const card=id=>({kind:'location',id,color:'red',symbol:'sun'});
const view=(values={})=>({mode:'coop',status:'active',phase:'action',turn:0,active:0,deckCount:30,shuffleSerial:0,players:[{hand:[],labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}],shared:[],draft:[],discard:[],limbo:[],...values});

test('CSS-pixel movement times scale with distance, not display pixel density',()=>{
 const from=area(10,20),near=area(65,40),medium=area(280,130),far=area(1600,820);
 const short=cardTransferDuration(from,near),middle=cardTransferDuration(from,medium),long=cardTransferDuration(from,far);
 assert(short>=230&&short<middle&&middle<long);
 assert(long<=CARD_MOTION.move);
 assert.equal(cardTransferDuration(null,far),CARD_MOTION.move);
 assert.equal(cardTransferDuration(from,{...far,left:NaN}),CARD_MOTION.move);
 assert.equal(cardTransferDuration(from,far),cardTransferDuration(from,far),'same coordinates yield same timing');
});

test('all flying cards retain a physical 1:1.42 aspect ratio across viewport sizes',()=>{
 for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  const left=area(10,height-145,Math.min(75,width/6),72),right=area(width-92,40,85,130);
  const fitted=cardFlightRects(left,right);
  for(const r of [fitted.from,fitted.to])assert(Math.abs(r.height/r.width-1.42)<1e-9);
  const geometry=flightGeometry(fitted.from,fitted.to);
  assert(geometry&&Number.isFinite(geometry.dx)&&Number.isFinite(geometry.dy)&&geometry.scale>0);
 }
 assert.match(source,/cardTransferDuration\(start,destination\)/);
 assert.doesNotMatch(source,/duration:CARD_MOTION\.move,delay/);
});

test('portrait keeps centered reveals, wide desktop anchors reveals to the true path',()=>{
 const from=area(70,100),to=area(390,220);
 assert.deepEqual(revealCenter(from,to,{screenWidth:390,screenHeight:844,cardWidth:100,cardHeight:142}),{x:195,y:422});
 assert.deepEqual(revealCenter(from,to,{screenWidth:768,screenHeight:1024}),{x:384,y:512});
 const wide=revealCenter(from,to,{screenWidth:1440,screenHeight:900,cardWidth:148,cardHeight:210});
 assert(wide.x<440,'wide-screen reveal stays near the actual transfer');
 assert(wide.y<350,'wide-screen reveal follows tabletop equipment');
 const edge=revealCenter(area(-100,-60),area(10,10),{screenWidth:1440,screenHeight:900,cardWidth:148,cardHeight:210});
 assert(edge.x>=86&&edge.y>=117,'no reveal is clipped through viewport edge');
});

test('replay frame intervals account for every final motion duration',()=>{
 const prior=view(),drawn=view({deckCount:29,players:[{hand:[card('c')],labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}]});
 const played=view({players:[{hand:[],labyrinth:[card('c')],doors:[]},{hand:[],labyrinth:[],doors:[]}]});
 const shuffled=view({deckCount:33,shuffleSerial:1});
 assert(replayFrameDelay(prior,drawn)>CARD_MOTION.reveal);
 assert(replayFrameDelay(drawn,played)>CARD_MOTION.move);
 assert(replayFrameDelay(prior,shuffled)>CARD_MOTION.shuffle);
 assert(replayFrameDelay(prior,drawn,{reduced:true})<replayFrameDelay(prior,drawn));
 assert.deepEqual(planGameTransitions(drawn,played).moved,['c']);
});

test('rotation and reduced motion clean up effects rather than replaying actions',()=>{
 const animator=createTabletopAnimator({root:{}});
 assert.doesNotThrow(()=>{animator.viewportChanged();animator.resync();animator.viewportChanged();});
 assert.match(source,/viewportChanged\(\)\{pending=null;drop=null;clearMotion\(\);\}/);
 assert.match(source,/if\(!enabled\(\)\)clearMotion\(\)/);
 assert.match(source,/motion\?\.cancel\(\)/,'animations are canceled when clones are removed');
 assert.match(source,/clearTimeout\(timer\);el\.classList\.remove\(cls\)/,'superseded flashes release timers');
 assert.match(app,/tabletopAnimator\?\.viewportChanged\?\.\(\)/);
 assert.match(app,/viewportRefitPlan\(lastMotionViewport,next,\{type:event\?\.type\}\)/);
 assert.match(app,/visualViewport\?\.scale>1\.01/,'pinch zoom does not trigger repeated refitting');
 assert.doesNotMatch(app,/maximum-scale=/,'the Safari viewport meta tag must not be rewritten');
});

test('final styling is paint-only, with a restrained turn handoff and reduced-motion fallback',()=>{
 assert.match(css,/Phase 6: one restrained movement language/);
 assert.match(css,/@keyframes tt8-turn\{[^}]*box-shadow:none;filter:none/);
 assert.match(css,/html\[data-motion="reduced"\]/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert(!/position:(?:fixed|absolute)|min-height|grid-template|padding/.test(css.split('/* Phase 6: one restrained movement language')[1]));
 assert.equal(CARD_MOTION.turn,360);
});
