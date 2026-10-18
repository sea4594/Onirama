import {icon,cardSymbol} from '../icons.js';
/* Phase 5: a visual projection of every off-deck expansion component.
 * Controls reuse app.js's existing data-action commands; no rules are computed here. */
import {renderCard,htmlEscape,CARD_COLORS} from './cards.js';

const esc=htmlEscape;
const action=(label,command,{disabled=false,title=label}={})=>`<button type="button" class="tt5-action" data-action="${esc(command)}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
const symbol={red:icon('mirror-art'),blue:icon('mirror-art'),green:icon('mirror-art'),brown:icon('mirror-art'),sun:cardSymbol('sun'),moon:cardSymbol('moon'),key:cardSymbol('key'),glyph:cardSymbol('glyph'),rainbow:cardSymbol('rainbow')};
const premonitionText={red2:'2 red Doors: discard red Locations',green2:'2 green Doors: return a Nightmare',blue2:'2 blue Doors: discard two Keys',brown2:'2 brown Doors: lose a Door',pair2:'2 matching Doors: lose one',doors5:'5 Doors: reveal two Premonitions',rainbow4:'4 colors: discard Happy Dreams',doors3:'3 Doors: redraw your hand'};
// One visual grammar on every Premonition: Door condition above the rule,
// consequence below it. Shapes share the same colors and action marks.
const PM_COLORS={red:'#ef6b70',blue:'#57adf0',green:'#4fc995',brown:'#e0a05a'};
const pmDoor=(x,y,color='neutral',scale=1)=>{
 const stroke=PM_COLORS[color]||'#eaddc7';
 return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M1 20V8a7 7 0 0 1 14 0v12Z" stroke="${stroke}" fill="${stroke}" fill-opacity=".27" stroke-width="2.6"/><path d="M5 20V9a3 3 0 0 1 6 0v11" stroke="${stroke}" stroke-width="1.5" fill="none"/></g>`;
};
const pmCondition=id=>{
 if(id==='rainbow4')return ['red','blue','green','brown'].map((c,i)=>pmDoor(1+i*12,8,c,.67)).join('');
 if(id==='pair2')return pmDoor(7,7,'neutral',.89)+pmDoor(26,7,'neutral',.89)+'<path d="M22 14h4m-4 4h4" stroke="#f6e6c8" stroke-width="2.3"/>';
 const color={red2:'red',blue2:'blue',green2:'green',brown2:'brown'}[id]||'neutral';
 const n={red2:2,blue2:2,green2:2,brown2:2,doors3:3,doors5:5}[id];
 return `<text x="13" y="25" text-anchor="middle" font-size="22" font-weight="800" fill="${PM_COLORS[color]||'#f6e6c8'}">${n}</text>${pmDoor(28,7,color,.92)}`;
};
const pmCross='<path d="M33 41 42 54M42 41 33 54" stroke="#ffbbb2" stroke-width="3.7" stroke-linecap="round"/>';
const pmEffect={
 // Red Location cards are discarded. The Sun marks a Location, not a Door.
 red2:'<rect x="9" y="38" width="18" height="23" rx="2.5" stroke="#ef6b70" stroke-width="2.3" fill="#ef6b70" fill-opacity=".18"/><circle cx="18" cy="49" r="4.2" stroke="#ffd8b2" stroke-width="1.9"/><path d="M18 42v-2m0 18v-2m-7-7h2m10 0h2" stroke="#ffd8b2" stroke-width="1.6"/>'+pmCross,
 // A Nightmare returns from discard: the same pointed mask and return arrow.
 green2:'<path d="m7 45-2-7 9 4 7-4-2 7 3 6-7 10h-7L5 51Z" fill="#c7a3d9" fill-opacity=".3" stroke="#dfc5f0" stroke-width="2.3" stroke-linejoin="round"/><path d="m9 49 3 2m7-2-3 2" stroke="#dfc5f0" stroke-width="2"/><path d="M29 56a10 10 0 1 0-2-11m0-6v7h7" fill="none" stroke="#a1e5c3" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
 // Two Keys are lost: number plus large Key with the common removal X.
 blue2:'<text x="9" y="56" font-size="16" font-weight="800" fill="#a9d9ff">2</text><circle cx="24" cy="52" r="5" stroke="#f6e3b6" stroke-width="2.6"/><path d="m28 48 11-10m-3 3 5 5m-8-2 4 4" fill="none" stroke="#f6e3b6" stroke-width="2.8" stroke-linecap="round"/>'+pmCross,
 // The same Door-with-X for both kinds of Door loss.
 brown2:pmDoor(11,40,'neutral',1.04)+pmCross,
 pair2:pmDoor(11,40,'neutral',1.04)+pmCross,
 // Two more purple Premonition cards are revealed (+).
 doors5:'<rect x="7" y="43" width="19" height="21" rx="2.5" fill="#66547d" stroke="#e6c9f8" stroke-width="2"/><rect x="17" y="39" width="20" height="21" rx="2.5" fill="#66547d" stroke="#e6c9f8" stroke-width="2.3"/><path d="M27 44v11m-5.5-5.5h11" stroke="#fff0ca" stroke-width="2.8" stroke-linecap="round"/>',
 // Happy Dream crescent and star struck through = discard all Happy Dreams.
 rainbow4:'<path d="M20 39a11 11 0 1 0 11 15 10 10 0 0 1-11-15Z" fill="#f0dd9c" fill-opacity=".23" stroke="#ffe6a7" stroke-width="2.2"/><path d="m31 39 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" stroke="#ffe6a7" stroke-width="1.7"/><path d="M8 62 40 37" stroke="#ffbbb2" stroke-width="3.6" stroke-linecap="round"/>',
 // Replace the hand (circular arrow), then expose one purple Premonition.
 doors3:'<rect x="5" y="43" width="14" height="18" rx="2" fill="#aeaa97" fill-opacity=".22" stroke="#f2e6cc" stroke-width="1.8"/><rect x="11" y="39" width="14" height="18" rx="2" fill="#aeaa97" fill-opacity=".22" stroke="#f2e6cc" stroke-width="1.8"/><path d="M25 53a9 9 0 0 0 13-8m0 0-5 1m5-1-2-5" fill="none" stroke="#f7e5b7" stroke-width="2.8" stroke-linejoin="round"/><rect x="30" y="54" width="10" height="11" rx="1.4" fill="#8d70aa" stroke="#e6c9f8" stroke-width="1.6"/><path d="M35 56v7m-3.5-3.5h7" stroke="#fff0ca" stroke-width="1.5"/>'
};
const pmEffectKind={red2:'discard-locations',green2:'return-nightmare',blue2:'discard-keys',brown2:'lose-door',pair2:'lose-door',doors5:'reveal-premonitions',rainbow4:'discard-happy-dreams',doors3:'redraw-hand-and-reveal'};
export function premonitionFace(id){
 if(!Object.hasOwn(pmEffect,id))return '';
 return `<span class="tt18-pm-art tt18-pm-${id}" aria-hidden="true"><svg class="tt28-pm-diagram" viewBox="0 0 48 68" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g class="tt28-pm-condition" data-premonition-trigger="${id}">${pmCondition(id)}</g><path d="M5 33h38" stroke="#b49abf" stroke-width="1.6"/><g class="tt28-pm-consequence" data-premonition-effect="${pmEffectKind[id]}">${pmEffect[id]}</g></svg></span>`;
}
const tile=(label,body,{className='',id='',title=label,actionId='',hideName=false}={})=>`<div class="tt5-tile ${className}" ${id?`data-tt-zone="${esc(id)}"`:''} ${actionId?`data-action="${esc(actionId)}" role="button" tabindex="0"`:''} title="${esc(title)}" aria-label="${esc(title)}">${body}${hideName?'':`<span class="tt5-tile-name">${esc(label)}</span>`}</div>`;
const zone=(id,label,body,extra='')=>`<section class="tt5-zone tt5-${id}" data-tt-zone="${id}" aria-label="${esc(label)}"><header><span>${esc(label)}</span>${extra}</header><div class="tt5-contents">${body}</div></section>`;
const preview=(cards,max=2,targets=new Set())=>cards?.length?`<span class="tt5-preview">${cards.slice(-max).map(c=>renderCard(c,{tiny:true,select:targets.has(c.id),highlight:targets.has(c.id)})).join('')}</span>`:`<span class="tt5-placeholder" aria-hidden="true">${icon('diamond')}</span>`;
// Progress is computed from claimed Doors, not from card IDs or artwork variants.
export function premonitionProgress(id,players=[]){
 const doors=players.flatMap(p=>p.doors||[]);const colors=CARD_COLORS;
 const tally=c=>doors.filter(d=>d.color===c||d.color==='wild').length;
 const total=doors.length,distinct=colors.filter(c=>tally(c)>0).length;
 const goals={red2:[tally('red'),2,'red Doors'],green2:[tally('green'),2,'green Doors'],blue2:[tally('blue'),2,'blue Doors'],brown2:[tally('brown'),2,'brown Doors'],pair2:[Math.max(...colors.map(tally)),2,'matching Doors'],doors5:[total,5,'Doors'],rainbow4:[distinct,4,'Door colors'],doors3:[total,3,'Doors']};
 const [current,target,unit]=goals[id]||[0,1,'conditions'];return {current:Math.min(current,target),target,unit};
}
const count=(a)=>Array.isArray(a)?a.length:0;
const buttonAllowed=(canAct,phase='action')=>canAct&&phase==='action';

