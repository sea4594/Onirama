import {htmlEscape,cardDescription} from './cards.js';

// Rule summaries for printed card types. Never infer rules from unrevealed state.
const PREMONITIONS={red2:'2 red Doors: discard red Locations',green2:'2 green Doors: return a Nightmare',blue2:'2 blue Doors: discard two Keys',brown2:'2 brown Doors: lose a Door',pair2:'2 matching Doors: lose one',doors5:'5 Doors: reveal two Premonitions',rainbow4:'4 colors: discard Happy Dreams',doors3:'3 Doors: redraw your hand'};
const ABILITIES={
 architect:'Allows a Location to follow the same symbol in your Labyrinth.',
 cyclobot:'Exchange one Location in your hand with one in the discard pile.',
 squirrel:'Inspect five cards, then return them to the top in your chosen order.',
 harpoon:'Inspect five cards, discard Nightmares, and return the others to the bottom.',
 hammer:'Remove the final same-color sequence from your Labyrinth.',
 chromatic:'Can help match a Key or Door of a different color.',
 mirror:'Can cancel a Nightmare when it appears.',
 keeper:'Store one hand card as a reserve for later play.'
};
export function cardHelp(card){
 if(!card||card.kind==='hidden')return {title:'Face-down card',detail:'This card is hidden. Its identity is not available to you.'};
 const kind=card.kind,extra=card.expansion;
 let detail='';
 switch(kind){
  case 'nightmarePenalty':detail=({Key:'Discard one Key from your hand or shared area.',Door:'Return one collected Door to Limbo.','Reveal 5':'Reveal five cards; discard Locations and send Doors and Dreams to Limbo.',Hand:'Discard your entire hand and draw replacements.'})[card.option]||'Nightmare penalty';break;
  case 'premonition':detail=PREMONITIONS[card.premonitionId]||'Dark Premonition';break;
  case 'location':
   detail=card.symbol==='key'?'Play into your Labyrinth, discard to use Prophecy, or spend as a matching Key to claim a Door.':card.symbol==='glyph'?'A Glyph Location. Discard it to trigger its five-card Incantation, or play it in your Labyrinth.':'Play in your Labyrinth if its symbol differs from the previous Location, or discard it.';
   if(card.color==='wild')detail+=' A Crossroads Location counts as a wild color for matching effects.';
   break;
  case 'tower':detail=`Place on either end of the Tower alignment when touching edges do not share symbols. Value ${card.number}; left edge ${card.left||'blank'}, right edge ${card.right||'blank'}. Form four neighboring Towers of different colors.`;break;
  case 'door':detail=extra==='oniverse'?'Special Door to the Oniverse: required for this expansion’s goal.':'Collect Doors to win. A matching Key can claim a revealed Door; three consecutive same-color Locations can also search for one.';break;
  case 'nightmare':detail='When drawn, choose a legal penalty: spend a Key, lose a Door, reveal cards, or discard and replace your hand.';break;
  case 'deadEnd':detail='Cannot be played or discarded individually. Use Escape to discard and replace your entire hand.';break;
  case 'lostDream':detail='A Lost Dream must be captured in a Dreamcatcher for the expansion objective.';break;
  case 'happyDream':detail='When drawn, choose a Happy Dream benefit such as inspecting or searching the deck.';break;
  case 'denizen':detail=ABILITIES[card.ability]||'A Denizen can be rallied and used for its special ability.';break;
  case 'sphinx':detail='Name a color or symbol, inspect five cards from the bottom, and resolve the Sphinx effect.';break;
  case 'diver':detail='Reveal cards from the bottom one by one; choose when to stop or resolve a revealed Nightmare.';break;
  case 'confusion':detail='Reorder your hand onto the bottom of the deck, then draw a replacement hand.';break;
  default:detail='See the relevant base-game or expansion rules for this card.';
 }
 const title=kind==='nightmarePenalty'?`${card.option} penalty`:kind==='premonition'?'Dark Premonition':cardDescription(card).replace(/^([a-z])/,(_,a)=>a.toUpperCase());
 return {title,detail};
}
/** Small, non-modal inspection bubble; closes without changing game state. */
export function createCardInspector({root}){
 let pop=null,timer=null,pointer=null,heldId=null,ignoreClick=false,returnFocus=null;
 const findCard=target=>target?.closest?.('[data-tt-card-info]')||target?.closest?.('[data-tt-order-handle],.tt4-card-option')?.querySelector?.('[data-tt-card-info]');
 const cancelHold=()=>{if(timer!==null)clearTimeout(timer);timer=null;pointer=null;};
 function close(){if(!pop)return;pop.remove();pop=null;returnFocus?.focus?.({preventScroll:true});returnFocus=null;}
 function open(card,x,y,{focus=false}={}){
   let data;try{data=JSON.parse(card.dataset.ttCardInfo);}catch{return;}
   close();const {title,detail}=cardHelp(data);
   pop=document.createElement('aside');pop.className='tt5-inspection';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Card information');
   pop.innerHTML=`<button type="button" class="tt5-inspection-close" aria-label="Close card information">×</button><strong>${htmlEscape(title)}</strong><p>${htmlEscape(detail)}</p>`;
   returnFocus=focus?document.activeElement:null;
   document.body.appendChild(pop);
   const size=pop.getBoundingClientRect(),pad=8;
   const left=Math.max(pad,Math.min(window.innerWidth-size.width-pad,x+12));
   const top=y+size.height+16>window.innerHeight?Math.max(pad,y-size.height-12):Math.max(pad,y+12);
   pop.style.left=`${left}px`;pop.style.top=`${top}px`;
   pop.querySelector('button').addEventListener('click',e=>{e.stopPropagation();close();});
   if(focus)pop.querySelector('button')?.focus?.({preventScroll:true});
 }
 function context(e){const card=findCard(e.target);if(!card||!root.contains(card))return;
   e.preventDefault();cancelHold();open(card,e.clientX,e.clientY,{focus:true});
 }
 function down(e){if(e.button!==0)return;
   const card=findCard(e.target);if(!card||!root.contains(card))return;
   cancelHold();heldId=null;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,card};
   timer=setTimeout(()=>{if(!pointer)return;const {x,y,card,id}=pointer;cancelHold();heldId=id;ignoreClick=true;open(card,x,y);},500);
 }
 function move(e){if(pointer&&e.pointerId===pointer.id&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)cancelHold();}
 function up(e){if(pointer&&e.pointerId===pointer.id)cancelHold();if(heldId===e.pointerId){heldId=null;setTimeout(()=>{ignoreClick=false;},700);}}
 function key(e){
   if(pop&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
   const card=findCard(e.target);
   if(card&&root.contains(card)&&((e.key==='F10'&&e.shiftKey)||(e.key.toLowerCase()==='i'&&!e.ctrlKey&&!e.altKey&&!e.metaKey))){
     const box=card.getBoundingClientRect();e.preventDefault();e.stopImmediatePropagation();cancelHold();open(card,box.right,box.top,{focus:true});
   }
 }
 function click(e){if(ignoreClick){ignoreClick=false;e.preventDefault();e.stopImmediatePropagation();return;}
   if(pop&&!pop.contains(e.target)){close();}
 }
 root.addEventListener('contextmenu',context);root.addEventListener('pointerdown',down);
 window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up);
 window.addEventListener('pointercancel',cancelHold);window.addEventListener('blur',cancelHold);
 const outside=e=>{if(pop&&!pop.contains(e.target))close();};
 document.addEventListener('pointerdown',outside);
 root.addEventListener('click',click,true);root.addEventListener('keydown',key,true);
 return {close,dispose(){cancelHold();close();document.removeEventListener('pointerdown',outside);root.removeEventListener('contextmenu',context);root.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelHold);window.removeEventListener('blur',cancelHold);root.removeEventListener('click',click,true);root.removeEventListener('keydown',key,true);}};
}
