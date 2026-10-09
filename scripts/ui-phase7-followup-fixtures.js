import {writeFileSync,mkdirSync} from 'node:fs';
import {newGame,act,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const dir=new URL('../docs/ui-phase7-followup/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const mode of ['solo','coop'])for(const extra of [false,true]){
 const s=newGame({mode,seed:115,config:{expansions:extra?all:[]}});let game=s;
 if(mode==='coop')while(game.phase==='draft')game=act(game,{type:'draft',id:game.draft[0].id});
 const g=viewFor(game,0);const picked=g.players[0].hand.find(c=>c.kind==='location')?.id;
 for(const selectedId of [null,picked]){
 const board=mode==='solo'?renderSoloTabletop(g,{selectedId}):renderCooperativeTabletop(g,{seat:0,selectedId});
 const dock=renderActionDock(g,0,{selectedId});
 writeFileSync(new URL(`${mode}-${extra?'all':'base'}-${selectedId?'selected':'rest'}.html`,dir),`<main class="page game-viewport" id="main-content"><div class="tt6-table-slot">${board}</div>${dock}</main>`);
 }
}
console.log('Fixtures ready');
