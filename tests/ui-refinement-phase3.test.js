import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {icon,cardSymbol} from '../public/icons.js';
import {renderCard} from '../public/tabletop/cards.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderOverlay} from '../public/game-overlay.js';
import {newGame,viewFor} from '../engine/game.js';
const src=readFileSync('public/app.js','utf8'),palette=readFileSync('public/theme.css','utf8');
const names=['forest','moonlit','copper','lagoon','heather','sandstone'];
test('Forest is the default; all legacy presets removed; formerly saved legacy palette falls back safely',()=>{
 assert.match(src,/theme:'forest'/);assert.match(src,/raw\.theme:'forest'/);
 for(const name of names)assert.ok(src.includes(`id:'${name}'`),name);
 for(const old of ["id:'ocean-light'","id:'ocean-dark'","id:'bw'","id:'forest-dark'","id:'clay'","id:'berry'"])assert.ok(!src.includes(old),old);
 assert.match(src,/localStorage\.setItem\(SETTINGS_KEY,JSON\.stringify\(uiSettings\)\)/);
});
test('One theme stylesheet owns every coordinated palette; screen, table, and modal tokens are shared',()=>{
 const html=readFileSync('public/index.html','utf8');assert.ok(html.indexOf('game-shell.css')<html.indexOf('theme.css'));
 for(const name of names)assert.match(palette,new RegExp(`data-theme="${name}"`));
 for(const token of ['--ui-bg','--ui-panel','--ui-soft','--ui-text','--ui-accent','--ui-border','--table-felt-light','--card-back-a','--overlay-panel','--overlay-primary'])assert.ok(palette.includes(token),token);
 assert.doesNotMatch(readFileSync('public/styles.css','utf8'),/data-theme="ocean"|data-theme="bw"|data-theme="clay"|data-theme="berry"/);
});
test('Game Pause settings offer the same selectable themes without leaving gameplay',()=>{
 const themes=names.map(id=>({id,name:id[0].toUpperCase()+id.slice(1)}));
 const html=renderOverlay('pause',[],false,{theme:'lagoon',themes});
 assert.match(html,/data-setting="theme"/);for(const theme of names)assert.ok(html.includes(`value="${theme}"`),theme);
 assert.match(html,/value="lagoon" selected/);
 assert.match(html,/data-action="closeGameOverlay"/);
});
test('All interface icons use accessible inert SVG rather than platform emoji',()=>{
 for(const name of ['single','users','settings','help','pause','close','plus','enter','check','book','cards','flower','sparkle','sun','moon','key','door','warning','tower','chess']){
  const svg=icon(name);assert.match(svg,/<svg class="ui-icon"/);assert.match(svg,/aria-hidden="true"/);assert.match(svg,/viewBox="0 0 24 24"/);assert.doesNotMatch(svg,/<script|onload|<image|href=/);
 }
 assert.match(cardSymbol('glyph'),/class="ui-icon"/);
});
test('Cards retain human-readable descriptions with SVG illustrations instead of emoji glyphs',()=>{
 const location=renderCard({id:'a',kind:'location',symbol:'sun',color:'red'},{select:true});
 const tower=renderCard({id:'b',kind:'tower',color:'blue',number:3,left:'sun+moon',right:'key'});
 assert.match(location,/aria-label="red sun"/);assert.match(location,/<svg class="ui-icon"/);
 assert.match(tower,/tt8-tower-marks/);assert.match(tower,/blue Tower/);assert.match(tower,/sun\+moon/);assert.match(tower,/class="ui-icon"/);
});
test('Solo and cooperative tabletops retain controls, deck counts, and SVG game menu buttons',()=>{
 for(const mode of ['solo','coop']){
  const g=viewFor(newGame({mode,seed:23,config:{expansions:['book','glyphs','towers','premonitions']}}),0);
  const html=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g,{seat:0});
  for(const action of ['openGamePause','openGameRules'])assert.ok(html.includes(`data-action="${action}"`),action);
  assert.match(html,/class="ui-icon"/);assert.match(html,/>Draw</);assert.match(html,/data-action="openSpells"/);assert.doesNotMatch(html,/data-tt-zone="goals"/);
 }
});
