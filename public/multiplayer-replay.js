// Replay uses the same full-viewport board, dock and hand shelf as live co-op.
// The frames are public snapshots: private hands remain face-down, and the
// simulated gameplay surface is inert. Only playback controls can be used.
import {renderCooperativeTabletop} from './tabletop/coop-board.js';
import {renderActionDock} from './tabletop/action-dock.js';
import {replayCaption,opponentReplay} from './engine/replay.js';
import {applyTabletopMetrics} from './tabletop/layout.js';
import {fitTabletop} from './tabletop/fit.js';
import {fitDenizenCards} from './tabletop/denizen-fit.js';
import {arrangeGameplayHand,fitLandscapeDock,sizeLandscapeHands} from './tabletop/orientation.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export {opponentReplay,replayCaption};
export function replayStage(entry,seat){
 const game=entry.frame;
 const waiting=game.status==='active'&&seat!==game.active?
  `<div class="tt34-wait-turn" aria-hidden="true"><span class="tt34-wait-label"><span class="tt34-wait-star">✦</span>${esc(game.players?.[game.active]?.name||'Your partner')}'s turn</span></div>`:'';
 return `<div class="tt6-table-slot">${renderCooperativeTabletop(entry.frame,{seat,canAct:false,connected:true})}${waiting}</div><div class="tt6-hand-shelf" aria-label="Replay card area"></div>${renderActionDock(game,seat)}`;
}
export function replayOverlay(entries,index,seat,playing=false){
 const entry=entries[index];if(!entry)return '';
 return `<div class="tt9-replay-layer" data-replay-layer><section class="tt9-replay-dialog" role="dialog" aria-modal="true" aria-label="Turn replay" tabindex="-1"><div class="tt9-replay-stage page game-viewport" data-replay-stage inert aria-hidden="true">${replayStage(entry,seat)}</div><div class="tt9-replay-toolbar"><header class="tt9-replay-head"><strong>Replay</strong><span class="tt9-replay-count">${index+1}/${entries.length} · ${esc(replayCaption(entry))}</span><button type="button" data-action="replayClose" aria-label="Close replay">×</button></header><footer class="tt9-replay-controls"><button type="button" data-action="replayRestart" ${index===0?'disabled':''} aria-label="Restart replay">First</button><button type="button" data-action="replayPrev" ${index===0?'disabled':''}>Previous</button><button type="button" data-action="replayPlay" aria-pressed="${playing}">${playing?'Pause':'Play'}</button><button type="button" data-action="replayNext" ${index===entries.length-1?'disabled':''}>Next</button></footer></div></section></div>`;
}
export function fitReplay(layer,entry){
 if(!layer||!entry)return;
 const shell=layer.querySelector('[data-replay-stage]');
 const slot=shell?.querySelector('.tt6-table-slot'),table=slot?.querySelector('.tt2-root');
 if(!table)return;
 const landscape=typeof window!=='undefined'?(window.matchMedia?.('(orientation: landscape)')?.matches??window.innerWidth>window.innerHeight):false;
 fitLandscapeDock(shell,landscape);
 // Match the live viewport's *actual* dock budget, including portrait
 // breakpoints and the adaptive landscape decision height.
 const live=layer.ownerDocument?.querySelector?.('#app>.page.game-viewport');
 if(live&&typeof getComputedStyle==='function'){
  const dockHeight=getComputedStyle(live).getPropertyValue('--tt6-dock-height').trim();
  if(dockHeight)shell.style.setProperty('--tt6-dock-height',dockHeight,'important');
 }
 arrangeGameplayHand(layer,landscape);
 applyTabletopMetrics(table,{mode:entry.frame.mode,expansions:entry.frame.config?.expansions||[]});
 fitTabletop(slot,table,{mode:entry.frame.mode,expansions:entry.frame.config?.expansions||[]});
 fitDenizenCards(slot);
 if(landscape)sizeLandscapeHands(shell.querySelector('.tt6-hand-shelf'));
}
