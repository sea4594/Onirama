import {renderCard,htmlEscape} from './cards.js';

export const SPELL_INFO=Object.freeze({
  parallel:{name:'Parallel Planning',description:'Swap two Goals. Select both positions below or in the Doors area.'},
  paradox:{name:'Paradoxical Prophecy',description:'Look at up to five cards from the bottom of the deck. Move one to the top.'},
  punishment:{name:'Powerful Punishment',description:'Cancel the Nightmare just drawn, without taking a penalty.'}
});

export function spellEligibility(game,spell,selectedGoals=[]){
  const book=game?.expansion?.book,cost=book?.costs?.[spell],goals=book?.goals||[];
  const canPay=Number.isInteger(cost)&&cost>0&&(game?.discard?.length||0)>=cost;
  const legal=spell==='parallel'?goals.length>=2:
    spell==='paradox'?(game?.deckCount||0)>0:
    spell==='punishment'?game?.phase==='decision'&&game?.pending?.type==='nightmare'&&game.pending.card?.kind==='nightmare'&&!game.pending.incubus:false;
  const selected=Array.isArray(selectedGoals)&&selectedGoals.length===2&&selectedGoals[0]!==selectedGoals[1]&&selectedGoals.every(i=>Number.isInteger(i)&&i>=0&&i<goals.length);
  return {legal,canPay,cost,ready:!!book&&game?.status==='active'&&['action','decision','turnComplete'].includes(game?.phase)&&legal&&canPay&&(spell!=='parallel'||selected)};
}

export function renderSpellbook(game,{choice='parallel',selectedGoals=[]}={}){
  const book=game.expansion.book,active=SPELL_INFO[choice]||SPELL_INFO.parallel;
  const status=spellEligibility(game,choice,selectedGoals),goals=book.goals||[],selected=selectedGoals.filter(i=>Number.isInteger(i)&&i>=0&&i<goals.length);
  const choices=Object.entries(SPELL_INFO).sort(([a],[b])=>book.costs[a]-book.costs[b]);
  const options=choices.map(([id,info])=>{
    const eligibility=spellEligibility(game,id,selected);
    const available=eligibility.legal&&eligibility.canPay;
    return `<button type="button" role="radio" aria-checked="${choice===id}" aria-label="${htmlEscape(info.name)}: ${eligibility.cost} cards${available?', ready':', not ready'}" class="tt16-spell-choice ${choice===id?'tt16-selected':''} ${available?'tt24-spell-ready':'tt24-spell-unready'}" data-action="spellSelect:${id}"><strong>${info.name}</strong><span class="tt16-spell-cost">${eligibility.cost} cards</span></button>`;
  }).join('');
  const positions=choice==='parallel'?`<div class="tt24-goal-header">Choose two Goals (${selected.length}/2)</div><div class="tt24-spell-goals" role="group" aria-label="Goals to swap">${goals.map((goal,i)=>{
    const pick=selected.indexOf(i),chosen=pick>=0;
    return `<button type="button" class="tt24-spell-goal ${chosen?'tt24-goal-chosen':''}" data-action="goalPick:${i}" aria-pressed="${chosen}" aria-label="Goal ${i+1}: ${htmlEscape(goal.color)} Door${goal.done?', collected':''}${chosen?`, selected ${pick+1}`:''}"><span class="tt24-goal-number">${i+1}</span>${renderCard({kind:'door',color:goal.color},{tiny:true})}${chosen?`<span class="tt24-goal-picked">${pick+1}</span>`:''}</button>`;
  }).join('')}</div>`:'';
  const payment=status.canPay?'':`<span class="tt24-spell-shortage">${Math.max(0,status.cost-game.discard.length)} more discarded ${status.cost-game.discard.length===1?'card':'cards'} needed</span>`;
  return `<section class="decision stack tt16-spell-dialog"><h2>Book of Steps · ${game.discard.length} discarded cards</h2><div class="tt16-spell-choices" role="radiogroup" aria-label="Choose spell">${options}</div><p class="tt16-spell-description">${active.description}</p>${positions}${payment}<div class="tt16-spell-actions"><button type="button" class="primary" data-action="castSpell" ${status.ready?'':'disabled'}>Cast spell</button><button type="button" data-action="dialogClose">Cancel</button></div></section>`;
}
