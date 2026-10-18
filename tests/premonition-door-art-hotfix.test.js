import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premonitionFace,renderExpansionTabletop} from '../public/tabletop/expansions.js';
import {renderDoorSlots} from '../public/tabletop/door-slots.js';
import {newGame,viewFor} from '../engine/game.js';
const artCss=readFileSync('public/tabletop/phase18.css','utf8');
const doorCss=readFileSync('public/tabletop/card-system.css','utf8');
const outcomes={red2:'discard-locations',green2:'return-nightmare',blue2:'discard-keys',brown2:'lose-door',pair2:'lose-door',doors5:'reveal-premonitions',rainbow4:'discard-happy-dreams',doors3:'redraw-hand-and-reveal'};
test('all eight Premonitions show their actual trigger over their actual consequence in one shared pictogram',()=>{
 const pictures=new Set();
 for(const [id,outcome] of Object.entries(outcomes)){
  const art=premonitionFace(id);pictures.add(art);
  assert.ok(art.indexOf(`data-premonition-trigger="${id}"`)<art.indexOf(`data-premonition-effect="${outcome}"`));
  assert.match(art,/viewBox="0 0 48 68"/);
  assert.match(art,/M5 33h38/);
  assert.equal((art.match(/<svg/g)||[]).length,1);
  assert.ok(art.indexOf('tt28-pm-condition')<art.indexOf('tt28-pm-consequence'));
 }
 assert.equal(pictures.size,8);
});
test('Premonition conditions encode each color and general Door thresholds with consistent shapes',()=>{
 for(const [color,id] of Object.entries({red:'red2',green:'green2',blue:'blue2',brown:'brown2'})){
  assert.match(premonitionFace(id),new RegExp(`fill="#[0-9a-f]{6}">2</text>`,'i'));
  assert.match(premonitionFace(id),/M1 20V8a7 7/);
 }
 for(const [id,n] of [['doors3','3'],['doors5','5']])assert.match(premonitionFace(id),new RegExp(`>${n}</text>`));
 for(const color of ['#ef6b70','#57adf0','#4fc995','#e0a05a'])assert.ok(premonitionFace('rainbow4').includes(color));
 const pair=premonitionFace('pair2');assert.equal((pair.match(/M1 20V8a7 7/g)||[]).length,3); // two triggers + one loss
});
test('the two remove-Door outcomes use identical consequence artwork and a different trigger',()=>{
 const art=id=>premonitionFace(id).split('class="tt28-pm-consequence"')[1].split('</g></svg>')[0];
 assert.equal(art('brown2'),art('pair2'));
 assert.notEqual(premonitionFace('brown2').split('tt28-pm-consequence')[0],premonitionFace('pair2').split('tt28-pm-consequence')[0]);
});
test('new pictograms are used in both active Premonitions and reserve inspection, with intact progress labels',()=>{
 const state=viewFor(newGame({seed:39,config:{expansions:['premonitions']}}),0);
 const html=renderExpansionTabletop(state);
 assert.match(html,/tt28-pm-diagram/);assert.match(html,/tt16-pm-progress/);
 assert.match(artCss,/\.tt28-pm-diagram\{[^}]*width:100%;height:100%/);
});
test('unclaimed Doors have matching colored card faces and diamonds, without styling collected Doors',()=>{
 const html=renderDoorSlots([],{expansions:['oniverse']});
 for(const color of ['red','blue','green','brown']){
  assert.match(html,new RegExp(`tt8-door-empty ${color}[^>]*>[^<]*<svg`));
  assert.ok(doorCss.includes(`.tt8-door-empty.${color}{--tt28-door-color:var(--${color})`));
 }
 assert.match(doorCss,/\.tt8-door-slot:not\(\.tt8-door-complete\) \.tt8-door-empty:is\(\.red,\.blue,\.green,\.brown\)/);
 assert.match(doorCss,/color:var\(--tt28-door-color\)!important/);
 assert.match(doorCss,/fill:currentColor;fill-opacity:\.2/);
 assert.match(html,/tt8-door-empty wild/);
});
