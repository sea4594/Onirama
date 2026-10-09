/** Phase 8 reproducible fixtures use the actual engine and shipped renderers. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {newGame,viewFor,act} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderGameDialog} from '../public/tabletop/dialogs.js';
const dir=new URL('../docs/ui-phase8-baselines/',import.meta.url);mkdirSync(dir,{recursive:true});
const groups={base:[],four:['book','glyphs','dreamcatchers','towers'],all:['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'],hard:['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'],incubus:['incubus']};
const variants={hard:{book:'hard',dreamcatchers:'hard',towers:'hard',premonitions:'extreme',crossroads:'hard',mirrors:'hard'},incubus:{incubus:'true'}};
const styles=['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css','game-shell.css','theme.css','tabletop/responsive.css'];
const css=styles.map(s=>`<link rel="stylesheet" href="../../public/${s}">`).join('');
const html=(body,state=null,seat=0)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body><main class="page">${body}</main>${state?`<script type="application/json" id="qa-state">${JSON.stringify({state,seat}).replaceAll('<','\\u003c')}</script>`:''}</body></html>`;
for(const [variant,expansions] of Object.entries(groups))for(const mode of ['solo','coop']){
 const config={expansions,difficulties:variants[variant]||{}};
 let g=newGame({mode,seed:201+Object.keys(groups).indexOf(variant),config});
 if(mode==='coop')for(let i=0;i<12&&g.phase==='draft';i++)g=act(g,{type:'draft',id:g.draft[0].id});
 for(const seat of mode==='coop'?[0,1]:[0]){
  const state=viewFor(g,seat);const board=mode==='solo'?renderSoloTabletop(state):renderCooperativeTabletop(state,{seat});
  writeFileSync(new URL(`${mode}-${variant}-seat${seat}.html`,dir),html(board,state,seat));
 }
}
// Refinement Phase 4: additional visual states that stress the layout allocator.
for(const seat of [0,1]){
 const draftGame=newGame({mode:'coop',seed:311,config:{expansions:groups.all}});
 const draftState=viewFor(draftGame,seat);
 writeFileSync(new URL(`coop-all-draft-seat${seat}.html`,dir),html(renderCooperativeTabletop(draftState,{seat}),draftState,seat));
}
for(const mode of ['solo','coop']){
 let g=newGame({mode,seed:411,config:{expansions:groups.all}});
 if(mode==='coop')for(let i=0;i<12&&g.phase==='draft';i++)g=act(g,{type:'draft',id:g.draft[0].id});
 const state=viewFor(g,0);
 for(const p of state.players){const template=p.hand.find(c=>c.kind==='location')||{kind:'location',color:'red',symbol:'moon'};
  p.labyrinth=Array.from({length:45},(_,i)=>({...template,id:`layout-only-${i}`}));}
 const markup=mode==='solo'?renderSoloTabletop(state):renderCooperativeTabletop(state,{seat:0});
 writeFileSync(new URL(`${mode}-all-longlab-seat0.html`,dir),html(markup,state,0));
}
const pending={
 nightmare:{type:'nightmare',card:{kind:'nightmare',id:'nightmare-QA'}},
 prophecy:{type:'prophecy'},doorSearch:{type:'doorSearch'},sphinxName:{type:'sphinxName'},
 mirrorReward:{type:'mirrorReward'},incantation:{type:'incantation'},towerPenalty:{type:'towerPenalty'},
 confusion:{type:'confusion'},catchChoose:{type:'catchChoose'},premonitionPick:{type:'premonitionPick'}
};
for(const [type] of Object.entries(pending)){
 const g=viewFor(newGame({mode:'solo',seed:666,config:{expansions:groups.all}}),0),board=renderSoloTabletop(g),cards=g.players[0].hand;
 const controls=type==='nightmare'?'<div class="decision"><h2>Nightmare</h2><p>Select a penalty</p><div class="actions"><button>Discard Key</button><button>Lose Door</button><button>Reveal five</button><button>Discard hand</button></div></div>':`<div class="decision"><h2>${type}</h2><div class="tt4-card-choices">${cards.map(c=>`<button class="tt4-card-option"><span class="card">${c.color} ${c.symbol}</span></button>`).join('')}</div><div class="actions"><button>Confirm</button></div></div>`;
 const popup=renderGameDialog({type,key:type,mandatory:true,html:controls});
 writeFileSync(new URL(`dialog-${type}.html`,dir),html(board+popup));
}
console.log('Created',Object.keys(groups).length*3+Object.keys(pending).length,'game and decision fixtures.');
