// Visual-only replay: each frame has already been filtered through viewFor(game, null).
// No room writes or game commands are available in this window.
import {renderCooperativeTabletop} from './tabletop/coop-board.js';
import {replayCaption,opponentReplay} from './engine/replay.js';
import {applyTabletopMetrics} from './tabletop/layout.js';
import {fitTabletop} from './tabletop/fit.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export {opponentReplay,replayCaption};
export function replayStage(entry,seat){return renderCooperativeTabletop(entry.frame,{seat,canAct:false,connected:true});}
export function replayOverlay(entries,index,seat,playing=false){
 const entry=entries[index];if(!entry)return '';
 return `<div class="tt9-replay-layer" data-replay-layer><div class="tt9-replay-scrim" data-action="replayClose"></div><section class="tt9-replay-dialog" role="dialog" aria-modal="true" aria-label="Opponent replay" tabindex="-1"><header class="tt9-replay-head"><strong>Turn replay</strong><span class="tt9-replay-count">${index+1}/${entries.length} · ${esc(replayCaption(entry))}</span><button type="button" data-action="replayClose" aria-label="Close replay">×</button></header><div class="tt9-replay-stage tt6-table-slot" data-replay-stage>${replayStage(entry,seat)}</div><footer class="tt9-replay-controls"><button type="button" data-action="replayPrev" ${index===0?'disabled':''}>Previous</button><button type="button" data-action="replayPlay">${playing?'Pause':'Play'}</button><button type="button" data-action="replayNext" ${index===entries.length-1?'disabled':''}>Next</button></footer></section></div>`;
}
export function fitReplay(layer,entry){
 if(!layer||!entry)return;
 const slot=layer.querySelector('.tt9-replay-stage'),table=slot?.querySelector('.tt2-root');
 if(!table)return;
 applyTabletopMetrics(table,{mode:entry.frame.mode,expansions:entry.frame.config?.expansions||[]});
 fitTabletop(slot,table,{mode:entry.frame.mode,expansions:entry.frame.config?.expansions||[]});
}
