import {planTabletop,applyTabletopMetrics} from './layout.js';
import {EXPANSION_ZONES} from './zones.js';
const app=document.querySelector('#study');
const names={draw:'Draw',discard:'Discard',limbo:'Limbo','game-status':'Turn · Objective',
  'shared-hand':'Shared hand',draft:'Public draft',goals:'Ordered goals',spellbook:'Spellbook',
  catchers:'Dreamcatchers',failsafe:'Failsafe books',alignment:'Tower alignment',
  premonitions:'Dark premonitions','premonition-reserve':'Premonition reserve',
  denizens:'Rallied denizens',keeper:'Treasure Keeper',mirrors:'Mirrors',incubus:'Little Incubus'};
const printable=id=>names[id]||id.replace(/^p([01])-/,(_,n)=>`Player ${Number(n)+1} · `).replaceAll('-',' ');
const exp=Object.keys(EXPANSION_ZONES).filter(x=>x!=='incubus');
function update(){
  const mode=document.querySelector('#mode').value,density=document.querySelector('#density').value;
  const expansions=density==='none'?[]:density==='four'?['book','glyphs','dreamcatchers','towers']:exp;
  const plan=planTabletop({width:app.getBoundingClientRect().width,height:window.innerHeight,mode,expansions});
  app.innerHTML=plan.zones.map(id=>{const region=plan.regions.core.includes(id)?'core':plan.regions.players.includes(id)?'players':'expansions';return `<section class="tt-zone" data-zone="${id}" data-region="${region}" role="group" aria-label="${printable(id)}"><div class="tt-label">${printable(id)}</div><div class="tt-card-row"><span class="tt-card">☽</span><span class="tt-card">♢</span><span class="tt-card">✦</span></div><span class="tt-count">${plan.inspection==='tap-zoom'?'⋯':''}</span></section>`;}).join('');
  applyTabletopMetrics(app,{mode,expansions});
}
document.querySelector('#mode').addEventListener('change',update);
document.querySelector('#density').addEventListener('change',update);
window.addEventListener('resize',update);
update();
