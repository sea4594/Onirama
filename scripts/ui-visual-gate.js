#!/usr/bin/env node
// Dependency-free, real-Chromium geometry gate. Does not use image snapshots:
// it measures actual styled card boxes at representative viewport sizes.
// Chrome/Chromium auto-discovery supports Linux and macOS. On machines without
// a browser the Node release gate still runs, but CI requires Chromium.
import {spawn} from 'node:child_process';
import {CdpWebSocket} from './cdp-websocket.js';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock,dockWithReplay} from '../public/tabletop/action-dock.js';
import {renderCard} from '../public/tabletop/cards.js';

const ROOT=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const viewports=[[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]];
const strict=process.argv.includes('--require-browser')||process.env.CI==='true'||process.env.ONIRAMA_REQUIRE_BROWSER==='1';
const expansions=['towers','dreamcatchers','premonitions','mirrors','book','oniverse'];
const fixtures=new Map();
const template=await readFile(join(ROOT,'index.html'),'utf8');
const cssFiles=[...template.matchAll(/<link rel="stylesheet" href="\.\/([^"?#]+\.css)"/g)].map(m=>m[1]);
const cssContents=(await Promise.all(cssFiles.map(n=>readFile(join(ROOT,n),'utf8')))).join('\n');
const links=`<style>${cssContents.replaceAll('</style','<\/style')}</style>`;
const tower={id:'qa-tower',kind:'tower',color:'red',number:5,left:'sun',right:'moon'};
const denizen={id:'qa-denizen',kind:'denizen',color:'brown',ability:'keeper'};
function fixture(mode,heavy,seat=0){
 const options=heavy?{expansions,difficulties:{}}:{expansions:[],difficulties:{}};
 const state=newGame({mode,seed:400+seat,config:options});
 // Exercise public equipment plus both player perspectives in real renderers.
 const game=viewFor(state,seat);
 const board=mode==='solo'?renderSoloTabletop(game):renderCooperativeTabletop(game,{seat});
 let dock=renderActionDock(game,seat);
 // The drawing is a real card rendered through production card primitives.
 // It is intentionally inside the production action dock, not a test-only CSS replica.
 const samples=`<div class="tt3-order-list" data-ui-qa-card-lane aria-label="Regression card selection row">${[tower,denizen,...Array.from({length:7},(_,i)=>({id:'qa-loc'+i,kind:'location',color:['red','blue','green','brown'][i%4],symbol:i%2?'moon':'sun'}))].map(c=>`<div class="tt3-order-handle">${renderCard(c,{tiny:true})}</div>`).join('')}</div>`;
 dock=dock.replace(/(<div class="tt6-dock-scroll"[^>]*>)/,'$1'+samples);
 if(mode==='coop')dock=dockWithReplay(dock,true);
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${links}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#app{width:100%;height:100%}</style></head><body><div id="app"><main class="page game-viewport"><div class="tt6-table-slot">${board}</div><div class="tt6-hand-shelf" aria-label="Your hand"></div>${dock}</main></div></body></html>`;
}
for(const mode of ['solo','coop'])for(const heavy of [false,true])for(const seat of (mode==='coop'?[0,1]:[0]))fixtures.set(`${mode}-${heavy?'heavy':'base'}-${seat}`,fixture(mode,heavy,seat));

async function exists(p){try{await access(p);return true}catch{return false}}
const candidates=[process.env.ONIRAMA_BROWSER,process.env.CHROME_PATH,process.env.CHROMIUM_PATH,
 '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/Applications/Chromium.app/Contents/MacOS/Chromium',
 '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'].filter(Boolean);
let bin;for(const item of candidates){if(await exists(item)){bin=item;break}}
if(!bin){
 const message='No Chrome/Chromium found. Browser geometry checks were NOT run. Install Chrome or set ONIRAMA_BROWSER to the executable.';
 if(strict){console.error('UI VISUAL GATE FAILED: '+message);process.exit(1)}
 console.warn('UI VISUAL GATE SKIPPED: '+message);process.exit(0);
}
let browser,dir,ws;const pending=new Map();let seq=0;
async function send(method,params={}){
 const id=++seq;return new Promise((ok,fail)=>{const timeout=setTimeout(()=>{pending.delete(id);fail(Error('Browser did not answer: '+method))},12000);pending.set(id,{ok:v=>{clearTimeout(timeout);ok(v)},fail:v=>{clearTimeout(timeout);fail(v)}});ws.send(JSON.stringify({id,method,params}))});
}
try{
 dir=await mkdtemp(join(tmpdir(),'onirama-ui-visual-'));
 browser=spawn(bin,['--headless=new','--allow-file-access-from-files','--no-proxy-server','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore'});
 let port;
 for(let i=0;i<90;i++){
  try{port=Number((await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}catch{}
  if(browser.exitCode!==null)throw Error('Browser exited before DevTools became available');
  await delay(100);
 }
 if(!port)throw Error('Timed out waiting for Chromium DevTools');
 const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
 const page=targets.find(x=>x.type==='page');if(!page)throw Error('Chromium launched without a page');
 ws=new (globalThis.WebSocket||CdpWebSocket)(page.webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});
 ws.addEventListener('message',e=>{const obj=JSON.parse(e.data);if(obj.method==='Runtime.exceptionThrown')console.error('JS EXCEPTION', JSON.stringify(obj.params.exceptionDetails).slice(0,600));if(!obj.id||!pending.has(obj.id))return;const p=pending.get(obj.id);pending.delete(obj.id);obj.error?p.fail(Error(JSON.stringify(obj.error))):p.ok(obj.result)});
 await send('Page.enable');await send('Runtime.enable');
 const failures=[];let inspected=0;
 const sourceFit=(await readFile(join(ROOT,'tabletop/fit.js'),'utf8')).replace(/\bexport\s+/g,'');
 const sourceOrientation=(await readFile(join(ROOT,'tabletop/orientation.js'),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+/g,'');
 const sourceDenizen=(await readFile(join(ROOT,'tabletop/denizen-fit.js'),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+/g,'');
 const fitScript=`(()=>{\n{${sourceFit};window.__fitTabletop=fitTabletop;}\n{const CARD_HEIGHT_RATIO=1.42;${sourceOrientation};window.__arrangeGameplayHand=arrangeGameplayHand;window.__fitLandscapeDock=fitLandscapeDock;window.__sizeLandscapeHands=sizeLandscapeHands;}\n{const CARD_HEIGHT_RATIO=1.42;const cardHeight=w=>w*1.42;${sourceDenizen};window.__fitDenizenCards=fitDenizenCards;}\nreturn true;})()`;
 const matrix=viewports.flatMap(([w,h],i)=>[
  [w,h,'solo-heavy-0'],[w,h,'coop-heavy-0'],
  ...(i===0||i===1||i===4?[[w,h,'coop-heavy-1']]:[])
]);
 for(const [width,height,key] of matrix){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const tree=await send('Page.getFrameTree');const frameId=tree.frameTree.frame.id;
  const html=fixtures.get(key);
  await send('Page.setDocumentContent',{frameId,html});
  const loaded=await send('Runtime.evaluate',{expression:fitScript,returnByValue:true});
  if(loaded.exceptionDetails)console.error('FIT LOAD ERROR',JSON.stringify(loaded.exceptionDetails).slice(0,800));
  const init=await send('Runtime.evaluate',{expression:`(()=>{try{const shell=document.querySelector('.game-viewport'),slot=shell.querySelector('.tt6-table-slot'),board=slot.querySelector('.tt2-root');const landscape=innerWidth>innerHeight;window.__fitLandscapeDock(shell,landscape);window.__arrangeGameplayHand(document,landscape);window.__fitTabletop(slot,board,{mode:'${key.startsWith('solo')?'solo':'coop'}',expansions:${JSON.stringify(expansions)}});window.__fitDenizenCards(board);window.__sizeLandscapeHands(shell.querySelector('.tt6-hand-shelf'));window.__qaReady={ok:true};}catch(e){window.__qaReady={ok:false,message:String(e.stack||e)}}return JSON.stringify(window.__qaReady)})()`,returnByValue:true});
  if(init.exceptionDetails)console.error('FIT ERROR',JSON.stringify(init.exceptionDetails).slice(0,800));
  const measured=await send('Runtime.evaluate',{expression:`JSON.stringify((${inspectBrowser.toString()})())`,returnByValue:true});
  const report=JSON.parse(measured.result?.value||'null');
  if(init.exceptionDetails||loaded.exceptionDetails||!report){failures.push(`${width}x${height} ${key}: browser evaluation failed`);continue}
  if(JSON.parse(init.result?.value||'null')?.ok!==true){failures.push(`${width}x${height} ${key}: fitter did not complete`);continue}
  inspected++;
  for(const issue of report.issues||[])failures.push(`${width}x${height} ${key}: ${issue}`);
 }
 // Negative control: the geometry checker must actually reject a broken card.
 const control=await send('Runtime.evaluate',{expression:`(()=>{const card=document.querySelector('[data-ui-qa-card-lane] .card-kind-tower');if(!card)return 'NO_TOWER';card.style.setProperty('width','1px','important');return JSON.stringify((${inspectBrowser.toString()})().issues);})()`,returnByValue:true});
 const controlIssues=JSON.parse(control.result?.value||'"[]"');
 if(!Array.isArray(controlIssues)||!controlIssues.some(x=>x.includes('collapsed card')))failures.push('Visual gate self-check did not detect deliberately collapsed card');
 console.log(`UI browser geometry: ${inspected}/${matrix.length} real Chromium layouts checked (${bin}).`);
 if(failures.length){console.error(failures.slice(0,45).join('\n'));if(failures.length>45)console.error(`… and ${failures.length-45} more`);process.exitCode=1}
 else console.log('UI browser geometry: PASS (card proportions, artwork, scrolling, and panel boundaries).');
}catch(err){console.error('UI visual gate error:',err.stack||err);process.exitCode=1}
finally{for(const p of pending.values())p.fail(Error('Browser terminated'));if(ws)ws.close();if(browser){browser.kill('SIGKILL');await delay(350)}if(dir)await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});}

// Runs INSIDE the real browser. Failures represent actual rendered geometry,
// not merely the presence of expected CSS selectors in source text.
function inspectBrowser(){
 const issues=[];
 const rect=el=>el.getBoundingClientRect();
 const ratio=(r)=>r.height/(r.width||1);
 const visible=el=>{const r=rect(el),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
 const shelf=document.querySelector('.tt6-hand-shelf'),panel=document.querySelector('.tt6-workspace'),board=document.querySelector('.tt2-root');
 if(!window.__qaReady?.ok){issues.push('render/fit did not complete');return {issues}}
 const landscape=innerWidth>innerHeight;
 if(landscape){
  if(!visible(shelf))issues.push('landscape hand shelf invisible');
  else if(Math.abs(rect(shelf).width-innerWidth/2)>2)issues.push('hand shelf no longer half-screen width');
  if(!visible(panel))issues.push('landscape action panel invisible');
  else if(Math.abs(rect(panel).left-innerWidth/2)>3)issues.push('action panel is not in right half');
  if(visible(shelf)&&visible(panel)&&rect(shelf).right>rect(panel).left+2)issues.push('hand and action panel overlap');
 }else if(visible(shelf))issues.push('portrait unexpectedly moved hand into landscape shelf');
 if(!visible(board))issues.push('game board invisible');
 const replay=document.querySelector('.tt9-replay-launch'),pause=document.querySelector('.game-menu-trigger');
 if(replay&&pause&&visible(replay)&&visible(pause)){
  const a=rect(replay),b=rect(pause);
  if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)issues.push('Replay and Pause overlap');
 }
 const cards=[...document.querySelectorAll('.game-viewport .card')].filter(visible);
 if(!cards.length)issues.push('no rendered cards found');
 let checked=0;
 for(const card of cards){
  const r=rect(card);
  if(r.width<9)issues.push('collapsed card '+card.className+' width '+r.width.toFixed(2));
  if(r.height<10)issues.push('collapsed card '+card.className+' height '+r.height.toFixed(2));
  if(Math.abs(ratio(r)-1.42)>.23&&r.width>=15)issues.push('distorted card '+card.className+' aspect '+ratio(r).toFixed(2));
  const symbol=card.querySelector(':scope > .symbol');
  if(symbol&&visible(symbol)&&r.width>20){
   const sr=rect(symbol);
   if(sr.width/r.width<.18)issues.push('tiny artwork '+card.className+' ratio '+(sr.width/r.width).toFixed(2));
  }
  if(card.classList.contains('card-kind-tower')&&r.width>23){
   const marks=[...card.querySelectorAll('.tt8-tower-mark .ui-icon')].filter(visible);
   if(!marks.length)issues.push('Tower lost Sun/Moon symbols width='+r.width.toFixed(1)+' marks='+card.querySelectorAll('.tt8-tower-mark').length+' inspect='+card.getAttribute('aria-label')+' loc='+card.parentElement?.className);
   else if(marks.some(mark=>rect(mark).width/r.width<.07))issues.push('Tower edge symbol disproportionately small width='+r.width.toFixed(1)+' icon='+Math.min(...marks.map(mark=>rect(mark).width)).toFixed(1)+' label='+card.getAttribute('aria-label')+' loc='+card.parentElement?.className);
  }
  checked++;
 }
 // The production reorder lane must remain scrollable when its content exceeds its width.
 const lane=document.querySelector('[data-ui-qa-card-lane]');
 if(!lane)issues.push('card-selection lane missing');
 else if(lane.scrollWidth>lane.clientWidth+3){
  const overflow=getComputedStyle(lane).overflowX;
  if(!['auto','scroll'].includes(overflow))issues.push('crowded card-selection lane clips instead of scrolling ('+overflow+')');
 }
 const denizens=[...document.querySelectorAll('.tt35-denizen-lane .card,.tt17-denizen-cards .card')].filter(visible);
 for(const d of denizens){if(rect(d).width<21)issues.push('collapsed Denizen width '+rect(d).width.toFixed(1));}
 return {issues:[...new Set(issues)],checked};
}
