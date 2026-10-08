import {zoneArray} from './zones.js';
import {shuffle} from './random.js';

// Serializable FIFO effect/continuation interpreter. Public API works on a draft clone.
// An interrupt suspends the remaining effects in state; only the authorized engine resumes it.
export function enqueueEffects(s,effects){
  if(!Array.isArray(effects))throw Error('Effects must be an array');
  s.effects??=[];s.continuations??=[];
  s.effects.push(...structuredClone(effects));
  return continueEffects(s);
}
export function continueEffects(s){
  if(s.pending)return s;
  let ticks=0;
  while(s.effects?.length){
    if(++ticks>10000)throw Error('Effect loop guard');
    const effect=s.effects.shift();
    if(effect.type==='log'){
      s.log.push(String(effect.message).slice(0,300));if(s.log.length>150)s.log.shift();
    }else if(effect.type==='move'){
      const source=zoneArray(s,effect.from),dest=zoneArray(s,effect.to),index=source.findIndex(c=>c.id===effect.cardId);
      if(index<0)throw Error('Source card is not in the specified zone');
      if(effect.from===effect.to)throw Error('Self-move is not supported');
      const [c]=source.splice(index,1);if(effect.position==='bottom')dest.unshift(c);else dest.push(c);
    }else if(effect.type==='shuffle'){
      shuffle(s,zoneArray(s,effect.zone));
    }else if(effect.type==='decision'){
      if(typeof effect.id!=='string'||!effect.options?.length||!effect.actorId&&effect.actorId!==0)throw Error('Invalid decision effect');
      s.pending={type:'moduleDecision',id:effect.id,actorId:effect.actorId,options:effect.options.map(x=>String(x)),visibility:effect.visibility||'private'};
      s.continuations.push({resumePhase:s.phase,decisionId:effect.id});s.phase='decision';
      return s; // Suspend without consuming any subsequent queued effects.
    }else throw Error(`Unsupported effect: ${effect.type}`);
  }
  return s;
}
export function resolveEffectDecision(s,{decisionId,choice},actorId){
  const pending=s.pending;
  if(!pending||pending.type!=='moduleDecision'||pending.id!==decisionId||pending.actorId!==actorId||!pending.options.includes(choice))throw Error('Invalid or unauthorized effect decision');
  const last=s.continuations?.at(-1);
  if(last?.decisionId!==decisionId)throw Error('Interrupted effect stack is inconsistent');
  s.continuations.pop();s.pending=null;s.phase=last.resumePhase;
  s.events??=[];s.events.push({type:'decision',id:decisionId,choice,actorId});
  return continueEffects(s);
}
