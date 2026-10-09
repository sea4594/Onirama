// UI-only card primitives. Never mutates the game or decides whether an action is legal.
const SYMBOLS = Object.freeze({sun:'☀',moon:'☾',key:'⚿',glyph:'✧',tower:'♜',lostDream:'✿',nightmare:'✦',door:'◈',hidden:'◈',deadEnd:'⊘',happyDream:'✺',denizen:'♧',sphinx:'◇',diver:'▽',confusion:'≋'});
export const CARD_COLORS=Object.freeze(['red','blue','green','brown']);
export const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cardDescription(c){
  return c.kind==='location'?`${c.color==='wild'?'Crossroad':c.color} ${c.symbol}`:c.kind==='tower'?`${c.color} Tower · ${c.number} · ${c.left}/${c.right}`:c.kind==='door'?(c.expansion==='oniverse'?'Door to the Oniverse':`${c.color} Door`):c.kind==='hidden'?'Hidden':c.kind==='denizen'?`Denizen: ${c.ability}`:c.kind==='deadEnd'?'Dead End':c.kind==='happyDream'?'Happy Dream':c.kind;
}
export function renderCard(c,{select=false,tiny=false,dim=false,selectedId=null}={}){
  const symbol=c.kind==='location'?SYMBOLS[c.symbol]:(SYMBOLS[c.kind]||'◈');
  const text=htmlEscape(cardDescription(c));
  const classes=`card ${c.color||c.kind}${tiny?' tiny':''}${selectedId===c.id?' selected':''}`;
  return select?`<button class="${classes}" aria-pressed="${selectedId===c.id}" title="${text}" aria-label="${text}" data-pick="${htmlEscape(c.id)}" ${dim?'disabled':''}><span class="symbol">${symbol}</span><span class="card-label">${text}</span></button>`:`<div class="${classes}" title="${text}" aria-label="${text}"><span class="symbol">${symbol}</span><span class="card-label">${text}</span></div>`;
}
export function renderDoors(player,card=renderCard){
  return `<div class="door-spots">${[...CARD_COLORS,'wild'].filter(color=>color!=='wild'||player.doors.some(d=>d.color==='wild')).map(color=>`<div class="door-group"><div class="eyebrow">${color==='wild'?'Oniverse':color}</div><div class="cards">${player.doors.filter(d=>d.color===color).map(d=>card(d,{tiny:true})).join('')||'<div class="door-slot">◇</div>'}</div></div>`).join('')}</div>`;
}
