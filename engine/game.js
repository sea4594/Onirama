import {createDeck,COLORS,expectedCards} from './cards.js';
import {pileInventory} from './pile-inventory.js';
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
const note=(s,msg)=>{s.log.push(msg);};
const event=(s,type,data={})=>{const effects=emitGameEvent(s,{type,...data});if(effects.length)enqueueEffects(s,effects);};
function need(ok,msg){if(!ok)throw Error(msg);}
function spots(s){return [...hand(s).map(c=>({card:c,id:c.id,zone:'personal'})),...(s.mode==='coop'?s.shared.map(c=>({card:c,id:c.id,zone:'shared'})):[]),...(has(s,'oniverse')?oni(s).zones.treasure.filter(c=>c.owner===s.active).map(c=>({card:c,id:c.id,zone:'treasure'})):[])];}
function takeSpot(s,id){const p=spots(s).find(x=>x.id===id);need(p,'Card not available to the active player');const arr=p.zone==='personal'?hand(s):p.zone==='shared'?s.shared:oni(s).zones.treasure;const c=arr.splice(arr.findIndex(c=>c.id===id),1)[0];if(p.zone==='treasure'){const r=oni(s).zones.rallied,i=r.findIndex(d=>d.id===c.holderId);if(i>=0)s.discard.push(...r.splice(i,1));}return c;}
function matchingKeys(s,color){const chromatic=availableRallied(s,'chromatic').length>0;return spots(s).filter(x=>x.card.kind==='location'&&x.card.symbol==='key'&&(x.card.color===color||x.card.color==='wild'||color==='wild'||chromatic)).map(x=>({id:x.id,zone:x.zone}));}
function useDenizen(s,cmd){need(has(s,'oniverse'),'Door to the Oniverse is disabled');const d=availableRallied(s).find(x=>x.id===cmd.id);need(d,'Choose a rallied Denizen');
 const ability=d.ability;
 if(ability==='architect'){
   const f=spots(s).find(x=>x.id===cmd.cardId);need(f?.card.kind==='location','Choose a Location for the Architect');
   need(own(s).labyrinth.length&&own(s).labyrinth.at(-1).symbol===f.card.symbol,'Architect must override a matching adjacent symbol');
   need(canPlayLocation(s,f.card,true),'Difficult Crossroads allows a Crossroad only second in a series');
   spendDenizen(s,d.id,ability);const c=takeSpot(s,cmd.cardId);own(s).labyrinth.push(c);const color=runLocation(s,c);note(s,`Architect played ${c.color} ${c.symbol}.`);
   if(color){s.pending={type:'doorSearch',color};s.phase='decision';return;}
   refill(s);return;
 }
 if(ability==='cyclobot'){
   const f=spots(s).find(x=>x.id===cmd.cardId),i=s.discard.findIndex(x=>x.id===cmd.discardId);
   need(f?.card.kind==='location'&&i>=0&&s.discard[i].kind==='location','Exchange two Location cards');
   spendDenizen(s,d.id,ability);const c=takeSpot(s,cmd.cardId),j=s.discard.findIndex(x=>x.id===cmd.discardId),from=s.discard.splice(j,1)[0];s.discard.push(c);(f.zone==='shared'?s.shared:hand(s)).push(from);return;
 }
 if(ability==='hammer'){
   need(own(s).labyrinth.length>0,'The Labyrinth is empty');spendDenizen(s,d.id,ability);const row=own(s).labyrinth,color=row.at(-1).color;
   while(row.length&&row.at(-1).color===color)s.discard.push(row.pop());rebuildSeries(s);note(s,'Hammer Bird cleared the ending Labyrinth sequence.');return;
 }
 if(ability==='squirrel'||ability==='harpoon'){
   spendDenizen(s,d.id,ability);const cards=takeLook(s,5);if(ability==='harpoon'){s.discard.push(...cards.filter(c=>c.kind==='nightmare'));s.pending={type:'denizenPeek',cards:cards.filter(c=>c.kind!=='nightmare'),place:'bottom'};}else s.pending={type:'denizenPeek',cards,place:'top'};s.phase='decision';return;
 }
 if(ability==='keeper'){
   need(!oni(s).zones.treasure.some(c=>c.holderId===d.id),'Keeper already stores a card');const f=spots(s).find(x=>x.id===cmd.cardId);need(f&&f.zone!=='treasure'&&f.card.kind!=='deadEnd','Choose one eligible hand card to store');
   const c=takeSpot(s,cmd.cardId);c.holderId=d.id;c.owner=s.active;oni(s).zones.treasure.push(c);note(s,'A Location was placed beneath the Treasure Keeper.');refill(s);return;
 }
 throw Error(`${ability} can only be used when its triggering event occurs`);
}

