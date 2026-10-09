// Developer-only static preview snapshots: deterministic HTML for visual baselines.
import {readFileSync,writeFileSync} from 'node:fs';
import {planTabletop} from '../public/tabletop/layout.js';
const [path,width='390',height='844',mode='solo',density='none']=process.argv.slice(2);
if(!path)throw Error('Usage: node scripts/tabletop-snapshot.js OUTPUT.html WIDTH HEIGHT solo|coop none|four|all');
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const expansions=density==='none'?[]:density==='four'?all.slice(0,4):all;
const plan=planTabletop({width:Number(width),height:Number(height),mode,expansions});
const css=readFileSync('public/tabletop/tokens.css','utf8')+'\n'+readFileSync('public/tabletop/layout.css','utf8');
const labels={draw:'Draw',discard:'Discard',limbo:'Limbo','game-status':'Turn / objective','shared-hand':'Shared hand',draft:'Draft',goals:'Ordered goals',spellbook:'Spellbook',catchers:'Dreamcatchers',failsafe:'Failsafe books',alignment:'Tower alignment',premonitions:'Dark Premonitions','premonition-reserve':'Premonition reserve',denizens:'Rallied Denizens',keeper:'Treasure Keeper',mirrors:'Mirrors',incubus:'Little Incubus'};
const printable=s=>labels[s]||s.replace(/^p([01])-/,(_,n)=>`P${Number(n)+1} · `).replaceAll('-',' ');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="tt-preview-shell"><header class="tt-preview-toolbar"><strong>ONIRAMA · Tabletop layout study</strong><span>${mode==='coop'?'Cooperative':'Solo'} · ${density==='none'?'Base':density==='four'?'4 expansions':'9 expansions'}</span></header><main class="tt-table" data-tabletop-layout="${plan.layout}" data-tabletop-density="${plan.density>=7?'dense':plan.density>=3?'moderate':'light'}" style="--tabletop-gap:${plan.gap}px;--tabletop-card-width:${plan.cardWidth}px;--tabletop-compact-width:${plan.compactWidth}px">${plan.zones.map(id=>`<section class="tt-zone" data-zone="${id}" data-region="${plan.regions.core.includes(id)?'core':plan.regions.players.includes(id)?'players':'expansions'}"><div class="tt-label">${printable(id)}</div><div class="tt-card-row"><span class="tt-card">☽</span><span class="tt-card">♢</span><span class="tt-card">✦</span></div></section>`).join('')}</main></body></html>`;
writeFileSync(path,html);
