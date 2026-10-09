// Offline visual fixture using the real Phase 4 dialog wrapper and Phase 3 board.
// It does not simulate a separate rules engine or require a network browser.
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,viewFor} from '../engine/game.js';
import {renderCard,renderDoors} from '../public/tabletop/cards.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderGameDialog,decisionDialogKey} from '../public/tabletop/dialogs.js';
import * as guest from '../public/guest-data.js';
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const g=viewFor(newGame({mode:'solo',seed:891,config:{expansions:all,difficulties:{}}}),0);
const c=g.players[0].hand[0],d={kind:'door',id:'dreamdoor',color:'green'};
const variants={
 prophecy:{type:'prophecy',cards:[...g.players[0].hand]},
 nightmare:{type:'nightmare',card:{kind:'nightmare',id:'bad-dream'}},
 doorSearch:{type:'doorSearch',color:'green',targets:[{id:'dreamdoor',source:'deck'}]},
 confusion:{type:'confusion'},
 happyPeek:{type:'happyPeek',cards:[...g.players[0].hand]},
 mirrorReward:{type:'mirrorReward',mirror:'blue',options:[...g.players[0].hand]},
 incantation:{type:'incantation',cards:[c,d]},
 towerPenalty:{type:'towerPenalty'},
};
const name=process.argv[2]||'prophecy',p=variants[name]||variants.prophecy;g.phase='decision';g.pending=p;
const storage=new Map(),app={innerHTML:'',addEventListener(){},querySelector(){return null}},document={documentElement:{dataset:{}},querySelector:s=>s==='#app'?app:null};
const ctx=vm.createContext({document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{origin:'http://localhost',hostname:'localhost',hash:'#/'},addEventListener(){},navigator:{},confirm:()=>false,console,renderCard,renderDoors,renderSoloTabletop,renderGameDialog,decisionDialogKey,applyTabletopMetrics(){},...guest,firebase:{firebaseConfigured:()=>false}});
vm.runInContext(readFileSync('public/app.js','utf8').replace(/^import [^\n]+$/gm,''),ctx);
ctx.game=g;
const html=vm.runInContext('decision(game,true)',ctx);
const popup=renderGameDialog({type:p.type,key:decisionDialogKey(g,0),html,mandatory:true});
const css=['public/styles.css','public/tabletop/tokens.css','public/tabletop/layout.css','public/tabletop/solo.css','public/tabletop/interactions.css','public/tabletop/dialogs.css'].map(p=>readFileSync(p,'utf8')).join('\n');
const result=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header class="nav"><a class="brand">ONIRAMA</a></header><div class="page">${renderSoloTabletop(viewFor(newGame({mode:'solo',seed:71,config:{expansions:[],difficulties:{}}}),0))}</div>${popup}</body></html>`;
writeFileSync(process.argv[3]||'/mnt/data/onirama-phase4-dialog.html',result);console.log(name,result.length);
