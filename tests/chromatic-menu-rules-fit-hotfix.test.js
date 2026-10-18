import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {renderOverlay} from '../public/game-overlay.js';
import {renderRulesReference} from '../public/rules-guide.js';
import {fitTabletop} from '../public/tabletop/fit.js';
const source=readFileSync('public/app.js','utf8');
const helpers=source.slice(source.indexOf('function handAndShared(g)'),source.indexOf('function eligibleDecisionCards(g)'));
const {defaultDoorKey,drawnDoorSpendsChromatic}=vm.runInNewContext(`${helpers}\n({defaultDoorKey,drawnDoorSpendsChromatic})`);
const sample=(keys,door='red')=>({active:0,mode:'solo',players:[{hand:keys}],pending:{type:'door',card:{kind:'door',color:door},keys:keys.map(c=>({id:c.id}))},expansion:{oniverse:{treasure:[]}}});
test('drawn Door makes Chromatic Chaos spending explicit and prioritizes a matching Key',()=>{
 const off={id:'blue-key',color:'blue',symbol:'key'},same={id:'red-key',color:'red',symbol:'key'},wild={id:'wild-key',color:'wild',symbol:'key'};
 assert.equal(drawnDoorSpendsChromatic(sample([off])),true);assert.equal(defaultDoorKey(sample([off])).id,off.id);
 assert.equal(drawnDoorSpendsChromatic(sample([off,same])),false);assert.equal(defaultDoorKey(sample([off,same])).id,same.id);
 assert.equal(drawnDoorSpendsChromatic(sample([off,wild])),false);assert.equal(drawnDoorSpendsChromatic(sample([off],'wild')),false);
 assert.match(source,/drawnDoorSpendsChromatic\(g\)\?'Chromatic Chaos \+ Key':'Use Key'/);
 assert.match(source,/const best=defaultDoorKey\(g\)/);
});
test('all pause tabs have identical window structure and a single permanent Exit game footer',()=>{
 for(const tab of ['log','settings','rules']){
  const html=renderOverlay('pause',['towers'],false,{tab});
  assert.equal((html.match(/data-action="gameGoHome"/g)||[]).length,1);
  assert.match(html,/<footer class="game-menu-footer"><button[^>]*data-action="gameGoHome"/);
  assert.ok(html.indexOf('<footer class="game-menu-footer"')>html.indexOf('game-menu-content'));
  assert.equal((html.match(/class="game-menu-tab /g)||[]).length,3);
 }
 const css=readFileSync('public/game-shell.css','utf8');
 assert.match(css,/\.game-menu-dialog\{width:min\(740px,100%\);height:min\(760px,calc\(100dvh - 16px\)\)/);
 assert.match(css,/\.game-menu-footer>\[data-action="gameGoHome"\]\{width:100%\}/);
});
test('in-game and main rules have the same content presentation, with only active modules in-game',()=>{
 const main=renderRulesReference(),active=renderOverlay('pause',['towers','oniverse'],false,{tab:'rules'});
 assert.match(active,/data-action="tutorial"[^>]*>Guided tutorial/);
 assert.match(active,/data-guide-search/);
 for(const id of ['base','towers','oniverse','combinations'])assert.match(active,new RegExp(`data-guide-chapter="${id}"`));
 for(const id of ['coop','glyphs','incubus'])assert.doesNotMatch(active,new RegExp(`data-guide-chapter="${id}"`));
 for(const html of [main,active])assert.doesNotMatch(html,/guide-subtitle|guide-intro/);
 assert.match(readFileSync('public/shell.css','utf8'),/\.shell-guided-tutorial\{background:var\(--ui-panel\)/);
});
test('scaled solo tabletop stretches to fill the allocated viewport above the dock',()=>{
 const style={width:'',height:'',setProperty(name,value){this[name]=value;}};
 const table={style,dataset:{},querySelector(){return null;},querySelectorAll(){return [];},get scrollHeight(){return parseFloat(style.height)|| (parseFloat(style.width)>500?650:800);},getBoundingClientRect(){return {height:parseFloat(style.height||this.scrollHeight)*Number((style.transform||'').match(/scale\(([.\d]+)\)/)?.[1]||1)};}};
 const viewport={clientWidth:390,clientHeight:550};
 const result=fitTabletop(viewport,table,{mode:'solo'});
 assert.ok(result.zoom<1);assert.ok(parseFloat(style.height)>=viewport.clientHeight/result.zoom-1);
 assert.ok(result.tableHeight>=viewport.clientHeight-2);
});
