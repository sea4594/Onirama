// Offline Chromium fixture using the actual solo board HTML, CSS and Phase 3
// controller. No test-only engine implementation or network service is needed.
import {readFileSync,writeFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
const g=viewFor(newGame({mode:'solo',seed:43218,config:{expansions:[],difficulties:{}}}),0);
const css=['public/styles.css','public/tabletop/tokens.css','public/tabletop/layout.css','public/tabletop/solo.css','public/tabletop/interactions.css'].map(p=>readFileSync(p,'utf8')).join('\n');
const gestures=readFileSync('public/tabletop/interactions.js','utf8').replace(/^export /gm,'');
const safe=JSON.stringify(g).replace(/</g,'\\u003c');
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><header class="nav"><a href="#" class="brand">ONIRAMA</a></header><main class="page" id="app">${renderSoloTabletop(g)}</main><script>
${gestures}
const game=${safe};window.commands=[];window.selections=[];
let ctrl;
ctrl=createTabletopInteractions({root:document.querySelector('#app'),getGame:()=>game,
 onSelect:id=>{const b=document.querySelector('.tt2-root');const n=b.dataset.selectedCard===id?'':id;b.dataset.selectedCard=n;window.selections.push(n);for(const c of b.querySelectorAll('[data-tt-card]')){c.classList.toggle('selected',c.dataset.ttCard===n);c.setAttribute('aria-pressed',String(c.dataset.ttCard===n))}ctrl.syncTargets();},
 onCommand:(type,id)=>window.commands.push({type,id})});
document.querySelector('#app').addEventListener('click',e=>{const c=e.target.closest('[data-pick]');if(c)ctrl&&window.__fakeSelect(c.dataset.pick)},false);
window.__fakeSelect=id=>{const b=document.querySelector('.tt2-root');b.dataset.selectedCard=id;for(const c of b.querySelectorAll('[data-tt-card]')){c.classList.toggle('selected',c.dataset.ttCard===id);c.setAttribute('aria-pressed',String(c.dataset.ttCard===id))}ctrl.syncTargets()};
</script></body></html>`;
const dest=process.argv[2]||'/mnt/data/onirama-phase3-interactions.html';writeFileSync(dest,html);console.log(dest);