export function expansionTabletopZones(g,{canAct=true,decisionTargets=new Set(),spellGoalMode=false,spellGoals=[],selectedPremonition=null,premonitionChoiceMode=false}={}){
  const e=g?.expansion||{},active=buttonAllowed(canAct,g?.phase),zones=[];
  if(e.towers){const a=e.towers.alignment||[];const place=(side)=>`<button type="button" class="tt5-tower-target" data-tt-drop="tower${side==='left'?'Left':'Right'}" aria-label="Play selected Tower on ${side}" disabled title="Place Tower on ${side}">+</button>`;
    zones.push(zone('alignment','Towers',`${place('left')}<div class="tt5-tower-cards">${preview(a,Math.max(1,a.length),decisionTargets)}</div>${place('right')}`,e.towers.protected?`<span class="tt5-count" title="Alignment protected">${icon('tower')}</span>`:`<span class="tt5-count">${a.length}/4</span>`));}
  if(e.dreamcatchers){const d=e.dreamcatchers;zones.push(zone('catchers','Dreamcatchers',d.stacks.map((cards,i)=>{
    const lost=count(cards.filter(c=>c.kind==='lostDream')),available=d.active[i];
    return `<button type="button" class="tt5-tile tt5-catcher ${available?'':'tt5-inactive'}" data-action="inspectCatcher:${i}" aria-label="Dreamcatcher ${i+1}: ${available?'available':'removed'}, ${cards.length} cards, ${lost} Lost Dreams" title="Inspect Dreamcatcher ${i+1}"><span class="tt14-catcher-face">${cards.length?`<span class="tt14-catcher-fan" style="--tt14-held:${cards.length}">${cards.map((c,j)=>`<span class="tt14-held-card" style="--tt14-held-index:${j};--tt14-position:${cards.length===1?0.5:(j/(cards.length-1)).toFixed(4)};z-index:${j+1}">${renderCard(c,{tiny:true})}</span>`).join('')}</span>`:'<span class="tt14-catcher-back" aria-hidden="true"></span>'}</span></button>`;
  }).join(''),`<span class="tt5-count">Failsafes: ${d.failsafes}</span>`));}
  if(e.premonitions){const p=e.premonitions;zones.push(zone('premonitions','Premonitions',p.faceUp.map(id=>{const selectable=canAct&&premonitionChoiceMode&&g.phase==='decision'&&g.pending?.type==='happyDream';const label=premonitionText[id]||id,info=esc(JSON.stringify({kind:'premonition',premonitionId:id})),progress=premonitionProgress(id,g.players);return `<button type="button" class="tt5-tile tt5-premonition ${selectedPremonition===id?'tt7-premonition-selected':''}" data-tt-card-info="${info}" ${selectable?`data-action="happyPremonitionSelect:${esc(id)}" aria-pressed="${selectedPremonition===id}"`:''} aria-label="${esc(label)}" title="${esc(label)}"><span class="tt5-pm-face">${premonitionFace(id)}</span><span class="tt16-pm-progress" aria-label="${progress.current} of ${progress.target} ${progress.unit}"><span class="tt16-pm-meter" style="--tt16-progress:${progress.current/progress.target}"></span><b>${progress.current}/${progress.target}</b></span></button>`;}).join('')+`<button type="button" class="tt14-reserve" data-action="inspectPile:reserve" aria-label="Inspect ${p.reserveCount} reserve Premonition cards" title="Inspect reserve Premonitions"><span class="tt14-reserve-back" aria-hidden="true"></span></button>`,`<span class="tt5-count">${p.faceUp.length} active</span>`));}
  if(e.oniverse){const d=e.oniverse;zones.push(renderDenizenTabletop(g,{canAct,decisionTargets,asShelf:true}));}
  if(e.mirrors){const m=e.mirrors;zones.push(zone('mirrors','Mirrors',Object.entries(m.stacks).map(([name,cards])=>tile(name,`<span class="tt5-mirror-symbol ${esc(name)}">${symbol[name]||icon('diamond')}</span><span class="tt5-stack-count">${m.completed.includes(name)?icon('check'):`${cards.length}/4`}</span>${cards.length?`<span class="tt5-mirror-held">${preview(cards,2)}</span>`:''}${active&&!m.completed.includes(name)?action('+',`mirrorPlay:${name}`,{title:`Place two Locations beneath ${name} Mirror` }):''}`,{className:`tt5-mirror ${m.completed.includes(name)?'tt5-completed':''}`,title:`${name} Mirror: ${m.completed.includes(name)?'explored':`${cards.length}/4 Locations`}`,hideName:true})).join(''),`<span class="tt5-count">${m.completed.length}/${Object.keys(m.stacks).length}</span>`));}
  if(e.incubus){const i=e.incubus;zones.push(zone('incubus','Incubus',tile(i.level,`<span class="tt5-object-icon">${icon('chess')}</span>${i.stored.length?preview(i.stored,2):`<span class="tt5-stack-count">0 stored</span>`}${active&&i.level!=='easy'&&!i.stored.length?action('Use','incubusActivate',{title:'Anticipate Nightmare'}):''}`,{className:i.used?'tt5-inactive':'',title:`Little Incubus: ${i.level}; ${i.stored.length} cards stored${i.used?'; used':''}`,hideName:true}),`<span class="tt5-count">${i.used?icon('check'):icon('diamond')}</span>`));}
  // Glyphs, Crossroads and Sphinx add cards to the hand, deck and Door row,
  // but no permanent off-deck components of their own.
  return zones;
}
export function renderExpansionTabletop(g,options={}){
  const zones=expansionTabletopZones(g,options).filter(z=>!z.includes('data-tt-zone="alignment"')&&!(options.excludeDenizens&&z.includes('data-tt-zone="denizens"')));
  if(!zones.length)return '';
  if(options.group){const ids=options.group==='primary'?['catchers','premonitions']:options.group==='denizens'?['denizens']:['mirrors','incubus'];
    const rows=zones.filter(z=>ids.some(id=>z.includes(`data-tt-zone="${id}"`)));
    return rows.length?`<div class="tt5-expansions tt9-exp-${options.group}" aria-label="${options.group} expansion components" data-tt5-count="${rows.length}">${rows.join('')}</div>`:'';}
  return `<div class="tt5-expansions" aria-label="Expansion components" data-tt5-count="${zones.length}">${zones.join('')}</div>`;
}
export const EXPANSION_TABLETOP_ZONE_IDS=['alignment','catchers','premonitions','denizens','mirrors','incubus'];

