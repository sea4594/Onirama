// Replay presentation clock. This module is intentionally presentation-only:
// it reads public snapshots, never game commands or private engine state.
import {planGameTransitions} from './tabletop/animation.js';
import {CARD_MOTION} from './tabletop/animation-timing.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Wait for the *current* frame's physical effects before advancing to the
// next one. Unlike the old fixed 850 ms interval, a multi-card flip cannot be
// interrupted by the next snapshot. Times include stagger and cleanup slack.
export function replayFrameDelay(previous,current,{reduced=false}={}){
  if(reduced)return 480;
  if(!previous||!current)return 620;
  const plan=planGameTransitions(previous,current);
  if(!plan)return 620;
  const travel=plan.moved.length+plan.toHidden.length+plan.fromHidden.length+
    plan.toDiscard.length+plan.toLimbo.length+(plan.anonymousDraftToHand?.length||0)+(plan.anonymousDraw||0);
  const moveTime=travel?CARD_MOTION.move+Math.min(8,travel-1)*CARD_MOTION.stagger:0;
  const reveals=plan.draw&&plan.drawn.length?CARD_MOTION.reveal+Math.min(7,plan.drawn.length-1)*250:0;
  const premonitions=plan.premRevealed.length?CARD_MOTION.reveal+Math.min(4,plan.premRevealed.length-1)*180:0;
  const returns=plan.shuffle?(plan.overload?CARD_MOTION.move+650:plan.catcherFreed.length?CARD_MOTION.move+220:320)+CARD_MOTION.shuffle:0;
  const nonCard=plan.turn||plan.phase||plan.finished?CARD_MOTION.highlight:0;
  // A public hand-back draft requires one transfer even with anonymized hands.
  return clamp(Math.max(620,moveTime,reveals,premonitions,returns,nonCard)+140,620,4300);
}

// One owned timer; pausing, scrubbing, closing, and replay replacement cannot
// leave callbacks which unexpectedly advance a later replay session.
export function createReplayPlaybackClock({getIndex,getLength,delay,onStep,onComplete,
  schedule=setTimeout,cancel=clearTimeout}={}){
  let timer=null,playing=false,generation=0;
  const clear=()=>{generation++;if(timer!==null)cancel(timer);timer=null;};
  const queue=()=>{
    if(!playing)return;
    const stamp=generation,at=getIndex();
    timer=schedule(()=>{
      if(!playing||stamp!==generation)return;
      timer=null;
      if(at!==getIndex()){queue();return;}
      if(at>=getLength()-1){playing=false;onComplete?.();return;}
      onStep(at+1);
      queue();
    },Math.max(0,delay(at)));
  };
  return {
    start(){if(playing||getLength()<2)return false;playing=true;clear();queue();return true;},
    pause(){playing=false;clear();},
    reset(){playing=false;clear();},
    get playing(){return playing;},
    get pending(){return timer!==null;}
  };
}
