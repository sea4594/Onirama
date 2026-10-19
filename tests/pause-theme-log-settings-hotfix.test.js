import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderOverlay,renderSettingsContents} from '../public/game-overlay.js';

const read=path=>readFileSync(path,'utf8');
const themes=[{id:'moonlit',name:'Moonlit'},{id:'copper',name:'Copper'}];
const commit='a'.repeat(40);
const settings={theme:'copper',motion:'reduced',themes,commit};

test('pause Settings uses the identical Settings body as the main Settings page',()=>{
 const shared=renderSettingsContents(settings);
 const html=renderOverlay('pause',[],false,{...settings,tab:'settings'});
 assert.ok(html.includes(shared));
 assert.match(shared,/<h2 class="shell-section-title">Appearance<\/h2>/);
 for(const label of ['Theme','Animations','History &amp; statistics','commit:'])assert.ok(shared.includes(label),label);
 assert.ok(shared.includes(`https://github.com/sea4594/Onirama/commit/${commit}`));
 assert.match(shared,/<option value="copper" selected>Copper<\/option>/);
 assert.match(shared,/<option value="reduced" selected>Reduced motion<\/option>/);
 const app=read('public/app.js');
 assert.match(app,/renderSettingsContents\(\{\.\.\.uiSettings,themes:THEME_PRESETS,commit:BUILD_COMMIT\}\)/);
 assert.match(app,/commit:BUILD_COMMIT,log:/);
 assert.match(html,/data-action="history"/);
});

test('pause window adopts the selected theme colors instead of light-only overlay colors',()=>{
 const css=read('public/game-shell.css');
 for(const value of ['--overlay-panel:var(--ui-panel)','--overlay-text:var(--ui-text)','--overlay-soft:var(--ui-soft)','--overlay-border:var(--ui-border)','--overlay-input:var(--ui-bg)'])assert.ok(css.includes(value),value);
 assert.match(read('public/theme.css'),/\.game-menu-dialog button\.primary\{color:var\(--ui-bg\)\}/);
 const html=renderOverlay('pause',[],false,{...settings,tab:'log'});
 assert.match(html,/game-menu-layer/);
});

test('action log scrolls in the full menu content region, never an inner 220px window',()=>{
 const css=read('public/game-shell.css');
 assert.match(css,/\.game-menu-content\{flex:1 1 auto;min-height:0;overflow-y:auto\}/);
 assert.match(css,/\.game-menu-dialog \.tt9-action-log\{max-height:none;overflow:visible/);
 assert.match(css,/\.game-menu-dialog \.game-menu-history\{min-height:0;overflow:visible\}/);
 const log=Array.from({length:85},(_,i)=>`Action ${i+1}`);
 const html=renderOverlay('pause',[],false,{log,tab:'log'});
 assert.ok(html.includes('Action 1')&&html.includes('Action 85'));
 const actionLog=html.match(/<ol class="tt9-action-log"[^>]*>([\s\S]*?)<\/ol>/)?.[1]||'';
 assert.equal((actionLog.match(/<li>/g)||[]).length,85);
});
