import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderActionDock,dockWithReplay} from '../public/tabletop/action-dock.js';

const css=readFileSync(new URL('../public/tabletop/phase34.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function coopSeat(seat,active,phase='action'){
 const game=viewFor(newGame({mode:'coop',seed:41,manualTurnEnd:true}),seat);
 game.players[0].name='Autumn';
 game.players[1].name='River';
 game.active=active;
 game.phase=phase;
 return renderActionDock(game,seat);
}

test('action panel identifies the player whose turn it is for both multiplayer seats and draft/action phases',()=>{
 for(const phase of ['draft','action','refill','turnComplete']){
  for(const viewer of [0,1]){
   for(const active of [0,1]){
    const html=coopSeat(viewer,active,phase);
    const expected=active===0?'Autumn':'River';
    assert.match(html,new RegExp(`data-turn-seat="${active}"[^>]*aria-label="Current turn: ${expected}"[^>]*>${expected}<\\/span>`));
    assert.equal((html.match(/class="tt34-turn-name"/g)||[]).length,1);
   }
  }
 }
});

test('player-name chip remains compact, escapes names, preserves decisions and replay/pause controls',()=>{
 const game=viewFor(newGame({mode:'coop',seed:47,manualTurnEnd:true}),1);
 game.active=0;game.phase='decision';
 game.players[0].name='<Guest & Player>';
 const dock=renderActionDock(game,1,{dialog:{type:'nightmare',html:'<button>Continue</button>'}});
 assert.match(dock,/&lt;Guest &amp; Player&gt;/);
 assert.doesNotMatch(dock,/<Guest & Player>/);
 assert.match(dock,/tt6-dock-status">[\s\S]*tt34-turn-name[\s\S]*<strong role="status">/);
 const withReplay=dockWithReplay(dock,true);
 assert.equal((withReplay.match(/tt34-turn-name/g)||[]).length,1);
 assert.equal((withReplay.match(/data-action="replayOpen"/g)||[]).length,1);
 assert.equal((withReplay.match(/data-action="openGamePause"/g)||[]).length,1);
 const solo=viewFor(newGame({seed:33}),0);
 assert.doesNotMatch(renderActionDock(solo,0),/tt34-turn-name/);
 game.status='won';
 assert.doesNotMatch(renderActionDock(game,1),/tt34-turn-name/);
});

test('waiting overlay is visibly darker, remains noninteractive, and applies only to online opponent turns',()=>{
 const veil=css.match(/\.game-viewport>\.tt6-table-slot>\.tt34-wait-turn\{([^}]+)\}/)?.[1]||'';
 assert.match(veil,/pointer-events:none/);
 assert.match(veil,/rgba\(4,14,26,\.14\)/);
 assert.match(veil,/rgba\(4,15,28,\.16\)/);
 assert.match(veil,/inset 0 0 0 6px rgba\(3,12,23,\.48\)/);
 assert.match(app,/const waitingForPartner=inGame&&!IS_LOCAL_GAME\(\)&&state\.room\.mode==='coop'/);
 assert.match(app,/seat!==state\.game\.active/);
 assert.match(app,/const waitingIndicator=waitingForPartner\?/);
 assert.match(css,/\.tt6-workspace \.tt34-turn-name\+strong\{[\s\S]*?min-width:0/);
 assert.match(css,/\.tt34-turn-name\[data-turn-seat="1"\]/);
 assert.match(app,/const pausedTurnLabel=pausedTurnName\?/);
});
