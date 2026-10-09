import {mkdirSync,writeFileSync} from 'node:fs';
import {newGame,act,viewFor} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const dir=new URL('../docs/ui-phase6-baselines/',import.meta.url);mkdirSync(dir,{recursive:true});
const variants=[['base',[]],['all',['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']]];
for(const [kind,expansions] of variants){
 let s=newGame({mode:'coop',seed:31,config:{expansions}});
 for(let i=0;s.phase==='draft'&&i<6;i++)s=act(s,{type:'draft',id:s.draft[0].id});
 for(const seat of [0,1]){
  const g=viewFor(s,seat),html=renderCooperativeTabletop(g,{seat,connected:true});
  const links=['styles.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css'].map(file=>`<link rel="stylesheet" href="../../public/${file}">`).join('');
  writeFileSync(new URL(`${kind}-seat${seat}.html`,dir),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}</head><body><main class="page">${html}</main></body></html>`);
 }
}
console.log('Created Phase 6 cooperative tabletop visual fixtures.');
