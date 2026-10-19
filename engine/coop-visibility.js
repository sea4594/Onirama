// Cooperative public-information policy. Never serialize hand cards, peeked deck
// cards, deck order, or selections made solely inside private inspections.
const titles={
 draft:'Draft a card',action:'Play or discard',turnComplete:'End turn',refill:'Draw a card',
 drawReady:'Draw a card',drawn:'Drawing cards',door:'Drawn Door: use a Key?',doorSearch:'Retrieve a Door',
 nightmare:'Nightmare: choose a penalty',prophecy:'Prophecy',incantation:'Incantation',
 incantationOrder:'Incantation: arrange cards',happyDream:'Happy Dream: choose an effect',
 happyPeek:'Happy Dream: inspect cards',happyFetch:'Happy Dream: search deck',
 rally:'Rally a Denizen',denizenPeek:'Denizen: inspect cards',towerLook:'Tower: inspect cards',
 towerPenalty:'Nightmare: choose a Tower',spellPeek:'Paradoxical Prophecy',
 premonitionPick:'Dark Premonition: choose an effect',premonitionDoor:'Dark Premonition: remove a Door',
 premonitionKeys:'Dark Premonition: discard Keys',premonitionNightmare:'Dark Premonition: return a Nightmare',
 mirrorReward:'Mirror: choose a reward',catchChoose:'Dreamcatcher: choose a catcher',
 catchOverload:'Overload!',coopSwap:'Swap cards',sphinxName:'Sphinx: name an aspect',
 sphinxResolve:'Sphinx: inspect cards',diver:'Diver: inspect cards',confusion:'Confusion: rearrange cards',
 moduleDecision:'Resolve an effect'
};
const option=(id,label)=>({id,label});
const publicCards=new Set(['nightmare','door','happyDream','rally','sphinxName','confusion']);
const publicButtons={
 nightmare:[option('key','Discard key'),option('door','Remove door'),option('reveal','5 from deck'),option('hand','Discard hand')],
 door:[option('gain','Use Key'),option('limbo','Pass')],
 happyDream:[option('banish','Remove Premonition'),option('peek','Peek'),option('fetch','Move card & shuffle')],
 catchOverload:[option('remove','Remove Dreamcatcher')],
 towerPenalty:[option('discard','Remove Tower'),option('fake','False destruction')],
 coopSwap:[option('swap','Swap'),option('pass','Pass')]
};
const privateTypes=new Set(['prophecy','incantation','incantationOrder','happyPeek','happyFetch','denizenPeek','towerLook','spellPeek','sphinxResolve','diver','confusion','mirrorReward','premonitionKeys']);
export function coopSpectatorDecision(game){
 if(game?.mode!=='coop'||game.status!=='active')return null;
 const p=game.pending||{},type=game.phase==='decision'?p.type:game.phase;
 const title=titles[type]||'Resolve an effect';
 const result={type,title,visibility:privateTypes.has(type)||p.visibility==='private'?'private':'public',buttons:[]};
 if(result.visibility==='private'){
  // Drawing a public Dream is visible even if its subsequent card manipulation is private.
  if(['confusion','sphinxResolve','diver'].includes(type)&&p.card?.kind)result.card={...p.card};
  return result;
 }
 if(publicCards.has(type)&&p.card?.kind&&!['hidden'].includes(p.card.kind))result.card={...p.card};
 if(publicButtons[type])result.buttons=publicButtons[type].map(o=>({...o}));
 if(type==='nightmare'&&p.incubus)result.card=null;
 if(type==='happyDream'&&!game.moduleState?.premonitions?.faceUp?.length)result.buttons=result.buttons.filter(o=>o.id!=='banish');
 if(type==='doorSearch'){
  const colors=[p.color,...(game.config?.expansions||[]).includes('oniverse')?['wild']:[]];
  result.buttons=colors.filter(Boolean).map(color=>option('deck:'+color,`Search & shuffle (${color})`));
  const d=game.moduleState?.dreamcatchers;
  if(d){for(let i=0;i<4;i++)if(d.active?.[i])for(const c of d.zones?.['catch'+i]||[])if(c.kind==='door'&&colors.includes(c.color))result.buttons.push(option('catch'+i,`From catcher ${i+1}`));}
  if(game.moduleState?.oniverse?.zones?.rallied?.some(d=>d.owner===game.active&&d.ability==='chromatic'))result.buttons.push(option('chromatic','Chromatic Chaos'));
  result.buttons.push(option('skip','Pass'));
 }
 if(type==='sphinxName')result.buttons=['red','blue','green','brown','moon','key',...(game.config?.expansions||[]).includes('glyphs')?['glyph']:[]].map(x=>option(x,x));
 if(type==='premonitionPick')result.buttons=(p.options||[]).map(x=>option(x,String(x)));
 if(type==='moduleDecision'&&p.visibility==='public')result.buttons=(p.options||[]).map(x=>option(x,String(x)));
 if(type==='draft')result.buttons=[]; // Drafted faces are already shown on the tabletop.
 return result;
}
// Only public choice labels, never card IDs, ordered lists, payments or hidden choices.
export function coopPublicChoice(previous,command){
 if(previous?.mode!=='coop'||!command||typeof command.type!=='string')return null;
 const prior=coopSpectatorDecision(previous),type=previous.pending?.type;
 if(!prior)return null;
 if(command.type==='previewChoice'&&['spellbook','denizen','failsafe','freeing','clear'].includes(command.choice)){
  const headings={spellbook:'Book of Steps: cast a spell',denizen:'Use a Denizen?',failsafe:'Failsafe: choose a Dreamcatcher',freeing:'Free a dreamcatcher?',clear:prior.title};
  return {title:headings[command.choice],choice:null,buttons:[],card:null,type:command.choice==='clear'?prior.type:'action-preview',clear:command.choice==='clear'};
 }
 let id=null;
 if(command.type==='previewChoice')id=command.choice;
 else if(type==='nightmare'){
  if(command.type==='nightmare')id=command.option;
  else if(command.type==='cast'&&command.spell==='punishment')id='punishment';
 }else if(type==='door'){
  if(command.type==='chooseDoor')id=command.option==='limbo'?'limbo':'gain';
 }else if(type==='happyDream'&&command.type==='happyDream')id=command.option;
 else if(type==='doorSearch'&&command.type==='doorSearch')id=command.option==='skip'?'skip':command.option==='direct'?'catch'+Number(String(command.source||'').replace(/\D/g,'')):command.option==='search'?'deck:'+previous.pending.color:null;
 else if(type==='towerPenalty'&&command.type==='towerPenalty')id=command.option;
 else if(type==='catchOverload'&&command.type==='catchOverload')id='remove';
 else if(type==='coopSwap'&&command.type==='coopSwap')id=command.option;
 else if(type==='sphinxName'&&command.type==='sphinxName')id=command.aspect;
 else if(type==='premonitionPick'&&command.type==='premonitionPick')id=command.id;
 else if(type==='moduleDecision'&&command.type==='moduleDecision'&&prior.visibility==='public')id=command.option;
 // A public-board selection can be presented as a generic selection, never a private card ID.
 else if(['premonitionDoor','premonitionNightmare','rally'].includes(type)&&command.type===type)id='selected';
 const chosen=prior.buttons.find(b=>b.id===id);
 const descriptions={draft:'Draft a card',play:'Play a Location',playTower:'Play a Tower',discard:'Discard a card',draw:'Draw a card',endTurn:'End turn',useDenizen:'Use a Denizen',cast:'Cast a spell',mirrorPair:'Complete a Mirror',freeCatcher:'Free a Dreamcatcher',escape:'Escape a Dead End',chooseDoor:'Claim a Door',rally:'Rally a Denizen'};
 const activity=descriptions[command.type]||prior.title;
 const title=chosen||id==='selected'||id==='punishment'?prior.title:activity;
 const choice=chosen?.label||(id==='punishment'?'Powerful Punishment':id==='selected'?'Selected card':null);
 // Never echo a private selection, card ID, or deck ordering into a public event.
 return {title,choice,buttons:prior.visibility==='public'&&choice?prior.buttons:[],card:prior.visibility==='public'&&choice?prior.card||null:null,type:prior.type};
}
