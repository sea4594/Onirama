import {icon,cardSymbol} from '../icons.js';
/* Phase 5: a visual projection of every off-deck expansion component.
 * Controls reuse app.js's existing data-action commands; no rules are computed here. */
import {renderCard,htmlEscape,CARD_COLORS} from './cards.js';

const esc=htmlEscape;
const action=(label,command,{disabled=false,title=label}={})=>`<button type="button" class="tt5-action" data-action="${esc(command)}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
const symbol={red:icon('mirror-art'),blue:icon('mirror-art'),green:icon('mirror-art'),brown:icon('mirror-art'),sun:cardSymbol('sun'),moon:cardSymbol('moon'),key:cardSymbol('key'),glyph:cardSymbol('glyph'),rainbow:cardSymbol('rainbow')};
const premonitionText={red2:'2 red Doors: discard red Locations',green2:'2 green Doors: return a Nightmare',blue2:'2 blue Doors: discard two Keys',brown2:'2 brown Doors: lose a Door',pair2:'2 matching Doors: lose one',doors5:'5 Doors: reveal two Premonitions',rainbow4:'4 colors: discard Happy Dreams',doors3:'3 Doors: redraw your hand'};
// Each omen has a unique *pictogram*: threshold Doors above, consequence below.
// No printed words or color initials; accessible names live on their buttons.
export function premonitionFace(id){
 const color={red2:'red',green2:'green',blue2:'blue',brown2:'brown'}[id]||'neutral';
 const effect={red2:'discard-art',green2:'nightmare-art',blue2:'key',brown2:'portal',pair2:'broken-link',doors5:'paired-doors-art',rainbow4:'happy-dream-art',doors3:'confusion-art'}[id];
 const count={red2:2,green2:2,blue2:2,brown2:2,pair2:2,doors5:5,rainbow4:4,doors3:3}[id]||1;
 const pipColors=id==='rainbow4'?['red','blue','green','brown']:Array.from({length:count},()=>color);
 const motif=effect==='broken-link'?icon('paired-doors-art'):icon(effect||'portal');
 return `<span class="tt18-pm-art tt18-pm-${id}" aria-hidden="true"><span class="tt18-pm-pips">${pipColors.map(c=>`<i class="tt18-pip tt18-pip-${c}"></i>`).join('')}</span><span class="tt18-pm-door">${icon(id==='pair2'?'paired-doors-art':id==='doors5'?'multiple-doors-art':'portal')}</span><span class="tt18-pm-effect">${motif}</span></span>`;
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
    return `<button type="button" class="tt5-tile tt5-catcher ${available?'':'tt5-inactive'}" data-action="inspectCatcher:${i}" aria-label="Dreamcatcher ${i+1}: ${available?'available':'removed'}, ${cards.length} cards, ${lost} Lost Dreams" title="Inspect Dreamcatcher ${i+1}"><span class="tt14-catcher-face">${cards.length?`<span class="tt14-catcher-fan" style="--tt14-held:${cards.length}">${cards.map((c,j)=>`<span class="tt14-held-card" style="--tt14-held-index:${j};z-index:${j+1}">${renderCard(c,{tiny:true})}</span>`).join('')}</span>`:'<span class="tt14-catcher-back" aria-hidden="true"></span>'}</span></button>`;
  }).join(''),`<span class="tt5-count">Failsafes: ${d.failsafes}</span>`));}
  if(e.premonitions){const p=e.premonitions;zones.push(zone('premonitions','Premonitions',p.faceUp.map(id=>{const selectable=canAct&&premonitionChoiceMode&&g.phase==='decision'&&g.pending?.type==='happyDream';const label=premonitionText[id]||id,info=esc(JSON.stringify({kind:'premonition',premonitionId:id})),progress=premonitionProgress(id,g.players);return `<button type="button" class="tt5-tile tt5-premonition ${selectedPremonition===id?'tt7-premonition-selected':''}" data-tt-card-info="${info}" ${selectable?`data-action="happyPremonitionSelect:${esc(id)}" aria-pressed="${selectedPremonition===id}"`:''} aria-label="${esc(label)}" title="${esc(label)}"><span class="tt5-pm-face">${premonitionFace(id)}</span><span class="tt16-pm-progress" aria-label="${progress.current} of ${progress.target} ${progress.unit}"><span class="tt16-pm-meter" style="--tt16-progress:${progress.current/progress.target}"></span><b>${progress.current}/${progress.target}</b></span></button>`;}).join('')+`<button type="button" class="tt14-reserve" data-action="inspectPile:reserve" aria-label="Inspect ${p.reserveCount} reserve Premonition cards" title="Inspect reserve Premonitions"><span class="tt14-reserve-back" aria-hidden="true"></span></button>`,`<span class="tt5-count">${p.faceUp.length} active</span>`));}
  if(e.oniverse){const d=e.oniverse;zones.push(renderDenizenTabletop(g,{canAct:active,decisionTargets,asShelf:true}));}
  if(e.mirrors){const m=e.mirrors;zones.push(zone('mirrors','Mirrors',Object.entries(m.stacks).map(([name,cards])=>tile(name,`<span class="tt5-mirror-symbol ${esc(name)}">${symbol[name]||icon('diamond')}</span><span class="tt5-stack-count">${m.completed.includes(name)?icon('check'):`${cards.length}/4`}</span>${cards.length?`<span class="tt5-mirror-held">${preview(cards,2)}</span>`:''}${active&&!m.completed.includes(name)?action('+',`mirrorPlay:${name}`,{title:`Place two Locations beneath ${name} Mirror` }):''}`,{className:`tt5-mirror ${m.completed.includes(name)?'tt5-completed':''}`,title:`${name} Mirror: ${m.completed.includes(name)?'explored':`${cards.length}/4 Locations`}`,hideName:true})).join(''),`<span class="tt5-count">${m.completed.length}/${Object.keys(m.stacks).length}</span>`));}
  if(e.incubus){const i=e.incubus;zones.push(zone('incubus','Incubus',tile(i.level,`<span class="tt5-object-icon">${icon('chess')}</span>${i.stored.length?preview(i.stored,2):`<span class="tt5-stack-count">0 stored</span>`}${active&&i.level!=='easy'&&!i.stored.length?action('Use','incubusActivate',{title:'Anticipate Nightmare'}):''}`,{className:i.used?'tt5-inactive':'',title:`Little Incubus: ${i.level}; ${i.stored.length} cards stored${i.used?'; used':''}`,hideName:true}),`<span class="tt5-count">${i.used?icon('check'):icon('diamond')}</span>`));}
  // Glyphs, Crossroads and Sphinx add cards to the hand, deck and Door row,
  // but no permanent off-deck components of their own.
  return zones;
}
export function renderExpansionTabletop(g,options={}){
  const zones=expansionTabletopZones(g,options).filter(z=>!z.includes('data-tt-zone="alignment"')&&!(options.excludeDenizens&&z.includes('data-tt-zone="denizens"')));
  if(!zones.length)return '';
  if(options.group){const ids=options.group==='primary'?['catchers','premonitions']:['denizens','mirrors','incubus'];
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
 const active=canAct&&g.phase==='action'&&g.status==='active';
 const body=cards.map(c=>`<span class="tt17-denizen-card">${renderCard(c,{tiny:true})}${active&&c.owner===g.active&&['architect','cyclobot','squirrel','harpoon','hammer','keeper'].includes(c.ability)?action('Use',`denizen:${c.id}`,{title:`Use ${c.ability}`}):''}</span>`).join('')+stored.map(c=>`<span class="tt17-denizen-reserve">${renderCard(c,{tiny:true,select:active||decisionTargets.has(c.id),interactive:active,highlight:decisionTargets.has(c.id)})}</span>`).join('');
 if(asShelf)return zone('denizens','Denizens',body,`<span class="tt5-count">${cards.length}</span>`);
 return `<section class="tt17-denizen-player" data-tt-zone="denizens" aria-label="${esc(ownerName)}"><div class="tt6-region-heading"><strong>${esc(ownerName)}</strong><b>${cards.length}</b></div><div class="tt17-denizen-cards">${body||'<span class="tt17-empty-denizens" aria-hidden="true"></span>'}</div></section>`;
}