// Phase 5 rules: all state transitions remain deterministic, serializable and server-owned.
const prem=s=>s.moduleState.premonitions;
const oni=s=>s.moduleState.oniverse;
const mirrors=s=>s.moduleState.mirrors;
const incubus=s=>s.moduleState.incubus;
const allDoors=s=>s.players.flatMap(p=>p.doors);
const basicDoors=s=>allDoors(s).filter(d=>d.kind==='door'&&d.expansion!=='oniverse');
const availableRallied=(s,ability)=>has(s,'oniverse')?oni(s).zones.rallied.filter(c=>c.owner===s.active&&(!ability||c.ability===ability)):[];
function spendDenizen(s,id,ability){const a=oni(s).zones.rallied,i=a.findIndex(c=>c.id===id&&c.owner===s.active&&c.ability===ability);need(i>=0,`No rallied ${ability} available`);const [c]=a.splice(i,1);s.discard.push(c);note(s,`Used ${ability} Denizen.`);return c;}
function targetDoors(s){return s.players.flatMap(p=>p.doors.map(d=>({id:d.id,color:d.color,owner:p.id})));}
function loseAnyDoor(s,id){const p=s.players.find(p=>p.doors.some(d=>d.id===id));need(p,'Select an acquired Door');const d=p.doors.splice(p.doors.findIndex(c=>c.id===id),1)[0];s.limbo.push(d);if(has(s,'book')){const g=goals(s).find(g=>g.doorId===d.id);if(g){g.done=false;g.doorId=null;}}note(s,`${p.name} lost a ${d.color} Door.`);}
function activePremonitions(s){if(!has(s,'premonitions'))return [];
 const doors=basicDoors(s),all=allDoors(s),counts=Object.fromEntries(COLORS.map(c=>[c,doors.filter(d=>d.color===c).length]));
 return prem(s).faceUp.filter(id=>id==='red2'?counts.red>=2:id==='green2'?counts.green>=2:id==='blue2'?counts.blue>=2:id==='brown2'?counts.brown>=2:id==='pair2'?COLORS.some(c=>counts[c]>=2):id==='doors5'?all.length>=5:id==='rainbow4'?COLORS.every(c=>counts[c]>0):id==='doors3'?all.length>=3:false);
}
function exposePremonitions(s,n){prem(s).faceUp.push(...prem(s).reserve.splice(0,n));}
function premonitionLoop(s,after='refill'){
 if(s.status!=='active')return;
 const options=activePremonitions(s);
 if(options.length){s.pending={type:'premonitionPick',options,after};s.phase='decision';return;}
 s.pending=null;if(after==='action'){s.phase='action';return;}if(after==='special'){if(fillSpecial(s))endTurn(s);return;}if(after==='mirrorDoors'){continueMirrorDoors(s);return;}refill(s);
}
function applyPremonition(s,id,after){const p=prem(s);need(activePremonitions(s).includes(id),'Premonition trigger is not active');p.faceUp.splice(p.faceUp.indexOf(id),1);p.resolved.push(id);note(s,`Dark Premonition: ${id}.`);
 if(id==='red2'){s.discard.push(...s.deck.filter(c=>c.kind==='location'&&c.color==='red'));s.deck=s.deck.filter(c=>!(c.kind==='location'&&c.color==='red'));}
 else if(id==='green2'){const i=s.discard.findIndex(c=>c.kind==='nightmare');if(i>=0)s.limbo.push(...s.discard.splice(i,1));}
 else if(id==='blue2'){let n=0;for(let i=s.deck.length-1;i>=0&&n<2;i--)if(s.deck[i].kind==='location'&&s.deck[i].symbol==='key'){s.discard.push(...s.deck.splice(i,1));n++;}}
 else if(id==='brown2'||id==='pair2'){const choices=targetDoors(s).filter(d=>id==='brown2'||targetDoors(s).filter(x=>x.color===d.color).length>=2);if(choices.length){s.pending={type:'premonitionDoor',id,choices,after};s.phase='decision';return;}}
 else if(id==='doors5')exposePremonitions(s,2);
 else if(id==='rainbow4'){s.discard.push(...s.deck.filter(c=>c.kind==='happyDream'));s.deck=s.deck.filter(c=>c.kind!=='happyDream');}
 else if(id==='doors3'){s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));if(!fillSpecial(s))return;exposePremonitions(s,1);}
 premonitionLoop(s,after);
}
function finishAcquisition(s){if(s.status==='active')premonitionLoop(s,'refill');}
function canPlayLocation(s,c,allowMatchingSymbol=false){
 if(!allowMatchingSymbol&&own(s).labyrinth.at(-1)?.symbol===c.symbol)return false;
 return c.color!=='wild'||s.config.difficulties.crossroads!=='hard'||(own(s).series?.length===1&&own(s).series[0].color!=='wild');
}
function matchesAspect(c,aspect){return COLORS.includes(aspect)?(c.color===aspect||c.color==='wild'):c.symbol===aspect;}
function runLocation(s,c){const p=own(s);p.series??=[];let series=p.series;
 const real=series.find(x=>x.color!=='wild');if(real&&c.color!=='wild'&&c.color!==real.color)series=[];
 if(c.color==='wild'&&series.some(x=>x.color==='wild'))series=[];
 series.push({id:c.id,color:c.color});
 if(series.length>=3){const realColors=series.filter(x=>x.color!=='wild').map(x=>x.color),wildIndex=series.findIndex(x=>x.color==='wild');const valid=realColors.length>=2&&realColors.every(v=>v===realColors[0])&&(wildIndex<0||s.config.difficulties.crossroads!=='hard'||wildIndex===1);p.series=[];return valid?realColors[0]:null;}
 p.series=series;return null;
}
function rebuildSeries(s){
 // Recompute the underlying Door sequence after Hammer Bird changes the Labyrinth.
 const actual=own(s),replayed={active:0,players:[{series:[]}],config:s.config};
 for(const card of actual.labyrinth)runLocation(replayed,card);
 actual.series=replayed.players[0].series;
}
function continueAfterDenizen(s){s.pending=null;s.phase='action';}

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
 const doors=basicDoors(s);
 if(doors.length!==required)return false;
 if(has(s,'oniverse')&&!allDoors(s).some(d=>d.expansion==='oniverse'))return false;
 if(s.mode==='coop'&&!s.players.every(p=>COLORS.every(c=>p.doors.some(d=>d.color===c&&d.expansion!=='oniverse'))))return false;
 if(has(s,'book')&&goals(s).some(g=>!g.done))return false;
 if(has(s,'towers')&&!hasAlignment(tower(s)))return false;
 if(has(s,'dreamcatchers')&&Object.values(stacks(s)).flat().filter(c=>c.kind==='lostDream').length!==4)return false;
 if(has(s,'mirrors')&&!['sun','moon',...(s.config.difficulties.mirrors==='hard'?['rainbow']:[])].every(k=>mirrors(s).completed.includes(k)))return false;
 return true;
}
function checkWin(s){if(s.status==='active'&&isVictory(s)){s.status='won';s.phase='ended';s.pending=null;s.interrupts=[];note(s,'All objectives completed. Victory!');return true;}return false;}
function acquireDoor(s,door,source){
 if(has(s,'book')){const g=nextGoal(s);if(!g||g.color!==door.color){s.limbo.push(door);note(s,`The ${door.color} Door did not match the next Goal and entered Limbo.`);return false;}
   g.done=true;g.doorId=door.id;
 }
 // Each player needs one Door per color in cooperative play. Duplicates are
 // retained with Glyphs until the extra team objective is satisfied.
 if(s.mode==='coop'&&!has(s,'glyphs')&&door.expansion!=='oniverse'&&own(s).doors.some(c=>c.color===door.color&&c.expansion!=='oniverse')){
   if(has(s,'book')){const g=goals(s).find(x=>x.doorId===door.id);g.done=false;g.doorId=null;}
   s.limbo.push(door);note(s,`Duplicate cooperative ${door.color} Door entered Limbo.`);return false;
 }
 own(s).doors.push(door);note(s,`${own(s).name} unlocked a ${door.color} Door (${source}).`);event(s,'doorAcquired',{doorId:door.id,color:door.color,source,player:s.active});checkWin(s);return true;
}
function loseDoor(s,id){const p=own(s),idx=p.doors.findIndex(c=>c.id===id);need(idx!==-1,'Select one of your collected Doors');const door=p.doors.splice(idx,1)[0];s.limbo.push(door);
 if(has(s,'book')){const g=goals(s).find(x=>x.doorId===door.id);if(g){g.done=false;g.doorId=null;}}
 note(s,`A ${door.color} Door returned to Limbo; any completed Goal for it reopened.`);
}
function dealLocation(s,to){while(true){if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'No Location remains to complete the hand.');return false;}const c=takeTop(s);if(c.kind==='location'||c.kind==='tower'||c.kind==='deadEnd'){to.push(c);return true;}s.limbo.push(c);}}
function fillSpecial(s){while(hand(s).length<quota(s))if(!dealLocation(s,hand(s)))return false;if(s.mode==='coop')while(s.shared.length<2)if(!dealLocation(s,s.shared))return false;return true;}
function endTurn(s){
 if(s.status!=='active')return;
 if(has(s,'dreamcatchers')&&s.limbo.length){
   const empty=catcherIds(s).filter(i=>stacks(s)['catch'+i].length===0);
   if(empty.length){const i=empty[0];stacks(s)['catch'+i].push(...s.limbo.splice(0));note(s,`Limbo was caught by Dreamcatcher ${i+1}.`);advanceTurn(s);return;}
   s.pending={type:'catchOverload',choices:catcherIds(s)};s.phase='decision';return;
 }
 if(s.limbo.length){s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);note(s,'Limbo shuffled into deck.');event(s,'limboResolved');}
 advanceTurn(s);
}
function advanceTurn(s){if(checkWin(s)||s.status!=='active')return;s.active=s.mode==='coop'?1-s.active:0;s.turn++;s.phase='action';s.pending=null;note(s,`${own(s).name}'s turn.`);}
function afterNightmare(s,n,special=false){
 if(has(s,'towers')&&tower(s).length&&!hasAlignment(tower(s))||has(s,'towers')&&tower(s).length&&s.config.difficulties.towers==='hard'){
   s.pending={type:'towerPenalty',card:n,special};s.phase='decision';return;
 }
 if(n)s.discard.push(n);s.pending=null;if(special){if(fillSpecial(s))endTurn(s);}else refill(s);
}
function resolveNightmare(s,option,id){const n=s.pending.card;let special=Boolean(s.pending.incubus);
 if(option==='key'){need(spots(s).some(x=>x.id===id&&x.card.symbol==='key'),'Choose an available Key');s.discard.push(takeSpot(s,id));note(s,'A Key was sacrificed.');}
 else if(option==='door'){loseDoor(s,id);}
 else if(option==='reveal'){for(let i=0;i<5&&s.deck.length;i++){const c=takeTop(s);(c.kind==='location'||c.kind==='tower'?s.discard:s.limbo).push(c);}note(s,'Nightmare revealed up to five cards.');}
 else if(option==='hand'){s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));special=true;note(s,'The hand was discarded.');}
 else throw Error('Choose a valid Nightmare penalty');
 afterNightmare(s,n,special);
}
function refill(s){
 if(s.status!=='active')return;s.phase='refill';
 if(s.interactiveDraw){
   if(hand(s).length>=quota(s)&&(s.mode!=='coop'||s.shared.length>=2)){endTurn(s);return;}
   if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'Deck exhausted before hand was refilled.');return;}
   s.pending={type:'drawReady'};s.phase='decision';return;
 }
 while(hand(s).length<quota(s)||(s.mode==='coop'&&s.shared.length<2)){
   if(!s.deck.length){s.status='lost';s.phase='ended';note(s,'Deck exhausted before hand was refilled.');return;}
   const c=takeTop(s);
   if(c.kind==='location'||c.kind==='tower'||c.kind==='deadEnd'){if(hand(s).length<quota(s))hand(s).push(c);else s.shared.push(c);continue;}
   if(c.kind==='door'){const keys=matchingKeys(s,c.color);const chromatic=availableRallied(s,'chromatic');if(keys.length){s.pending={type:'door',card:c,keys,chromatic:chromatic.map(d=>d.id)};s.phase='decision';return;}s.limbo.push(c);continue;}
   if(c.kind==='sphinx'){s.pending={type:'sphinxName',card:c};s.phase='decision';return;}
   if(c.kind==='diver'){if(!s.deck.length){s.discard.push(c);s.status='lost';s.phase='ended';note(s,'Deck exhausted before the Diver could reveal a card.');return;}s.pending={type:'diver',card:c,cards:takeLook(s,1,'bottom')};s.phase='decision';return;}
   if(c.kind==='confusion'){s.pending={type:'confusion',card:c};s.phase='decision';return;}
   if(c.kind==='lostDream'){s.limbo.push(c);note(s,'A Lost Dream entered Limbo.');continue;}
   if(c.kind==='happyDream'){s.pending={type:'happyDream',card:c};s.phase='decision';return;}
   if(c.kind==='denizen'){const can=spots(s).filter(x=>x.card.kind!=='deadEnd').map(x=>x.id);if(can.length){s.pending={type:'rally',card:c,choices:can};s.phase='decision';return;}s.discard.push(c);continue;}
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
 if(cmd.spell==='punishment')need(s.pending?.type==='nightmare'&&!s.pending.incubus&&s.pending.card?.kind==='nightmare'&&s.phase==='decision','Punishment cancels a Nightmare just drawn, not an Incubus anticipation penalty');
 if(cmd.spell==='parallel'){need(Number.isInteger(cmd.first)&&Number.isInteger(cmd.second)&&cmd.first!==cmd.second&&cmd.first>=0&&cmd.second>=0&&cmd.first<goals(s).length&&cmd.second<goals(s).length,'Select two different Goals');}
 if(cmd.spell==='paradox')need(s.deck.length>0,'Deck is empty');
 const removed=book(s).zones.removed;for(const id of ids)removed.push(s.discard.splice(s.discard.findIndex(c=>c.id===id),1)[0]);
 note(s,`Cast ${cmd.spell}; removed ${cost} cards from the game.`);
 if(cmd.spell==='punishment'){const n=s.pending.card;s.discard.push(n);s.pending=null;refill(s);return;}
 if(cmd.spell==='parallel'){const g=goals(s);[g[cmd.first],g[cmd.second]]=[g[cmd.second],g[cmd.first]];checkWin(s);return;}
 // Suspend even a nested decision. Suspended physical cards remain tracked.
 s.interrupts.push({phase:s.phase,pending:s.pending});s.pending={type:'spellPeek',cards:takeLook(s,5,'bottom')};s.phase='decision';
}
function edgesConflict(left,right){const icons=v=>Array.isArray(v)?v:typeof v==='string'?v.split(/[+|,/ ]+/).filter(Boolean):[];return icons(left).some(x=>icons(right).includes(x));}
function playTower(s,cmd){const found=spots(s).find(x=>x.id===cmd.id);need(found?.card.kind==='tower','Choose a Tower');need(cmd.side==='left'||cmd.side==='right','Choose left or right');const a=tower(s),c=found.card;
 if(a.length){const neighbor=cmd.side==='left'?a[0]:a.at(-1);need(!edgesConflict(...(cmd.side==='left'?[c.right,neighbor.left]:[neighbor.right,c.left])),'Tower edge symbols cannot match');}
 takeSpot(s,cmd.id);if(cmd.side==='left')a.unshift(c);else a.push(c);note(s,`Played ${c.color} Tower on the ${cmd.side}.`);if(checkWin(s))return;completeAction(s);
}
function doorSearchTargets(s,color){const chromatic=availableRallied(s,'chromatic').length>0;const targets=s.deck.filter(c=>c.kind==='door'&&(c.color===color||c.color==='wild'||chromatic)).map(c=>({id:c.id,source:'deck',color:c.color}));
 if(has(s,'dreamcatchers'))for(const i of catcherIds(s))targets.push(...stacks(s)['catch'+i].filter(c=>c.kind==='door'&&(c.color===color||c.color==='wild'||chromatic)).map(c=>({id:c.id,source:'catch'+i,color:c.color})));
 return targets;
}
function claimSearch(s,color,id,freeId){const options=doorSearchTargets(s,color);need(options.some(x=>x.id===id),'This Door is not available for the search');const o=options.find(x=>x.id===id);const from=o.source==='deck'?s.deck:stacks(s)[o.source];const d=from.splice(from.findIndex(c=>c.id===id),1)[0];if(o.source!=='deck'&&freeId!==undefined&&freeId!==null){
  need(o.source!=='catch'+freeId,'Cannot free the Dreamcatcher holding the selected Door');
  freeCatcher(s,freeId);
 }
 if(d.color!==color&&d.color!=='wild')spendDenizen(s,availableRallied(s,'chromatic')[0]?.id,'chromatic');acquireDoor(s,d,o.source==='deck'?'Labyrinth':'Dreamcatcher');if(s.status==='active'&&o.source==='deck')shuffleAfterSearch(s,freeId);}
