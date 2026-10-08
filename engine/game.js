import { createDeck, COLORS } from './cards.js';
import {shuffle} from './random.js';

const own = (state) => state.players[state.active];
const hand = (state) => own(state).hand;
const need = (state) => state.mode==='solo'?5:3;
const target = (state) => state.mode==='solo'?5:3;
const takeTop = (state) => state.deck.pop();
const note=(s,message)=>{s.log.push(message); if(s.log.length>150)s.log.shift();};
function fail(message){ throw new Error(message); }
function required(cond,message){if(!cond) fail(message);}
const matchingKeys=(s,color)=>[
  ...hand(s).filter(x=>x.symbol==='key' && x.color===color).map(x=>({id:x.id,zone:'personal'})),
  ...(s.mode==='coop'?s.shared.filter(x=>x.symbol==='key' && x.color===color).map(x=>({id:x.id,zone:'shared'})):[])
];
function spots(s) { const a=[...hand(s).map(x=>({id:x.id,zone:'personal',card:x}))]; if(s.mode==='coop')a.push(...s.shared.map(x=>({id:x.id,zone:'shared',card:x})));return a; }
function removeSpot(s,id){
  const p=spots(s).find(x=>x.id===id); required(p,'Card is not available to the active player');
  const arr=p.zone==='personal'?hand(s):s.shared;
  return arr.splice(arr.findIndex(x=>x.id===id),1)[0];
}
function findById(arr,id){ return arr.find(x=>x.id===id); }
function acquireDoor(s,door,from) {
  // In cooperative play every player must collect one of each color.
  if(s.mode==='coop' && own(s).doors.some(x=>x.color===door.color)) { s.limbo.push(door);note(s,`An already-collected ${door.color} Door enters Limbo.`);return; }
  own(s).doors.push(door);note(s,`${own(s).name} unlocked a ${door.color} Door (${from}).`);
  if(s.mode==='solo' ? own(s).doors.length===8 : s.players.every(p=>COLORS.every(c=>p.doors.some(d=>d.color===c)))){
    s.status='won';s.phase='ended';s.pending=null;note(s,'All required Doors collected. Victory!');
  }
}
function reshuffleLimbo(s) { if(s.limbo.length){s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);note(s,'Limbo shuffled into deck.');} }
// Initial and Nightmare-replacement drawing: Dreams and Doors enter Limbo without effects.
function dealLocation(s,to){
  while(true){
    if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'No Location remains to complete the hand.');return false;}
    const card=takeTop(s);
    if(card.kind==='location'){to.push(card);return true;}
    s.limbo.push(card);
  }
}
function fillSpecial(s){
  while(hand(s).length<need(s)) if(!dealLocation(s,hand(s)))return false;
  if(s.mode==='coop')while(s.shared.length<2) if(!dealLocation(s,s.shared))return false;
  return true;
}
function afterTurn(s) {
  reshuffleLimbo(s);
  if(s.status!=='active') return;
  s.active=s.mode==='coop'?1-s.active:0;
  s.turn++;s.phase='action';s.pending=null;
  note(s,`${own(s).name}'s turn.`);
}
function refill(s){
  // A cancelled/returned action never enters this function until all its decisions complete.
  if(s.status!=='active')return;
  s.phase='refill';
  while(hand(s).length<target(s) || (s.mode==='coop' && s.shared.length<2)) {
    if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'The deck is empty before the hand can be refilled. Defeat.');return;}
    const card=takeTop(s);
    if(card.kind==='location'){
      if(hand(s).length<target(s))hand(s).push(card); else s.shared.push(card);
      continue;
    }
    if(card.kind==='door'){
      const keys=matchingKeys(s,card.color);
      if(keys.length){s.pending={type:'door',card,keys};s.phase='decision';note(s,`A ${card.color} Door appeared. Claim it with a Key or send it to Limbo.`);return;}
      s.limbo.push(card);note(s,`A ${card.color} Door entered Limbo.`);continue;
    }
    if(card.kind==='nightmare'){
      s.pending={type:'nightmare',card};s.phase='decision';note(s,'A Nightmare appeared. Choose a penalty.');return;
    }
    fail(`Unsupported drawn card: ${card.kind}`);
  }
  afterTurn(s);
}
function resolveNightmare(s,option,id){
  const nightmare=s.pending.card;
  if(option==='key'){
    const k=findById(spots(s).filter(x=>x.card.symbol==='key').map(x=>x.card),id);
    required(k,'Select an available Key');s.discard.push(removeSpot(s,id));
    note(s,'A Key was sacrificed to the Nightmare.');
  } else if(option==='door') {
    const index=own(s).doors.findIndex(x=>x.id===id);
    required(index!==-1,'Select one of your collected Doors');
    s.limbo.push(own(s).doors.splice(index,1)[0]);note(s,'A Door was returned to Limbo.');
  } else if(option==='reveal') {
    for(let i=0;i<5 && s.deck.length;i++){
      const c=takeTop(s);(c.kind==='location'?s.discard:s.limbo).push(c);
    }
    note(s,'Five cards were revealed; Locations discarded, Dreams and Doors to Limbo.');
  } else if(option==='hand') {
    s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));
    note(s,'The entire hand was discarded and replaced.');
    // The Nightmare being resolved is discarded before the special redraw.
    s.discard.push(nightmare);s.pending=null;
    if(fillSpecial(s))afterTurn(s);
    return;
  } else fail('Choose a valid Nightmare penalty');
  s.discard.push(nightmare);s.pending=null;refill(s);
}
export function newGame({mode='solo',seed=Date.now(),names=['Dreamwalker','Partner']}={}){
  required(['solo','coop'].includes(mode),'Invalid mode');
  const players=names.slice(0,mode==='coop'?2:1).map((name,i)=>({id:i,name:String(name||`Player ${i+1}`).slice(0,40),hand:[],labyrinth:[],doors:[],streakColor:null,streak:0}));
  const s={schema:1,mode,rng:(Number(seed)>>>0)||1,deck:createDeck(),discard:[],limbo:[],shared:[],draft:[],players,active:0,turn:1,phase:mode==='coop'?'draft':'action',pending:null,status:'active',log:[]};
  shuffle(s,s.deck);
  if(mode==='solo'){for(let i=0;i<5;i++)if(!dealLocation(s,players[0].hand))return s;}
  else {for(let i=0;i<8;i++)if(!dealLocation(s,s.draft))return s;}
  reshuffleLimbo(s);note(s,mode==='coop'?'Draft three personal cards each; the remaining two are shared.':'A new dream begins.');return s;
}
export function legalActions(s){
  if(s.status!=='active')return [];
  if(s.phase==='draft')return s.draft.map(c=>({type:'draft',id:c.id}));
  if(s.phase==='decision') {
    if(s.pending.type==='door')return [{type:'door',choices:s.pending.keys.map(k=>k.id).concat(['limbo'])}];
    if(s.pending.type==='doorSearch')return [{type:'doorSearch',choices:['claim','skip']}];
    if(s.pending.type==='nightmare')return [{type:'nightmare',choices:[
      ...(spots(s).some(x=>x.card.symbol==='key')?['key']:[]),
      ...(own(s).doors.length?['door']:[]),'reveal','hand'
    ]}];
    if(s.pending.type==='prophecy')return [{type:'prophecy',choices:s.pending.cards.map(c=>c.id)}];
    return [];
  }
  if(s.phase!=='action')return [];
  return spots(s).flatMap(x=>[
    ...(own(s).labyrinth.at(-1)?.symbol!==x.card.symbol?[{type:'play',id:x.id}]:[]),
    {type:'discard',id:x.id}
  ]);
}
function finishAction(s){refill(s);}
export function act(previous,command){
  const s=structuredClone(previous);
  required(s.status==='active','Game has ended');
  required(command && typeof command==='object','Missing command');
  if(s.phase==='draft'){
    required(command.type==='draft','Choose a card from the draft');
    const i=s.draft.findIndex(c=>c.id===command.id);required(i!==-1,'Card is not available to draft');
    hand(s).push(s.draft.splice(i,1)[0]);note(s,`${own(s).name} drafted a card.`);
    if(s.players.every(p=>p.hand.length===3)){s.shared=s.draft.splice(0);s.active=0;s.phase='action';note(s,'The two remaining cards became shared resources.');}
    else s.active=1-s.active;
    return s;
  }
  if(s.phase==='action'){
    if(command.type==='play'){
      const selection=spots(s).find(x=>x.id===command.id);required(selection,'Card not in your resources');
      const last=own(s).labyrinth.at(-1);required(!last||last.symbol!==selection.card.symbol,'Adjacent Labyrinth cards must have different symbols');
      const c=removeSpot(s,command.id);own(s).labyrinth.push(c);const p=own(s);
      p.streak=c.color===p.streakColor?p.streak+1:1;p.streakColor=c.color;
      note(s,`${p.name} played ${c.color} ${c.symbol}.`);
      if(p.streak===3){
        p.streak=0;const available=s.deck.some(d=>d.kind==='door'&&d.color===c.color);
        if(available){s.pending={type:'doorSearch',color:c.color};s.phase='decision';return s;}
        note(s,`No ${c.color} Door was available in the deck.`);
      }
      finishAction(s);
    } else if(command.type==='discard'){
      const c=removeSpot(s,command.id);s.discard.push(c);note(s,`${own(s).name} discarded ${c.color} ${c.symbol}.`);
      if(s.mode==='coop' && command.swapWith){
        const fromPersonal=own(s).hand.findIndex(x=>x.id===command.swapWith.personal);
        const fromShared=s.shared.findIndex(x=>x.id===command.swapWith.shared);
        required(fromPersonal!==-1&&fromShared!==-1,'Swap requires one personal and one shared card');
        [own(s).hand[fromPersonal],s.shared[fromShared]]=[s.shared[fromShared],own(s).hand[fromPersonal]];
        note(s,'The active player swapped a personal card with a shared card.');
      }
      if(c.symbol==='key'){
        const cards=s.deck.splice(Math.max(0,s.deck.length-5)).reverse();
        // cards are ordered from top (first) to deeper (last).
        if(cards.length){s.pending={type:'prophecy',cards,slot:command.zone||null};s.phase='decision';return s;}
      }
      finishAction(s);
    } else if(command.type==='swap') {
      // Official swap is part of the discard action; handled atomically by discard's swapWith parameter below.
      fail('Swap must be selected during a discard');
    } else fail('That action is not available now');
    return s;
  }
  required(s.phase==='decision'&&s.pending,'Resolve the current decision first');
  if(s.pending.type==='doorSearch'){
    required(command.type==='doorSearch','Choose whether to search for the Door');
    required(['claim','skip'].includes(command.option),'Invalid Door search choice');
    if(command.option==='claim'){
      const i=s.deck.findIndex(d=>d.kind==='door'&&d.color===s.pending.color);
      if(i!==-1){const d=s.deck.splice(i,1)[0];acquireDoor(s,d,'Labyrinth');shuffle(s,s.deck);}
    }
    s.pending=null;refill(s);return s;
  }
  if(s.pending.type==='door'){
    required(command.type==='chooseDoor','Choose whether to claim the Door');
    const d=s.pending.card;
    if(command.keyId==='limbo') s.limbo.push(d);
    else {
      required(s.pending.keys.some(k=>k.id===command.keyId),'Key does not match this Door');
      s.discard.push(removeSpot(s,command.keyId));acquireDoor(s,d,'Key');
    }
    s.pending=null;refill(s);return s;
  }
  if(s.pending.type==='nightmare'){
    required(command.type==='nightmare','Choose a Nightmare penalty');resolveNightmare(s,command.option,command.cardId);return s;
  }
  if(s.pending.type==='prophecy'){
    required(command.type==='prophecy','Complete Prophecy');
    const cards=s.pending.cards;
    required(cards.some(c=>c.id===command.discardId),'Select one of the revealed cards to discard');
    const remaining=cards.filter(c=>c.id!==command.discardId);
    required(Array.isArray(command.order)&&command.order.length===remaining.length&&new Set(command.order).size===remaining.length&&command.order.every(id=>remaining.some(c=>c.id===id)),'Invalid Prophecy order');
    s.discard.push(cards.find(c=>c.id===command.discardId));
    // order is top-first and deck top is the last array element.
    for(const id of [...command.order].reverse())s.deck.push(remaining.find(c=>c.id===id));
    note(s,'Prophecy completed.');s.pending=null;refill(s);return s;
  }
  fail('Unsupported pending decision');
}
// Minimize information disclosure for a viewer; never expose deck contents or the PRNG seed.
export function viewFor(s,seat=null){
  const copy=structuredClone(s);delete copy.rng;
  copy.deckCount=copy.deck.length;delete copy.deck;
  if(copy.mode==='coop')for(let i=0;i<copy.players.length;i++)if(i!==seat){
    copy.players[i].hand=copy.players[i].hand.map(x=>({id:x.id,kind:'hidden'}));
  }
  if(copy.pending && seat!==s.active && copy.mode==='coop')copy.pending={type:'private-decision',player:s.active};
  return copy;
}
export function assertConserved(s){
  const piles=[s.deck,s.discard,s.limbo,s.shared,s.draft,...s.players.flatMap(p=>[p.hand,p.labyrinth,p.doors])];
  if(s.pending?.card)piles.push([s.pending.card]);
  if(s.pending?.cards)piles.push(s.pending.cards);
  const all=piles.flat().map(c=>c.id);
  required(all.length===76,`Card count ${all.length}, expected 76`);
  required(new Set(all).size===76,'Duplicate card instance');
  return true;
}
