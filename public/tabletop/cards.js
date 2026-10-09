import {cardSymbol} from '../icons.js';
// UI-only card primitives. Never mutates the game or decides whether an action is legal.
export const CARD_COLORS=Object.freeze(['red','blue','green','brown']);
export const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cardDescription(c){
  return c.kind==='location'?`${c.color==='wild'?'Crossroad':c.color} ${c.symbol}`:c.kind==='tower'?`${c.color} Tower · ${c.number} · ${c.left||'blank'}/${c.right||'blank'}`:c.kind==='door'?(c.expansion==='oniverse'?'Door to the Oniverse':`${c.color} Door`):c.kind==='hidden'?'Hidden':c.kind==='denizen'?`Denizen: ${c.ability}`:c.kind==='deadEnd'?'Dead End':c.kind==='happyDream'?'Happy Dream':c.kind;
}
export function renderCard(c,{select=false,tiny=false,dim=false,selectedId=null,interactive=false,highlight=false}={}){
  const symbol=cardSymbol(c.kind==='location'?c.symbol:c.kind);
  const text=htmlEscape(cardDescription(c));
  const classes=`card ${c.color||c.kind}${tiny?' tiny':''}${selectedId===c.id?' selected':''}${highlight?' tt7-eligible':''}`;
  // Inspect metadata only for a card already visible to this viewer. Never
  // serialize IDs, private hands, deck order, or unrevealed card details.
  const visible={kind:c.kind,color:c.color||'',symbol:c.symbol||'',expansion:c.expansion||'',ability:c.ability||'',number:c.number||'',left:c.left||'',right:c.right||''};
  const inspect=` data-tt-card-info="${htmlEscape(JSON.stringify(visible))}"${c.kind!=='hidden'&&c.id?` data-tt-motion-id="${htmlEscape(c.id)}"`:``}`;
  const face=c.kind==='tower'?`<span class="tt5-tower-face"><span class="tt5-tower-edge">${(c.left||'').split('+').map(x=>cardSymbol(x)).join('')}</span><strong>${htmlEscape(c.number)}</strong><span class="tt5-tower-edge">${(c.right||'').split('+').map(x=>cardSymbol(x)).join('')}</span></span>`:`<span class="symbol">${symbol}</span>`;
  return select?`<button class="${classes}" aria-pressed="${selectedId===c.id}" title="${text}" aria-label="${text}" data-pick="${htmlEscape(c.id)}"${inspect} ${interactive?`data-tt-card="${htmlEscape(c.id)}"`:``} ${dim?'disabled':''}>${face}${c.kind==='location'?'':`<span class="card-label">${text}</span>`}</button>`:`<div class="${classes}" title="${text}" aria-label="${text}"${inspect}>${face}${c.kind==='location'?'':`<span class="card-label">${text}</span>`}</div>`;
}
export function renderDoors(player,card=renderCard){
  return `<div class="door-spots">${[...CARD_COLORS,'wild'].filter(color=>color!=='wild'||player.doors.some(d=>d.color==='wild')).map(color=>`<div class="door-group"><div class="eyebrow">${color==='wild'?'Oniverse':color}</div><div class="cards">${player.doors.filter(d=>d.color===color).map(d=>card(d,{tiny:true})).join('')||`<div class="door-slot">${cardSymbol('diamond')}</div>`}</div></div>`).join('')}</div>`;
}