// Phase 6: promo and appendix effects share the base draw, Door and Nightmare transitions.
const MIRROR_NAMES=['red','blue','green','brown','sun','moon','key','glyph','rainbow'];
function mirrorEnabled(s,name){return MIRROR_NAMES.includes(name)&&(name!=='glyph'||has(s,'glyphs'))&&(name!=='rainbow'||s.config.difficulties.mirrors==='hard');}
function mirrorMatch(c,name){if(c.kind!=='location')return false;if(name==='rainbow')return COLORS.includes(c.color);if(COLORS.includes(name))return c.color===name||c.color==='wild';return c.symbol===name;}
function finishMirror(s){
 const m=mirrors(s),name=m.resolving;if(!name)return;
 s.discard.push(...m.zones[name].splice(0));m.resolving=null;
}
function playMirrorPair(s,cmd){need(has(s,'mirrors')&&mirrorEnabled(s,cmd.mirror),'Mirror unavailable');need(!mirrors(s).completed.includes(cmd.mirror),'Mirror already explored');const ids=cmd.ids;need(Array.isArray(ids)&&ids.length===2&&ids[0]!==ids[1],'Choose two distinct Location cards');const first=spots(s).find(x=>x.id===ids[0]),second=spots(s).find(x=>x.id===ids[1]);need(first&&second&&mirrorMatch(first.card,cmd.mirror)&&mirrorMatch(second.card,cmd.mirror),'Both cards must match one Mirror');const a=mirrors(s).zones[cmd.mirror];need(a.length<=2,'Mirror is already full');if(cmd.mirror==='rainbow')need(new Set([...a.map(c=>c.color),first.card.color,second.card.color]).size===a.length+2,'Rainbow Mirror requires one card of each color');a.push(takeSpot(s,ids[0]),takeSpot(s,ids[1]));note(s,`Placed two Locations under ${cmd.mirror} Mirror.`);
 if(a.length!==4){refill(s);return;}mirrors(s).completed.push(cmd.mirror);mirrors(s).resolving=cmd.mirror;note(s,`Explored ${cmd.mirror} Mirror.`);
 if(cmd.mirror==='green'){const i=s.deck.findIndex(c=>c.kind==='nightmare');if(i>=0)s.discard.push(...s.deck.splice(i,1));shuffleAfterSearch(s,cmd.freeId);}
 if(['red','blue','brown','key','glyph'].includes(cmd.mirror)){s.pending={type:'mirrorReward',mirror:cmd.mirror,options:(cmd.mirror==='blue'?s.discard:s.deck).map(c=>({...c}))};s.phase='decision';return;}
 finishMirror(s);if(checkWin(s))return;refill(s);
}
function continueMirrorDoors(s){
 // Resolving several Mirror Doors is sequential: each acquisition must trigger
 // Premonitions and immediate victory before the next Door may be awarded.
 if(s.status!=='active')return;
 const waiting=mirrors(s).zones.queuedDoors;
 if(!waiting.length){finishMirror(s);s.pending=null;if(!checkWin(s))refill(s);return;}
 const door=waiting.shift();acquireDoor(s,door,'Mirror');
 if(s.status!=='active'){s.limbo.push(...waiting.splice(0));finishMirror(s);return;}
 premonitionLoop(s,'mirrorDoors');
}
function resolveMirrorReward(s,cmd){const p=s.pending;need(cmd.type==='mirrorReward'&&p.type==='mirrorReward','Resolve the Mirror reward');const name=p.mirror;const source=name==='blue'?s.discard:s.deck;let picks=cmd.ids||[];need(Array.isArray(picks)&&new Set(picks).size===picks.length,'Select each card at most once');const cardFor=id=>source.find(c=>c.id===id);need(picks.every(id=>p.options.some(c=>c.id===id)&&cardFor(id)),'Select available cards from the indicated pile');const doors=source.filter(c=>c.kind==='door');
 if(name==='red'||name==='blue'){need(picks.length===Math.min(2,source.length),'Select the required two cards (or all remaining)');const taken=picks.map(id=>source.splice(source.findIndex(c=>c.id===id),1)[0]);if(name==='red')shuffleAfterSearch(s,cmd.freeId);for(const c of [...taken].reverse())s.deck.push(c);}
 else if(name==='brown'||name==='key'||name==='glyph'){
   need(picks.every(id=>cardFor(id)?.kind==='door'),'Select Doors');
   if(name==='brown')need(picks.length===Math.min(1,doors.length),'Brown Mirror takes one Door');
   if(name==='glyph')need(picks.length===Math.min(3,doors.length),'Glyph Mirror takes three Doors');
   if(name==='key'){
     const nightmares=s.deck.filter(c=>c.kind==='nightmare').slice(0,2);for(const n of nightmares)s.discard.push(...s.deck.splice(s.deck.findIndex(c=>c.id===n.id),1));
     const available=source.filter(c=>c.kind==='door'&&c.color===cmd.color);need(COLORS.includes(cmd.color)&&picks.length===Math.min(2,available.length),'Key Mirror needs two Doors of the chosen color');need(picks.every(id=>cardFor(id)?.color===cmd.color),'Door color mismatch');
   }
   const gained=picks.map(id=>source.splice(source.findIndex(c=>c.id===id),1)[0]);shuffleAfterSearch(s,cmd.freeId);
   mirrors(s).zones.queuedDoors.push(...gained);s.pending=null;continueMirrorDoors(s);return;
 }else throw Error('Unknown Mirror');
 finishMirror(s);s.pending=null;if(s.status==='active'){if(!checkWin(s))refill(s);}
}
function activateIncubus(s){need(has(s,'incubus')&&incubus(s).level!=='easy','Incubus activation requires Apprentice or True level');need(!incubus(s).zones.stored.length,'Incubus already charged');const required=incubus(s).level==='true'?2:1;
 while(incubus(s).zones.stored.length<required){if(!s.deck.length){s.status='lost';s.phase='ended';return;}const c=takeTop(s);if(['location','tower','deadEnd'].includes(c.kind))incubus(s).zones.stored.push(c);else s.limbo.push(c);}
 note(s,`Incubus charged with ${required} Location cards; pay a Nightmare penalty.`);s.pending={type:'nightmare',card:null,incubus:true};s.phase='decision';
}
function cancelWithIncubus(s){need(has(s,'incubus')&&s.pending?.type==='nightmare'&&!s.pending.incubus,'Can only cancel a drawn Nightmare');const i=incubus(s);if(i.level==='easy'){need(!i.used,'Incubus already used');i.used=true;}else{need(i.zones.stored.length===(i.level==='true'?2:1),'Incubus must be fully charged');s.discard.push(...i.zones.stored.splice(0));}s.discard.push(s.pending.card);s.pending=null;refill(s);}
export function newGame({mode='solo',seed=Date.now(),names=['Dreamwalker','Partner'],config,interactiveDraw=false}={}){
 need(['solo','coop'].includes(mode),'Invalid game mode');const rules=validateConfig(config);
 const players=names.slice(0,mode==='coop'?2:1).map((name,i)=>({id:i,name:String(name||`Player ${i+1}`).slice(0,40),hand:[],labyrinth:[],doors:[],streakColor:null,streak:0,series:[]}));
 const s={schema:3,rulesVersion:RULESET_VERSION,interactiveDraw:Boolean(interactiveDraw),config:rules,moduleState:{},effects:[],continuations:[],events:[],interrupts:[],mode,rng:(Number(seed)>>>0)||1,deck:createDeck(rules.expansions),discard:[],limbo:[],shared:[],draft:[],players,active:0,turn:1,phase:mode==='coop'?'draft':'action',pending:null,status:'active',log:[]};
 for(const mod of activeModules(rules))s.moduleState[mod.id]=mod.setup(s);
 if(has(s,'oniverse')){const denizens=s.deck.filter(c=>c.kind==='denizen');shuffle(s,denizens);const removed=new Set(denizens.slice(0,8).map(c=>c.id));oni(s).zones.unused.push(...s.deck.filter(c=>removed.has(c.id)));s.deck=s.deck.filter(c=>!removed.has(c.id));}
 if(has(s,'incubus'))incubus(s).level=rules.difficulties.incubus||'easy';
 if(has(s,'dreamcatchers')&&rules.difficulties.dreamcatchers==='hard')dream(s).failsafes=0;
 shuffle(s,s.deck);
 if(mode==='solo'){for(let i=0;i<5;i++)if(!dealLocation(s,players[0].hand))return s;}
 else {for(let i=0;i<8;i++)if(!dealLocation(s,s.draft))return s;}
 if(s.limbo.length){s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);}
 note(s,mode==='coop'?'Draft three personal Locations each.':'A new dream begins.');return s;
}
export function legalActions(s){if(s.status!=='active')return [];
 if(s.phase==='draft')return s.draft.map(c=>({type:'draft',id:c.id}));
 if(s.phase==='decision'&&s.pending?.type==='drawReady')return [{type:'draw'}];
 if(s.phase==='decision'&&s.pending?.type==='drawn')return [{type:'confirmDraw'}];
 const bonus=has(s,'book')&&s.discard.length>=Math.min(...Object.values(spellCosts(s)))?[{type:'cast',spells:Object.entries(spellCosts(s)).filter(([spell,cost])=>s.discard.length>=cost&&(spell!=='punishment'||s.pending?.type==='nightmare')).map(([spell])=>spell)}]:[];
 if(s.phase==='decision'){
  const p=s.pending;const list={door:{type:'door',choices:(p.keys||[]).map(x=>x.id).concat('limbo')},doorSearch:{type:'doorSearch',choices:doorSearchTargets(s,p.color)},nightmare:{type:'nightmare',choices:['key','door','reveal','hand']},prophecy:{type:'prophecy'},incantation:{type:'incantation'},towerLook:{type:'towerLook'},towerPenalty:{type:'towerPenalty'},catchChoose:{type:'catchChoose'},catchOverload:{type:'catchOverload'},spellPeek:{type:'spellPeek'},moduleDecision:{type:'moduleDecision'},happyDream:{type:'happyDream'},happyPeek:{type:'happyPeek'},happyFetch:{type:'happyFetch'},rally:{type:'rally'},premonitionPick:{type:'premonitionPick'},premonitionDoor:{type:'premonitionDoor'},denizenPeek:{type:'denizenPeek'},sphinxName:{type:'sphinxName'},sphinxResolve:{type:'sphinxResolve'},diver:{type:'diver'},confusion:{type:'confusion'},mirrorReward:{type:'mirrorReward'}};
  return [list[p.type]].filter(Boolean).concat(bonus);
 }
 if(s.phase!=='action')return [];
 const actions=spots(s).flatMap(x=>[...(x.card.kind==='location'&&canPlayLocation(s,x.card)?[{type:'play',id:x.id}]:[]),...(x.card.kind==='tower'?[{type:'playTower',id:x.id}]:[]),...(x.card.kind!=='deadEnd'?[{type:'discard',id:x.id}]:[])]);
 if(has(s,'crossroads'))actions.push({type:'escape'});
 if(has(s,'mirrors'))for(const m of MIRROR_NAMES)if(mirrorEnabled(s,m)&&!mirrors(s).completed.includes(m))actions.push({type:'mirrorPair',mirror:m});
 if(has(s,'incubus')&&incubus(s).level!=='easy'&&!incubus(s).zones.stored.length)actions.push({type:'incubusActivate'});
 if(has(s,'oniverse'))for(const d of availableRallied(s))actions.push({type:'useDenizen',id:d.id,ability:d.ability});
 if(has(s,'dreamcatchers')&&dream(s).failsafes&&occupied(s).length)actions.push({type:'freeCatcher',choices:occupied(s)});
 return actions.concat(bonus);
}
export function act(previous,command){
 const s=structuredClone(normalizeSave(previous));need(s.status==='active','Game has ended');need(command&&typeof command==='object','Missing command');
 if(command.type==='cast'){need(s.phase==='action'||s.phase==='decision','Spell unavailable during draft or refill');castSpell(s,command);return s;}
 if(s.phase==='decision'&&s.pending?.type==='drawReady'){
   need(command.type==='draw','Draw the next card');
   need(s.deck.length>0,'Deck empty');const c=takeTop(s);note(s,'Drew a card.');
   // Keep the revealed card in the authoritative pending zone until its destination is confirmed.
   if(['location','tower','deadEnd'].includes(c.kind)){if(hand(s).length<quota(s))hand(s).push(c);else s.shared.push(c);s.pending=null;refill(s);return s;}
   if(c.kind==='lostDream'){s.limbo.push(c);s.pending=null;refill(s);return s;}
   if(c.kind==='door'){const keys=matchingKeys(s,c.color),chromatic=availableRallied(s,'chromatic');
     if(keys.length){s.pending={type:'door',card:c,keys,chromatic:chromatic.map(d=>d.id)};return s;}
     s.limbo.push(c);s.pending=null;refill(s);return s;
   }
   if(c.kind==='sphinx'){s.pending={type:'sphinxName',card:c};return s;}
   if(c.kind==='diver'){if(!s.deck.length){s.discard.push(c);s.status='lost';s.phase='ended';return s;}s.pending={type:'diver',card:c,cards:takeLook(s,1,'bottom')};return s;}
   if(c.kind==='confusion'){s.pending={type:'confusion',card:c};return s;}
   if(c.kind==='happyDream'){s.pending={type:'happyDream',card:c};return s;}
   if(c.kind==='denizen'){const can=spots(s).filter(x=>x.card.kind!=='deadEnd').map(x=>x.id);
     if(can.length){s.pending={type:'rally',card:c,choices:can};return s;}
     s.discard.push(c);s.pending=null;refill(s);return s;
   }
   if(c.kind==='nightmare'){s.pending={type:'nightmare',card:c};return s;}
   throw Error(`Unsupported drawn card: ${c.kind}`);
 }
 if(s.phase==='decision'&&s.pending?.type==='drawn'){
   need(command.type==='confirmDraw','Confirm the drawn card');const {card,destination}=s.pending;
   if(destination==='hand'){if(hand(s).length<quota(s))hand(s).push(card);else s.shared.push(card);}
   else if(destination==='limbo')s.limbo.push(card);else s.discard.push(card);
   note(s,destination==='hand'?'Added to hand.':destination==='limbo'?'Sent to Limbo.':'Discarded a card.');s.pending=null;refill(s);return s;
 }
 if(s.phase==='draft'){need(command.type==='draft','Choose a card from the draft');const i=s.draft.findIndex(c=>c.id===command.id);need(i!==-1,'Card not available in draft');hand(s).push(s.draft.splice(i,1)[0]);note(s,`${own(s).name} drafted a card.`);if(s.players.every(p=>p.hand.length===3)){s.shared=s.draft.splice(0);s.active=0;s.phase='action';}else s.active=1-s.active;return s;}
 if(s.phase==='action'){
  if(command.type==='mirrorPair'){playMirrorPair(s,command);return s;}
  if(command.type==='incubusActivate'){activateIncubus(s);return s;}
  if(command.type==='escape'){need(has(s,'crossroads'),'Escape requires Crossroads and Dead Ends');s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));note(s,'Escaped the Dead Ends by discarding the entire hand.');if(fillSpecial(s))endTurn(s);return s;}
  if(command.type==='useDenizen'){useDenizen(s,command);return s;}
  if(command.type==='freeCatcher'){need(has(s,'dreamcatchers')&&dream(s).failsafes>0,'No Failsafe Book available');need(occupied(s).includes(command.index),'Choose an occupied catcher');dream(s).failsafes--;freeCatcher(s,command.index);return s;}
  if(command.type==='playTower'){need(has(s,'towers'),'Towers expansion disabled');playTower(s,command);return s;}
  if(command.type==='play'){
   const f=spots(s).find(x=>x.id===command.id);need(f?.card.kind==='location','Choose a Location');const last=own(s).labyrinth.at(-1);need(!last||last.symbol!==f.card.symbol,'Adjacent Labyrinth cards must have different symbols');
   need(canPlayLocation(s,f.card),'Difficult Crossroads allows a Crossroad only second in a series');
   const c=takeSpot(s,command.id);own(s).labyrinth.push(c);const p=own(s);const color=runLocation(s,c);note(s,`${p.name} played ${c.color} ${c.symbol}.`);
   if(color){s.pending={type:'doorSearch',color};s.phase='decision';return s;}
   completeAction(s);return s;
  }
  if(command.type==='discard'){
   const f=spots(s).find(x=>x.id===command.id);need(f&&f.card.kind!=='deadEnd','Dead Ends cannot be individually discarded');const c=takeSpot(s,command.id);s.discard.push(c);note(s,`${own(s).name} discarded ${c.color} ${c.symbol||'Tower'}.`);
   if(s.mode==='coop'&&command.swapWith){const i=hand(s).findIndex(x=>x.id===command.swapWith.personal),j=s.shared.findIndex(x=>x.id===command.swapWith.shared);need(i!==-1&&j!==-1,'Swap requires personal and shared cards');[hand(s)[i],s.shared[j]]=[s.shared[j],hand(s)[i]];}
   if(c.kind==='tower'){s.pending={type:'towerLook',cards:takeLook(s,c.number)};s.phase='decision';return s;}
   if(c.symbol==='glyph'){s.pending={type:'incantation',cards:takeLook(s,5)};s.phase='decision';return s;}
   if(c.symbol==='key'){const cards=takeLook(s,5);if(cards.length){s.pending={type:'prophecy',cards};s.phase='decision';return s;}}
   completeAction(s);return s;
  }
  throw Error('That action is unavailable');
 }
 need(s.phase==='decision'&&s.pending,'Resolve the pending decision first');const p=s.pending;
 if(p.type==='sphinxName'){need(command.type==='sphinxName'&&([...COLORS,'moon','key',...(has(s,'glyphs')?['glyph']:[])].includes(command.aspect)),'Name a permitted color or symbol');s.pending={type:'sphinxResolve',card:p.card,aspect:command.aspect,cards:takeLook(s,5,'bottom')};return s;}
 if(p.type==='sphinxResolve'){need(command.type==='sphinxResolve','Resolve the Sphinx');const match=p.cards.some(c=>matchesAspect(c,p.aspect));const ids=p.cards.map(c=>c.id);need(Array.isArray(command.order)&&command.order.length===ids.length&&new Set(command.order).size===ids.length&&command.order.every(id=>ids.includes(id)),'Return every revealed card exactly once');if(match){need(ids.includes(command.topId),'Choose any one revealed card for the top');putBottom(s,p.cards.filter(c=>c.id!==command.topId),command.order.filter(id=>id!==command.topId));s.deck.push(p.cards.find(c=>c.id===command.topId));}else putBottom(s,p.cards,command.order);s.discard.push(p.card);s.pending=null;if(!match){s.discard.push(...hand(s).splice(0));if(s.mode==='coop')s.discard.push(...s.shared.splice(0));if(fillSpecial(s))endTurn(s);}else refill(s);return s;}
 if(p.type==='diver'){need(command.type==='diver','Resolve the Diver');const ids=p.cards.map(c=>c.id);if(command.option==='continue'){need(s.deck.length>0&&p.cards.at(-1)?.kind!=='nightmare','Cannot continue after Nightmare or deck end');p.cards.push(takeLook(s,1,'bottom')[0]);return s;}need(command.option==='stop'||command.option==='nightmare','Choose stop or Nightmare');const hit=p.cards.at(-1)?.kind==='nightmare';need((hit&&command.option==='nightmare')||(!hit&&command.option==='stop'),'Must resolve a revealed Nightmare');need(Array.isArray(command.order)&&command.order.length===ids.length-(hit?0:1)&&new Set(command.order).size===command.order.length&&command.order.every(id=>ids.includes(id)&&(!hit? id!==p.cards.at(-1).id:true)),'Invalid bottom order');putBottom(s,hit?p.cards:p.cards.slice(0,-1),command.order);if(hit){s.pending={type:'nightmare',card:p.card};return s;}s.deck.push(p.cards.at(-1));s.discard.push(p.card);s.pending=null;refill(s);return s;}
 if(p.type==='confusion'){need(command.type==='confusion','Resolve Confusion');const cards=[...hand(s),...(s.mode==='coop'?s.shared:[])];need(Array.isArray(command.order)&&command.order.length===cards.length&&new Set(command.order).size===cards.length&&command.order.every(id=>cards.some(c=>c.id===id)),'Choose bottom-deck order of entire hand');hand(s).length=0;if(s.mode==='coop')s.shared.length=0;putBottom(s,cards,command.order);s.discard.push(p.card);s.pending=null;if(fillSpecial(s))endTurn(s);return s;}
 if(p.type==='mirrorReward'){resolveMirrorReward(s,command);return s;}
 if(p.type==='rally'){
   need(command.type==='rally','Choose whether to rally the Denizen');const d=p.card;
   if(command.cardId==='skip')s.discard.push(d);
   else{need(p.choices.includes(command.cardId),'Choose one eligible card to discard');s.discard.push(takeSpot(s,command.cardId));d.owner=s.active;oni(s).zones.rallied.push(d);note(s,`Rallied the ${d.ability} Denizen.`);}
   s.pending=null;refill(s);return s;
 }
 if(p.type==='happyDream'){
   need(command.type==='happyDream'&&['banish','peek','fetch'].includes(command.option),'Choose a Happy Dream effect');s.discard.push(p.card);
   if(command.option==='banish'){need(has(s,'premonitions')&&prem(s).faceUp.includes(command.premonitionId),'Choose an active Dark Premonition');prem(s).faceUp.splice(prem(s).faceUp.indexOf(command.premonitionId),1);prem(s).resolved.push(command.premonitionId);note(s,'Removed a Dark Premonition.');s.pending=null;refill(s);return s;}
   if(command.option==='peek'){s.pending={type:'happyPeek',cards:takeLook(s,7)};return s;}
   need(s.deck.length>0,'No cards remain to fetch');s.pending={type:'happyFetch',options:s.deck.map(c=>({...c}))};return s;
 }
 if(p.type==='happyPeek'){
   need(command.type==='happyPeek','Complete Happy Dream inspection');const ids=command.discardIds||[],order=command.order||[];
   need(Array.isArray(ids)&&Array.isArray(order)&&new Set([...ids,...order]).size===p.cards.length&&ids.length+order.length===p.cards.length&&[...ids,...order].every(id=>p.cards.some(c=>c.id===id)),'Choose each card exactly once');
   s.discard.push(...p.cards.filter(c=>ids.includes(c.id)));putTop(s,p.cards.filter(c=>order.includes(c.id)),order);s.pending=null;refill(s);return s;
 }
 if(p.type==='happyFetch'){
   need(command.type==='happyFetch'&&p.options.some(c=>c.id===command.cardId),'Choose an existing deck card');const index=s.deck.findIndex(c=>c.id===command.cardId);need(index>=0,'Card no longer in the deck');const [c]=s.deck.splice(index,1);shuffleAfterSearch(s,command.freeId);s.deck.push(c);s.pending=null;refill(s);return s;
 }
 if(p.type==='premonitionPick'){
   need(command.type==='premonitionPick'&&p.options.includes(command.id),'Choose an active Dark Premonition');applyPremonition(s,command.id,p.after);return s;
 }
 if(p.type==='premonitionDoor'){
   need(command.type==='premonitionDoor'&&p.choices.some(d=>d.id===command.doorId),'Choose an eligible acquired Door');loseAnyDoor(s,command.doorId);premonitionLoop(s,p.after);return s;
 }
 if(p.type==='denizenPeek'){
   need(command.type==='denizenPeek','Reorder the Denizen reveal');if(p.place==='bottom')putBottom(s,p.cards,command.order);else putTop(s,p.cards,command.order);continueAfterDenizen(s);return s;
 }

 if(p.type==='moduleDecision'){need(command.type==='moduleDecision','Resolve the pending effect decision');resolveEffectDecision(s,command,s.active);return s;}
 if(p.type==='doorSearch'){
   need(command.type==='doorSearch','Resolve Door search');need(['skip','claim','search'].includes(command.option),'Invalid Door search choice');
   if(command.option==='claim'){
     // Legacy commands may omit doorId; select a physical matching Door.
     const targets=doorSearchTargets(s,p.color),chosen=command.doorId||targets[0]?.id;need(chosen,'No matching Door exists');
     claimSearch(s,p.color,chosen,command.freeId);
   }else if(command.option==='search'){shuffleAfterSearch(s,command.freeId);note(s,`Searched the deck but took no ${p.color} Door.`);}
   if(s.status==='active'){s.pending=null;if(command.option==='claim')finishAcquisition(s);else refill(s);}return s;
 }
 if(p.type==='door'){
   need(command.type==='chooseDoor','Resolve drawn Door');const d=p.card;
   if(command.keyId==='limbo')s.limbo.push(d);
   else {need(p.keys.some(k=>k.id===command.keyId),'Key does not match this Door');const key=takeSpot(s,command.keyId);if(d.color!=='wild'&&key.color!==d.color)spendDenizen(s,p.chromatic?.[0],'chromatic');s.discard.push(key);acquireDoor(s,d,'Key');}
   if(s.status==='active'){s.pending=null;finishAcquisition(s);}return s;
 }
 if(p.type==='nightmare'&&command.type==='incubusCancel'){cancelWithIncubus(s);return s;}
 if(p.type==='nightmare'&&command.type==='nightmare'&&command.option==='mirror'){spendDenizen(s,command.denizenId,'mirror');s.limbo.push(p.card);s.pending=null;refill(s);return s;}
 if(p.type==='nightmare'){need(command.type==='nightmare','Resolve the Nightmare');resolveNightmare(s,command.option,command.cardId);return s;}
 if(p.type==='towerPenalty'){
   need(command.type==='towerPenalty','Resolve Tower consequence');
   if(command.option==='discard'){
     const a=tower(s),i=a.findIndex(c=>c.id===command.towerId);need(i!==-1,'Select a played Tower');
     if(i>0&&i<a.length-1)need(!edgesConflict(a[i-1].right,a[i+1].left),'Removing this Tower would connect matching symbols');
     s.discard.push(a.splice(i,1)[0]);if(p.card)s.discard.push(p.card);note(s,'A Tower was destroyed by the Nightmare.');
   }else if(command.option==='fake'){if(p.card)s.limbo.push(p.card);note(s,'Nightmare sent to Limbo; Tower protected for now.');}
   else throw Error('Choose a Tower consequence');
   s.pending=null;if(p.special){if(fillSpecial(s))endTurn(s);}else refill(s);return s;
 }
 if(p.type==='prophecy'){need(command.type==='prophecy','Complete Prophecy');need(p.cards.some(c=>c.id===command.discardId),'Select a revealed card to discard');const rest=p.cards.filter(c=>c.id!==command.discardId);need(command.order?.length===rest.length,'Invalid Prophecy order');putTop(s,rest,command.order);s.discard.push(p.cards.find(c=>c.id===command.discardId));s.pending=null;refill(s);return s;}
 if(p.type==='towerLook'){need(command.type==='towerLook','Reorder inspected cards');putTop(s,p.cards,command.order);s.pending=null;refill(s);return s;}
 if(p.type==='incantation'){
   need(command.type==='incantation','Resolve Incantation');const doors=p.cards.filter(c=>c.kind==='door');
   const id=command.doorId;need(doors.length?doors.some(c=>c.id===id):(id===null||id===undefined),'Choose a revealed Door (passing is allowed only if none was revealed)');
   const rest=p.cards.filter(c=>c.id!==id);putBottom(s,rest,command.order);if(id){const d=doors.find(c=>c.id===id);acquireDoor(s,d,'Incantation');}
   if(s.status==='active'){s.pending=null;finishAcquisition(s);}return s;
 }
 if(p.type==='spellPeek'){
   need(command.type==='spellPeek','Complete Paradoxical Prophecy');need(p.cards.some(c=>c.id===command.topId),'Choose a card to put on top');const rest=p.cards.filter(c=>c.id!==command.topId);putBottom(s,rest,command.bottomOrder);s.deck.push(p.cards.find(c=>c.id===command.topId));restoreInterrupt(s);return s;
 }
 if(p.type==='catchChoose'){
   need(command.type==='catchChoose'&&p.choices.includes(command.index),'Choose a free Dreamcatcher');stacks(s)['catch'+command.index].push(...s.limbo.splice(0));note(s,`Limbo was caught by Dreamcatcher ${command.index+1}.`);s.pending=null;advanceTurn(s);return s;
 }
 if(p.type==='catchOverload'){
   need(command.type==='catchOverload'&&p.choices.includes(command.index),'Choose a Dreamcatcher to sacrifice');
   for(const i of catcherIds(s))s.limbo.push(...stacks(s)['catch'+i].splice(0));dream(s).active[command.index]=false;
   s.deck.push(...s.limbo.splice(0));shuffle(s,s.deck);note(s,`Dreamcatcher ${command.index+1} was lost to overload.`);
   if(!catcherIds(s).length){s.status='lost';s.phase='ended';s.pending=null;note(s,'All Dreamcatchers have been lost.');return s;}
   s.pending=null;advanceTurn(s);return s;
 }
 throw Error('Unsupported pending decision');
}
export function viewFor(s,seat=null){const c=structuredClone(normalizeSave(s));delete c.rng;delete c.effects;delete c.continuations;delete c.events;delete c.interrupts;
 c.pileInventory=pileInventory(s);c.deckCount=c.deck.length;delete c.deck;
 c.objectives=objectives(s);
 // Public expansion state only: never expose pending hidden decks, removed-card identities, or future goals before revealed.
 c.expansion={};
 if(has(s,'premonitions'))c.expansion.premonitions={faceUp:[...prem(s).faceUp],reserveCount:prem(s).reserve.length,resolved:[...prem(s).resolved]};
 if(has(s,'oniverse'))c.expansion.oniverse={rallied:structuredClone(oni(s).zones.rallied),treasure:structuredClone(oni(s).zones.treasure.filter(x=>x.owner===seat||s.mode==='solo'))};
 if(has(s,'crossroads'))c.expansion.crossroads={hard:s.config.difficulties.crossroads==='hard'};
 if(has(s,'book'))c.expansion.book={goals:goals(s).map(g=>({color:g.color,done:g.done})),discardCount:book(s).zones.removed.length,costs:spellCosts(s)};
 if(has(s,'dreamcatchers'))c.expansion.dreamcatchers={active:[...dream(s).active],failsafes:dream(s).failsafes,stacks:Object.values(stacks(s)).map(a=>structuredClone(a))};
 if(has(s,'mirrors'))c.expansion.mirrors={completed:[...mirrors(s).completed],stacks:Object.fromEntries(Object.entries(mirrors(s).zones).filter(([k])=>mirrorEnabled(s,k)).map(([k,v])=>[k,structuredClone(v)]))};
 if(has(s,'incubus'))c.expansion.incubus={level:incubus(s).level,used:incubus(s).used,stored:structuredClone(incubus(s).zones.stored)};
 if(has(s,'towers'))c.expansion.towers={alignment:structuredClone(tower(s)),protected:hasAlignment(tower(s))&&s.config.difficulties.towers!=='hard'};
 delete c.moduleState;
 if(c.mode==='coop')for(let i=0;i<c.players.length;i++)if(i!==seat)c.players[i].hand=c.players[i].hand.map(x=>({id:x.id,kind:'hidden'}));
 if(c.pending?.type==='diver')c.pending.remaining=s.deck.length;
 if(c.pending?.type==='doorSearch'&&(c.mode==='solo'||seat===s.active))c.pending.targets=doorSearchTargets(s,c.pending.color);
 if(c.pending&&c.mode==='coop'&&seat!==s.active)c.pending={type:'private-decision',player:s.active};
 return c;
}
export function assertConserved(s){return assertCardsUnique(normalizeSave(s),expectedCards(s.config?.expansions||[]));}
