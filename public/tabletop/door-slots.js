import {CARD_COLORS,renderCard,htmlEscape} from './cards.js';
import {icon} from '../icons.js';
export function renderDoorSlots(doors,config,{targets=new Set(),spellGoalMode=false,spellGoals=[],incantationPreview=null}={}){
 const book=config?.bookGoals,perColor=config?.expansions?.includes('glyphs')?3:2;
 const goals=book?.length?book.map((g,i)=>({color:g.color,index:i,done:g.done})):CARD_COLORS.flatMap(color=>Array.from({length:perColor},()=>({color,index:null})));
 if(config?.expansions?.includes('oniverse')&&!goals.some(g=>g.color==='wild'))goals.push({color:'wild',index:null});
 const used=new Set();let previewUsed=false;const nextBookGoal=book?.find(g=>!g.done);return goals.map(({color,index,done},position)=>{
   const card=doors.find(c=>c.color===color&&!used.has(c.id));if(card)used.add(card.id);
   const chosen=index!==null&&spellGoals.includes(index),eligible=card&&targets.has(card.id);
   const preview=!card&&!previewUsed&&incantationPreview?.kind==='door'&&incantationPreview.color===color&&(!book?.length||nextBookGoal?.color===color&&index===book.indexOf(nextBookGoal));if(preview)previewUsed=true;
   const child=card?renderCard(card,{tiny:true,select:Boolean(eligible),highlight:Boolean(eligible)}):preview?`<span class="tt12-door-preview" aria-label="Pending Incantation Door">${renderCard(incantationPreview,{tiny:true})}</span>`:`<span class="tt8-door-empty ${htmlEscape(color)}" aria-hidden="true">${icon('diamond')}</span>`;
   const body=spellGoalMode&&index!==null?`<button type="button" class="tt8-goal-spot ${chosen?'tt8-goal-chosen':''}" data-action="goalPick:${index}" aria-pressed="${chosen}" aria-label="Choose Step ${index+1}, ${htmlEscape(color)} Door">${child}</button>`:child;
   return `<span class="tt8-door-slot ${htmlEscape(color)} ${done?'tt8-door-complete':''} ${book?.length&&index===book.findIndex(g=>!g.done)?'tt8-current-goal':''}" aria-label="${htmlEscape(color)} Door ${position+1}${card?' collected':''}">${body}</span>`;
 }).join('');
}