export function renderTowerTabletop(g,options={}){
 if(!g?.expansion?.towers)return '';
 return `<div class="tt8-towers-slot">${expansionTabletopZones(g,options).find(z=>z.includes('data-tt-zone="alignment"'))||''}</div>`;
}

// Rallied Denizens are owned by players. No decorative tile nests around the card.
export function renderDenizenTabletop(g,{owner=null,canAct=true,decisionTargets=new Set(),asShelf=false}={}){
 const d=g.expansion?.oniverse;if(!d)return '';
 const cards=(d.rallied||[]).filter(c=>owner===null||c.owner===owner);
 const stored=(d.treasure||[]).filter(c=>owner===null||c.owner===owner);
 const ownerName=owner===null?'Denizens':`${g.players[owner]?.name||'Player'} · Denizens`;
 const active=canAct&&['action','decision','turnComplete'].includes(g.phase)&&g.status==='active';
 const body=cards.map(c=>{const held=stored.filter(x=>x.holderId===c.id);
  return `<span class="tt17-denizen-holder"><button type="button" class="tt17-denizen-card" data-action="denizen:${esc(c.id)}" aria-label="Inspect and use ${esc(c.ability)}" ${active&&c.owner===g.active?'':'aria-disabled="true"'}>${renderCard(c,{tiny:true})}</button>${held.map(h=>`<span class="tt22-keeper-overlay">${renderCard(h,{tiny:true,select:active||decisionTargets.has(h.id),interactive:active&&g.phase==='action',highlight:decisionTargets.has(h.id)})}</span>`).join('')}</span>`;
 }).join('')+stored.filter(h=>!cards.some(c=>c.id===h.holderId)).map(h=>`<span class="tt17-denizen-reserve">${renderCard(h,{tiny:true,select:active||decisionTargets.has(h.id),interactive:active&&g.phase==='action',highlight:decisionTargets.has(h.id)})}</span>`).join('');
 if(asShelf)return zone('denizens','Denizens',body,`<span class="tt5-count">${cards.length}</span>`);
 return `<section class="tt17-denizen-player" data-tt-zone="denizens" aria-label="${esc(ownerName)}"><div class="tt6-region-heading"><strong>${esc(ownerName)}</strong><b>${cards.length}</b></div><div class="tt17-denizen-cards">${body||'<span class="tt17-empty-denizens" aria-hidden="true"></span>'}</div></section>`;
}
