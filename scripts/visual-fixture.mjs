import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const output=resolve(process.argv[2]||'visual-fixtures');mkdirSync(output,{recursive:true});
import {newGame,act,viewFor} from '../engine/game.js';
import {renderCard} from '../public/tabletop/cards.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const dir='public';
const html=readFileSync('public/index.html','utf8');
const css=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?#]+\.css)">/g)].map(m=>readFileSync(`${dir}/${m[1]}`,'utf8')).join('\n');
const fit=readFileSync('public/tabletop/fit.js','utf8').replaceAll('export function ','function ');
const expansions=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
for(const mode of ['solo','coop'])for(const variants of [[],expansions]){
 const config={expansions:variants};let g=newGame({seed:33,mode,config});
 while(g.phase==='draft')g=act(g,{type:'draft',id:g.draft[0].id});
 const view=viewFor(g,0),game=mode==='solo'?renderSoloTabletop(view):renderCooperativeTabletop(view,{seat:0});
 const name=`${mode}-${variants.length?'all':'base'}`;
 writeFileSync(join(output,`${name}.html`),`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body><main class="page game-viewport" style="width:100vw;height:100dvh;display:grid;grid-template-rows:minmax(0,1fr) 150px;overflow:hidden"><div class="tt6-table-slot" style="min-height:0;overflow:hidden">${game}</div><section class="tt6-workspace" data-action-dock aria-label="Game actions"><div class="tt6-dock-status"><strong>Your turn</strong></div></section></main><script>${fit}\nfitTabletop(document.querySelector('.tt6-table-slot'),document.querySelector('.tt2-root'),{mode:'${mode}',expansions:${JSON.stringify(variants)}});</script></body></html>`);
}
const types=[{kind:'location',color:'red',symbol:'sun'},{kind:'location',color:'brown',symbol:'sun'},{kind:'door',color:'red'},{kind:'door',color:'wild',expansion:'oniverse'},...['nightmare','lostDream','happyDream','deadEnd','sphinx','diver','confusion'].map(kind=>({kind})),...['architect','cyclobot','squirrel','harpoon','hammer','chromatic','mirror','keeper'].map(ability=>({kind:'denizen',ability}))];
writeFileSync(join(output,'cards.html'),`<html><head><style>${css} body{background:#173832;padding:15px} .gallery{display:flex;flex-wrap:wrap;gap:12px;align-items:start}.column{display:grid;gap:8px}.column .card{flex:none;min-width:0!important}.gallery .label{color:white;font:12px sans-serif;max-width:90px}</style></head><body><div class="gallery">${types.map(c=>`<div class="column"><div class="label">${c.kind} ${c.ability||c.color||''}</div>${[28,45,75,100].map(w=>`<div style="width:${w}px">${renderCard(c,{tiny:w<75})}</div>`).join('')}</div>`).join('')}</div></body></html>`);
