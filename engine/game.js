import {createDeck,COLORS,expectedCards} from './cards.js';
import {shuffle} from './random.js';
import {validateConfig,normalizeSave,RULESET_VERSION} from './config.js';
import {enqueueEffects,resolveEffectDecision} from './effects.js';
import {assertCardsUnique} from './zones.js';
import {activeModules,emitGameEvent,hasAlignment,objectives} from './modules.js';
const has=(s,id)=>s.config.expansions.includes(id);
const own=s=>s.players[s.active];
const hand=s=>own(s).hand;
const quota=s=>s.mode==='solo'?5:3;
const takeTop=s=>s.deck.pop();
const note=(s,msg)=>{s.log.push(msg);if(s.log.length>150)s.log.shift();};
const event=(s,type,data={})=>{const effects=emitGameEvent(s,{type,...data});if(effects.length)enqueueEffects(s,effects);};
function need(ok,msg){if(!ok)throw Error(msg);}
function spots(s){return [...hand(s).map(c=>({card:c,id:c.id,zone:'personal'})),...(s.mode==='coop'?s.shared.map(c=>({card:c,id:c.id,zone:'shared'})):[])];}
function takeSpot(s,id){const p=spots(s).find(x=>x.id===id);need(p,'Card not available to the active player');const arr=p.zone==='personal'?hand(s):s.shared;return arr.splice(arr.findIndex(c=>c.id===id),1)[0];}
function matchingKeys(s,color){return spots(s).filter(x=>x.card.kind==='location'&&x.card.symbol==='key'&&x.card.color===color).map(x=>({id:x.id,zone:x.zone}));}
function book(s){return s.moduleState.book;}
function dream(s){return s.moduleState.dreamcatchers;}
function tower(s){return s.moduleState.towers.zones.alignment;}
function stacks(s){return dream(s).zones;}
function catcherIds(s){return has(s,'dreamcatchers')?dream(s).active.map((active,i)=>active?i:null).filter(i=>i!==null):[];}
function occupied(s){return catcherIds(s).filter(i=>stacks(s)['catch'+i].length);}
function freeCatcher(s,i){need(occupied(s).includes(i),'Choose an occupied Dreamcatcher');s.deck.push(...stacks(s)['catch'+i].splice(0));shuffle(s,s.deck);note(s,`Dreamcatcher ${i+1} was freed and its cards reshuffled.`);}
function shuffleAfterSearch(s,freeId){
 if(has(s,'dreamcatchers')&&freeId!==undefined&&freeId!==null){need(Number.isInteger(freeId),'Invalid Dreamcatcher');freeCatcher(s,freeId);}
 else shuffle(s,s.deck);
}
function goals(s){return has(s,'book')?book(s).goals:[];}
function nextGoal(s){return goals(s).find(g=>!g.done);}
function isVictory(s){
 const required=has(s,'glyphs')?12:8;
 const doors=s.players.flatMap(p=>p.doors);
 if(doors.length!==required)return false;
 if(s.mode==='coop'&&!s.players.every(p=>COLORS.every(c=>p.doors.some(d=>d.color===c))))return false;
 if(has(s,'book')&&goals(s).some(g=>!g.done))return false;
 if(has(s,'towers')&&!hasAlignment(tower(s)))return false;
 if(has(s,'dreamcatchers')&&Object.values(stacks(s)).flat().filter(c=>c.kind==='lostDream').length!==4)return false;
 return true;
}
function checkWin(s){if(s.status==='active'&&isVictory(s)){s.status='won';s.phase='ended';s.pending=null;s.interrupts=[];note(s,'All objectives completed. Victory!');return true;}return false;}
function acquireDoor(s,door,source){
 if(has(s,'book')){const g=nextGoal(s);if(!g||g.color!==door.color){s.limbo.push(door);note(s,`The ${door.color} Door did not match the next Goal and entered Limbo.`);return false;}
   g.done=true;g.doorId=door.id;
 }
 // Each player needs one Door per color in cooperative play. Duplicates are
 // retained with Glyphs until the extra team objective is satisfied.
 if(s.mode==='coop'&&!has(s,'glyphs')&&own(s).doors.some(c=>c.color===door.color)){
   if(has(s,'book')){const g=goals(s).find(x=>x.doorId===door.id);g.done=false;g.doorId=null;}
   s.limbo.push(door);note(s,`Duplicate cooperative ${door.color} Door entered Limbo.`);return false;
 }
 own(s).doors.push(door);note(s,`${own(s).name} unlocked a ${door.color} Door (${source}).`);event(s,'doorAcquired',{doorId:door.id,color:door.color,source,player:s.active});checkWin(s);return true;
}
function loseDoor(s,id){const p=own(s),idx=p.doors.findIndex(c=>c.id===id);need(idx!==-1,'Select one of your collected Doors');const door=p.doors.splice(idx,1)[0];s.limbo.push(door);
 if(has(s,'book')){const g=goals(s).find(x=>x.doorId===door.id);if(g){g.done=false;g.doorId=null;}}
 note(s,`A ${door.color} Door returned to Limbo; any completed Goal for it reopened.`);
}
function dealLocation(s,to){while(true){if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'No Location remains to complete the hand.');return false;}const c=takeTop(s);if(c.kind==='location'||c.kind==='tower'){to.push(c);return true;}s.limbo.push(c);}}
function fillSpecial(s){while(hand(s).length<quota(s))if(!dealLocation(s,hand(s)))return false;if(s.mode==='coop')while(s.shared.length<2)if(!dealLocation(s,s.shared))return false;return true;}
function endTurn(s){
 if(s.status!=='active')return;
 if(has(s,'dreamcatchers')&&s.limbo.length){
   const empty=catcherIds(s).filter(i=>stacks(s)['catch'+i].length===0);
   s.pending={type:empty.length?'catchChoose':'catchOverload',choices:empty.length?empty:catcherIds(s)};s.phase='decision';return;
 }
 if(s.limbo.length){s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);note(s,'Limbo shuffled into deck.');event(s,'limboResolved');}
 advanceTurn(s);
}
function advanceTurn(s){if(checkWin(s)||s.status!=='active')return;s.active=s.mode==='coop'?1-s.active:0;s.turn++;s.phase='action';s.pending=null;note(s,`${own(s).name}'s turn.`);}
function afterNightmare(s,n,special=false){
 if(has(s,'towers')&&tower(s).length&&!hasAlignment(tower(s))||has(s,'towers')&&tower(s).length&&s.config.difficulties.towers==='hard'){
   s.pending={type:'towerPenalty',card:n,special};s.phase='decision';return;
 }
 s.discard.push(n);s.pending=null;if(special){if(fillSpecial(s))endTurn(s);}else refill(s);
}
function resolveNightmare(s,option,id){const n=s.pending.card;let special=false;
 if(option==='key'){need(spots(s).some(x=>x.id===id&&x.card.symbol==='key'),'Choose an available Key');s.discard.push(takeSpot(s,id));note(s,'A Key was sacrificed.');}
 else if(option==='door'){loseDoor(s,id);}
 else if(option==='reveal'){for(let i=0;i<5&&s.deck.length;i++){const c=takeTop(s);(c.kind==='location'||c.kind==='tower'?s.discard:s.limbo).push(c);}note(s,'Nightmare revealed up to five cards.');}
 else if(option==='hand'){s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));special=true;note(s,'The hand was discarded.');}
 else throw Error('Choose a valid Nightmare penalty');
 afterNightmare(s,n,special);
}
function refill(s){
 if(s.status!=='active')return;s.phase='refill';
 while(hand(s).length<quota(s)||(s.mode==='coop'&&s.shared.length<2)){
   if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'Deck exhausted before hand was refilled.');return;}
   const c=takeTop(s);
   if(c.kind==='location'||c.kind==='tower'){if(hand(s).length<quota(s))hand(s).push(c);else s.shared.push(c);continue;}
   if(c.kind==='door'){const keys=matchingKeys(s,c.color);if(keys.length){s.pending={type:'door',card:c,keys};s.phase='decision';return;}s.limbo.push(c);continue;}
   if(c.kind==='lostDream'){s.limbo.push(c);note(s,'A Lost Dream entered Limbo.');continue;}
   if(c.kind==='nightmare'){s.pending={type:'nightmare',card:c};s.phase='decision';return;}
   throw Error(`Unsupported drawn card: ${c.kind}`);
 }
 endTurn(s);
}
function takeLook(s,count,from='top'){if(from==='top')return s.deck.splice(Math.max(0,s.deck.length-count)).reverse();return s.deck.splice(0,count);}
function putTop(s,cards,ids){need(Array.isArray(ids)&&ids.length===cards.length&&new Set(ids).size===ids.length&&ids.every(id=>cards.some(c=>c.id===id)),'Invalid card order');for(const id of [...ids].reverse())s.deck.push(cards.find(c=>c.id===id));}
function putBottom(s,cards,ids){need(Array.isArray(ids)&&ids.length===cards.length&&new Set(ids).size===ids.length&&ids.every(id=>cards.some(c=>c.id===id)),'Invalid card order');s.deck.unshift(...ids.map(id=>cards.find(c=>c.id===id)));}
function completeAction(s){refill(s);}
function restoreInterrupt(s){const frame=s.interrupts.pop();if(frame){s.phase=frame.phase;s.pending=frame.pending;}else{s.pending=null;s.phase='action';}}
function spellCosts(s){return s.config.difficulties.book==='hard'?{paradox:6,parallel:9,punishment:12}:{paradox:5,parallel:7,punishment:10};}
function castSpell(s,cmd){need(has(s,'book'),'Book of Steps is not enabled');need(['paradox','parallel','punishment'].includes(cmd.spell),'Unknown spell');
 const cost=spellCosts(s)[cmd.spell];const ids=cmd.costIds;need(Array.isArray(ids)&&ids.length===cost&&new Set(ids).size===cost,'Select exactly the required number of discarded cards');
 need(ids.every(id=>s.discard.some(c=>c.id===id)),'Payment must be from the discard pile');
 if(cmd.spell==='punishment')need(s.pending?.type==='nightmare'&&s.phase==='decision','Punishment only cancels a Nightmare just drawn');
 if(cmd.spell==='parallel'){need(Number.isInteger(cmd.first)&&Number.isInteger(cmd.second)&&cmd.first!==cmd.second&&cmd.first>=0&&cmd.second>=0&&cmd.first<goals(s).length&&cmd.second<goals(s).length,'Select two different Goals');}
 if(cmd.spell==='paradox')need(s.deck.length>0,'Deck is empty');
 const removed=book(s).zones.removed;for(const id of ids)removed.push(s.discard.splice(s.discard.findIndex(c=>c.id===id),1)[0]);
 note(s,`Cast ${cmd.spell}; removed ${cost} cards from the game.`);
 if(cmd.spell==='punishment'){const n=s.pending.card;s.discard.push(n);s.pending=null;refill(s);return;}
 if(cmd.spell==='parallel'){const g=goals(s);[g[cmd.first],g[cmd.second]]=[g[cmd.second],g[cmd.first]];checkWin(s);return;}
 // Suspend even a nested decision. Suspended physical cards remain tracked.
 s.interrupts.push({phase:s.phase,pending:s.pending});s.pending={type:'spellPeek',cards:takeLook(s,5,'bottom')};s.phase='decision';
}
function edgesConflict(left,right){return left!=null&&right!=null&&left===right;}
function playTower(s,cmd){const found=spots(s).find(x=>x.id===cmd.id);need(found?.card.kind==='tower','Choose a Tower');need(cmd.side==='left'||cmd.side==='right','Choose left or right');const a=tower(s),c=found.card;
 if(a.length){const neighbor=cmd.side==='left'?a[0]:a.at(-1);need(!edgesConflict(...(cmd.side==='left'?[c.right,neighbor.left]:[neighbor.right,c.left])),'Tower edge symbols cannot match');}
 takeSpot(s,cmd.id);if(cmd.side==='left')a.unshift(c);else a.push(c);note(s,`Played ${c.color} Tower on the ${cmd.side}.`);if(checkWin(s))return;completeAction(s);
}
function doorSearchTargets(s,color){const targets=s.deck.filter(c=>c.kind==='door'&&c.color===color).map(c=>({id:c.id,source:'deck'}));
 if(has(s,'dreamcatchers'))for(const i of catcherIds(s))targets.push(...stacks(s)['catch'+i].filter(c=>c.kind==='door'&&c.color===color).map(c=>({id:c.id,source:'catch'+i})));
 return targets;
}
function claimSearch(s,color,id,freeId){const options=doorSearchTargets(s,color);need(options.some(x=>x.id===id),'This Door is not available for the search');const o=options.find(x=>x.id===id);const from=o.source==='deck'?s.deck:stacks(s)[o.source];const d=from.splice(from.findIndex(c=>c.id===id),1)[0];acquireDoor(s,d,o.source==='deck'?'Labyrinth':'Dreamcatcher');if(s.status==='active'&&o.source==='deck')shuffleAfterSearch(s,freeId);}
export function newGame({mode='solo',seed=Date.now(),names=['Dreamwalker','Partner'],config}={}){
 need(['solo','coop'].includes(mode),'Invalid game mode');const rules=validateConfig(config);
 const players=names.slice(0,mode==='coop'?2:1).map((name,i)=>({id:i,name:String(name||`Player ${i+1}`).slice(0,40),hand:[],labyrinth:[],doors:[],streakColor:null,streak:0}));
 const s={schema:3,rulesVersion:RULESET_VERSION,config:rules,moduleState:{},effects:[],continuations:[],events:[],interrupts:[],mode,rng:(Number(seed)>>>0)||1,deck:createDeck(rules.expansions),discard:[],limbo:[],shared:[],draft:[],players,active:0,turn:1,phase:mode==='coop'?'draft':'action',pending:null,status:'active',log:[]};
 for(const mod of activeModules(rules))s.moduleState[mod.id]=mod.setup(s);
 if(has(s,'dreamcatchers')&&rules.difficulties.dreamcatchers==='hard')dream(s).failsafes=0;
 shuffle(s,s.deck);
 if(mode==='solo'){for(let i=0;i<5;i++)if(!dealLocation(s,players[0].hand))return s;}
 else {for(let i=0;i<8;i++)if(!dealLocation(s,s.draft))return s;}
 if(s.limbo.length){s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);}
 note(s,mode==='coop'?'Draft three personal Locations each.':'A new dream begins.');return s;
}
export function legalActions(s){if(s.status!=='active')return [];
 if(s.phase==='draft')return s.draft.map(c=>({type:'draft',id:c.id}));
 const bonus=has(s,'book')&&s.discard.length>=Math.min(...Object.values(spellCosts(s)))?[{type:'cast',spells:Object.entries(spellCosts(s)).filter(([spell,cost])=>s.discard.length>=cost&&(spell!=='punishment'||s.pending?.type==='nightmare')).map(([spell])=>spell)}]:[];
 if(s.phase==='decision'){
  const p=s.pending;const list={door:{type:'door',choices:(p.keys||[]).map(x=>x.id).concat('limbo')},doorSearch:{type:'doorSearch',choices:doorSearchTargets(s,p.color)},nightmare:{type:'nightmare',choices:['key','door','reveal','hand']},prophecy:{type:'prophecy'},incantation:{type:'incantation'},towerLook:{type:'towerLook'},towerPenalty:{type:'towerPenalty'},catchChoose:{type:'catchChoose'},catchOverload:{type:'catchOverload'},spellPeek:{type:'spellPeek'},moduleDecision:{type:'moduleDecision'}};
  return [list[p.type]].filter(Boolean).concat(bonus);
 }
 if(s.phase!=='action')return [];
 const actions=spots(s).flatMap(x=>[...(x.card.kind==='location'&&own(s).labyrinth.at(-1)?.symbol!==x.card.symbol?[{type:'play',id:x.id}]:[]),...(x.card.kind==='tower'?[{type:'playTower',id:x.id}]:[]),{type:'discard',id:x.id}]);
 if(has(s,'dreamcatchers')&&dream(s).failsafes&&occupied(s).length)actions.push({type:'freeCatcher',choices:occupied(s)});
 return actions.concat(bonus);
}
export function act(previous,command){
 const s=structuredClone(normalizeSave(previous));need(s.status==='active','Game has ended');need(command&&typeof command==='object','Missing command');
 if(command.type==='cast'){need(s.phase==='action'||s.phase==='decision','Spell unavailable during draft or refill');castSpell(s,command);return s;}
 if(s.phase==='draft'){need(command.type==='draft','Choose a card from the draft');const i=s.draft.findIndex(c=>c.id===command.id);need(i!==-1,'Card not available in draft');hand(s).push(s.draft.splice(i,1)[0]);if(s.players.every(p=>p.hand.length===3)){s.shared=s.draft.splice(0);s.active=0;s.phase='action';}else s.active=1-s.active;return s;}
 if(s.phase==='action'){
  if(command.type==='freeCatcher'){need(has(s,'dreamcatchers')&&dream(s).failsafes>0,'No Failsafe Book available');need(occupied(s).includes(command.index),'Choose an occupied catcher');dream(s).failsafes--;freeCatcher(s,command.index);return s;}
  if(command.type==='playTower'){need(has(s,'towers'),'Towers expansion disabled');playTower(s,command);return s;}
  if(command.type==='play'){
   const f=spots(s).find(x=>x.id===command.id);need(f?.card.kind==='location','Choose a Location');const last=own(s).labyrinth.at(-1);need(!last||last.symbol!==f.card.symbol,'Adjacent Labyrinth cards must have different symbols');
   const c=takeSpot(s,command.id);own(s).labyrinth.push(c);const p=own(s);p.streak=c.color===p.streakColor?p.streak+1:1;p.streakColor=c.color;note(s,`${p.name} played ${c.color} ${c.symbol}.`);
   if(p.streak===3){p.streak=0;const targets=doorSearchTargets(s,c.color);if(targets.length){s.pending={type:'doorSearch',color:c.color};s.phase='decision';return s;}note(s,`No ${c.color} Door was available.`);}
   completeAction(s);return s;
  }
  if(command.type==='discard'){
   const f=spots(s).find(x=>x.id===command.id);need(f,'Card not available to discard');const c=takeSpot(s,command.id);s.discard.push(c);note(s,`${own(s).name} discarded ${c.color} ${c.symbol||'Tower'}.`);
   if(s.mode==='coop'&&command.swapWith){const i=hand(s).findIndex(x=>x.id===command.swapWith.personal),j=s.shared.findIndex(x=>x.id===command.swapWith.shared);need(i!==-1&&j!==-1,'Swap requires personal and shared cards');[hand(s)[i],s.shared[j]]=[s.shared[j],hand(s)[i]];}
   if(c.kind==='tower'){s.pending={type:'towerLook',cards:takeLook(s,c.number)};s.phase='decision';return s;}
   if(c.symbol==='glyph'){s.pending={type:'incantation',cards:takeLook(s,5)};s.phase='decision';return s;}
   if(c.symbol==='key'){const cards=takeLook(s,5);if(cards.length){s.pending={type:'prophecy',cards};s.phase='decision';return s;}}
   completeAction(s);return s;
  }
  throw Error('That action is unavailable');
 }
 need(s.phase==='decision'&&s.pending,'Resolve the pending decision first');const p=s.pending;
 if(p.type==='moduleDecision'){need(command.type==='moduleDecision','Resolve the pending effect decision');resolveEffectDecision(s,command,s.active);return s;}
 if(p.type==='doorSearch'){
   need(command.type==='doorSearch','Resolve Door search');need(['skip','claim'].includes(command.option),'Invalid Door search choice');
   if(command.option==='claim'){
     // Legacy commands can omit doorId; engine chooses the first matching card.
     const targets=doorSearchTargets(s,p.color),chosen=command.doorId||targets[0]?.id;need(chosen,'No matching Door exists');
     claimSearch(s,p.color,chosen,command.freeId);
   }
   if(s.status==='active'){s.pending=null;refill(s);}return s;
 }
 if(p.type==='door'){
   need(command.type==='chooseDoor','Resolve drawn Door');const d=p.card;
   if(command.keyId==='limbo')s.limbo.push(d);
   else {need(p.keys.some(k=>k.id===command.keyId),'Key does not match this Door');s.discard.push(takeSpot(s,command.keyId));acquireDoor(s,d,'Key');}
   if(s.status==='active'){s.pending=null;refill(s);}return s;
 }
 if(p.type==='nightmare'){need(command.type==='nightmare','Resolve the Nightmare');resolveNightmare(s,command.option,command.cardId);return s;}
 if(p.type==='towerPenalty'){
   need(command.type==='towerPenalty','Resolve Tower consequence');
   if(command.option==='discard'){
     const a=tower(s),i=a.findIndex(c=>c.id===command.towerId);need(i!==-1,'Select a played Tower');
     if(i>0&&i<a.length-1)need(!edgesConflict(a[i-1].right,a[i+1].left),'Removing this Tower would connect matching symbols');
     s.discard.push(a.splice(i,1)[0]);s.discard.push(p.card);note(s,'A Tower was destroyed by the Nightmare.');
   }else if(command.option==='fake'){s.limbo.push(p.card);note(s,'Nightmare sent to Limbo; Tower protected for now.');}
   else throw Error('Choose a Tower consequence');
   s.pending=null;if(p.special){if(fillSpecial(s))endTurn(s);}else refill(s);return s;
 }
 if(p.type==='prophecy'){need(command.type==='prophecy','Complete Prophecy');need(p.cards.some(c=>c.id===command.discardId),'Select a revealed card to discard');const rest=p.cards.filter(c=>c.id!==command.discardId);need(command.order?.length===rest.length,'Invalid Prophecy order');putTop(s,rest,command.order);s.discard.push(p.cards.find(c=>c.id===command.discardId));s.pending=null;refill(s);return s;}
 if(p.type==='towerLook'){need(command.type==='towerLook','Reorder inspected cards');putTop(s,p.cards,command.order);s.pending=null;refill(s);return s;}
 if(p.type==='incantation'){
   need(command.type==='incantation','Resolve Incantation');const doors=p.cards.filter(c=>c.kind==='door');
   const id=command.doorId;need(doors.length?(doors.some(c=>c.id===id)):(id===null||id===undefined),'Choose one revealed Door, if available');
   const rest=p.cards.filter(c=>c.id!==id);putBottom(s,rest,command.order);if(id){const d=doors.find(c=>c.id===id);acquireDoor(s,d,'Incantation');}
   if(s.status==='active'){s.pending=null;refill(s);}return s;
 }
 if(p.type==='spellPeek'){
   need(command.type==='spellPeek','Complete Paradoxical Prophecy');need(p.cards.some(c=>c.id===command.topId),'Choose a card to put on top');const rest=p.cards.filter(c=>c.id!==command.topId);putBottom(s,rest,command.bottomOrder);s.deck.push(p.cards.find(c=>c.id===command.topId));restoreInterrupt(s);return s;
 }
 if(p.type==='catchChoose'){
   need(command.type==='catchChoose'&&p.choices.includes(command.index),'Choose a free Dreamcatcher');stacks(s)['catch'+command.index].push(...s.limbo.splice(0));note(s,`Limbo was caught by Dreamcatcher ${command.index+1}.`);s.pending=null;advanceTurn(s);return s;
 }
 if(p.type==='catchOverload'){
   need(command.type==='catchOverload'&&p.choices.includes(command.index),'Choose a Dreamcatcher to sacrifice');
   const catcher=stacks(s)['catch'+command.index];s.limbo.push(...catcher.splice(0));dream(s).active[command.index]=false;
   s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);note(s,`Dreamcatcher ${command.index+1} was lost to overload.`);
   if(!catcherIds(s).length){s.status='lost';s.phase='ended';s.pending=null;note(s,'All Dreamcatchers have been lost.');return s;}
   s.pending=null;advanceTurn(s);return s;
 }
 throw Error('Unsupported pending decision');
}
export function viewFor(s,seat=null){const c=structuredClone(normalizeSave(s));delete c.rng;delete c.effects;delete c.continuations;delete c.events;delete c.interrupts;
 c.deckCount=c.deck.length;delete c.deck;
 c.objectives=objectives(s);
 // Public expansion state only: never expose pending hidden decks, removed-card identities, or future goals before revealed.
 c.expansion={};
 if(has(s,'book'))c.expansion.book={goals:goals(s).map(g=>({color:g.color,done:g.done})),discardCount:book(s).zones.removed.length,costs:spellCosts(s)};
 if(has(s,'dreamcatchers'))c.expansion.dreamcatchers={active:[...dream(s).active],failsafes:dream(s).failsafes,stacks:Object.values(stacks(s)).map(a=>structuredClone(a))};
 if(has(s,'towers'))c.expansion.towers={alignment:structuredClone(tower(s)),protected:hasAlignment(tower(s))&&s.config.difficulties.towers!=='hard'};
 delete c.moduleState;
 if(c.mode==='coop')for(let i=0;i<c.players.length;i++)if(i!==seat)c.players[i].hand=c.players[i].hand.map(x=>({id:x.id,kind:'hidden'}));
 if(c.pending?.type==='doorSearch'&&(c.mode==='solo'||seat===s.active))c.pending.targets=doorSearchTargets(s,c.pending.color);
 if(c.pending&&c.mode==='coop'&&seat!==s.active)c.pending={type:'private-decision',player:s.active};
 return c;
}
export function assertConserved(s){return assertCardsUnique(normalizeSave(s),expectedCards(s.config?.expansions||[]));}
