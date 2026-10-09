// Offline visual QA: real renderer plus real game views; illustrative populated zones.
// Does not change game state or production play.
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const ids=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const scenario=process.argv[2]||'all',all=scenario==='all';
const used=scenario==='incubus'?['incubus']:scenario==='base'?[]:all?ids:scenario==='four'?['book','glyphs','towers','mirrors']:scenario==='catchers'?['dreamcatchers','premonitions','oniverse']:ids;
const difficulties=scenario==='incubus'?{incubus:'apprentice'}:used.includes('mirrors')?{mirrors:'hard'}:{};
const game=newGame({mode:'solo',seed:28,config:{expansions:used,difficulties}}),g=viewFor(game,0);
if(all||scenario==='four'||scenario==='catchers'){
  if(g.expansion.book){g.expansion.book.goals[0].done=true;g.expansion.book.goals[1].done=true;}
  if(g.expansion.dreamcatchers){const d=g.expansion.dreamcatchers;d.stacks[0]=[{id:'visual-lost',kind:'lostDream'},{id:'visual-door',kind:'door',color:'green'}];d.stacks[1]=[{id:'visual-red',kind:'location',color:'red',symbol:'sun'}];}
  if(g.expansion.towers){g.expansion.towers.alignment=[{id:'visual-tower1',kind:'tower',color:'red',number:3,left:'sun+moon',right:'moon'},{id:'visual-tower2',kind:'tower',color:'blue',number:4,left:'moon',right:'moon'}];}
  if(g.expansion.mirrors){g.expansion.mirrors.stacks.sun=[{id:'visual-m1',kind:'location',color:'blue',symbol:'sun'},{id:'visual-m2',kind:'location',color:'red',symbol:'sun'}];}
  if(g.expansion.oniverse){g.expansion.oniverse.rallied=[{id:'visual-denizen',kind:'denizen',ability:'squirrel',owner:0}];g.expansion.oniverse.treasure=[{id:'visual-treasure',kind:'location',color:'green',symbol:'moon'}];}
}
const output=resolve(process.argv[3]||`docs/ui-phase5-baselines/${scenario}.html`);mkdirSync(resolve(output,'..'),{recursive:true});
const dir='../../public/';
const style=['styles.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/interactions.css','tabletop/expansions.css','tabletop/dialogs.css'];
const board=renderSoloTabletop(g,{selectedId:null,canAct:true});
writeFileSync(output,`<!doctype html><html lang="en" data-theme="ocean" data-mode="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${style.map(s=>`<link rel="stylesheet" href="${dir+s}">`).join('')}<style>body{margin:0}.qa-heading{color:#eee;font:13px system-ui;padding:8px 12px;background:#132823}.qa-heading b{letter-spacing:.2em}.qa-report{position:absolute;top:0;left:0;width:1px;height:1px;overflow:hidden}</style></head><body><div class="qa-heading"><b>ONIRAMA</b> · Phase 5 ${scenario} · offline visual fixture</div><main class="page">${board}</main><div id="qa" class="qa-report"></div><script>window.addEventListener('load',()=>{const root=document.querySelector('.tt2-root'),zones=[...root.querySelectorAll('.tt5-zone')];let bad=zones.filter(z=>z.scrollWidth>z.clientWidth+3),oversized=zones.filter(z=>z.getBoundingClientRect().right>innerWidth+3);document.getElementById('qa').textContent=JSON.stringify({width:innerWidth,height:innerHeight,body:document.documentElement.scrollWidth,scrollOverflow:document.documentElement.scrollWidth>innerWidth+3,zoneOverflow:bad.map(x=>x.dataset.ttZone),zoneOffscreen:oversized.map(x=>x.dataset.ttZone),zones:zones.length,hand:root.querySelectorAll('.tt2-hand-card').length});});</script></body></html>`);
console.log(output);
