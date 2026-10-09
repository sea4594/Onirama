import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderCard,renderDoors} from '../public/tabletop/cards.js';
import {applyTabletopMetrics} from '../public/tabletop/layout.js';
import * as guest from '../public/guest-data.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import [^\n]+$/gm,'');
const dir=new URL('../docs/ui-phase7-baselines/',import.meta.url);mkdirSync(dir,{recursive:true});
const screens=['home','multiplayer','setup','settings','history','tutorial','join','lobby','rules'];
const styles=['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css'].map(file=>`<link rel="stylesheet" href="../../public/${file}">`).join('');
for(const screen of screens){
 const stored=new Map(),app={innerHTML:'',addEventListener(){}},loc={origin:'http://localhost',hostname:'localhost',pathname:'/',search:'',hash:screen==='home'?'#/':'#/'+screen};
 const storage={getItem:key=>stored.get(key)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 const docEl={dataset:{}};const ctx=vm.createContext({document:{documentElement:docEl,querySelector:q=>q==='#app'?app:null},location:loc,localStorage:storage,window:{ONIRAMA_BUILD_COMMIT:'7'.repeat(40)},addEventListener(){},console,navigator:{},confirm:()=>true,renderCard,renderDoors,applyTabletopMetrics,...guest,firebase:{firebaseConfigured:()=>false}});
 vm.runInContext(source,ctx);
 if(screen==='lobby'){loc.hash='#/game';ctx.mockRoom={id:'abc',code:'AB12CD34',connected:[true,true],ready:[true,false],seat:0,host:true,started:false};vm.runInContext('state={room:mockRoom,version:1};session={id:"abc",seat:0};render()',ctx);}
 if(screen==='setup')vm.runInContext(`selectedExpansions=new Set(['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']);selectedDifficulties={book:'hard',premonitions:'extreme',mirrors:'hard'};render()`,ctx);
 writeFileSync(new URL(`${screen}.html`,dir),`<!doctype html><html lang="en" data-theme="${docEl.dataset.theme}" data-mode="${docEl.dataset.mode}" data-motion="${docEl.dataset.motion}" data-card-size="${docEl.dataset.cardSize}" data-contrast="${docEl.dataset.contrast}" data-text-size="${docEl.dataset.textSize}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><div id="app">${app.innerHTML}</div></body></html>`);
}
console.log('Generated',screens.length,'Phase 7 route fixtures');
