const app=document.querySelector('#app');
const base=location.origin;
const COLOR=['red','blue','green','brown'];
const SYM={sun:'☀',moon:'☾',key:'⚿',nightmare:'✦',door:'◈',hidden:'◈'};
const EXP=[['Book of Steps','P4'],['Glyphs','P4'],['Dreamcatchers','P4'],['Towers','P4'],['Happy Dreams / Premonitions','P5'],['Crossroads / Dead Ends','P5'],['Door to the Oniverse','P5'],['Mirrors (promo)','P6'],['Sphinx / Diver / Confusion','P6'],['Little Incubus','P6']];
let session=JSON.parse(localStorage.getItem('onirama.session')||'null');
const THEME_PRESETS=[{id:'ocean-light',name:'Ocean · Light',theme:'ocean',mode:'light'},{id:'ocean-dark',name:'Ocean · Dark',theme:'ocean',mode:'dark'},{id:'light',name:'Light',theme:'bw',mode:'light'},{id:'dark',name:'Dark',theme:'bw',mode:'dark'},{id:'forest',name:'Forest',theme:'forest',mode:'light'},{id:'forest-dark',name:'Forest · Dark',theme:'forest',mode:'dark'},{id:'clay',name:'Clay',theme:'clay',mode:'light'},{id:'clay-dark',name:'Clay · Dark',theme:'clay',mode:'dark'},{id:'berry',name:'Berry',theme:'berry',mode:'light'},{id:'berry-dark',name:'Berry · Dark',theme:'berry',mode:'dark'}];
const SETTINGS_KEY='onirama.ui.settings.v1';
function readSettings(){try{const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return {theme:THEME_PRESETS.some(p=>p.id===raw.theme)?raw.theme:'ocean-light',motion:raw.motion==='reduced'?'reduced':'normal',cardSize:raw.cardSize==='large'?'large':'normal'};}catch{return {theme:'ocean-light',motion:'normal',cardSize:'normal'};}}
let uiSettings=readSettings();
function applySettings(){const preset=THEME_PRESETS.find(p=>p.id===uiSettings.theme)||THEME_PRESETS[0];Object.assign(document.documentElement.dataset,{theme:preset.theme,mode:preset.mode,motion:uiSettings.motion,cardSize:uiSettings.cardSize});}
applySettings();
let state=null,selected=null,error='',busy=false,online=false,streamAbort=null,version=0,selectedMode='solo',page=location.hash||'#/';
const escape=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(arr)=>Array.isArray(arr)?arr.length:0;
const btn=(label,action,klass='')=>`<button type="button" class="${klass}" data-action="${action}">${label}</button>`;
const card=(c,{select=false,tiny=false,dim=false}={})=>{
  const symbol=c.kind==='location'?SYM[c.symbol]:(SYM[c.kind]||'◈');
  const text=c.kind==='location'?`${c.color} ${c.symbol}`:c.kind==='door'?`${c.color} Door`:c.kind==='hidden'?'Hidden':c.kind;
  const classes=`card ${c.color||c.kind}${tiny?' tiny':''}${selected===c.id?' selected':''}`;
  return select?`<button class="${classes}" aria-pressed="${selected===c.id}" title="${escape(text)}" data-pick="${escape(c.id)}" ${dim?'disabled':''}><span class="symbol">${symbol}</span><span class="card-label">${escape(text)}</span></button>`:`<div class="${classes}" title="${escape(text)}" aria-label="${escape(text)}"><span class="symbol">${symbol}</span><span class="card-label">${escape(text)}</span></div>`;
};
function nav(){return `<header class="nav"><a class="brand" href="#/">ONIRAMA</a><div class="nav-right"><a href="#/rules">Rules</a><a href="#/roadmap">Roadmap</a><a href="#/settings" aria-label="Settings">⚙</a></div></header>`;}
function bottomNav(){if(page==='#/game')return '';const entries=[['#/','Single Player','◈'],['#/multiplayer','Multiplayer','♧'],['#/settings','Settings','⚙']];const active=page==='#/multiplayer'||page==='#/join'?'#/multiplayer':page==='#/settings'?'#/settings':'#/';return `<nav class="bottom-nav" aria-label="Primary">${entries.map(([url,label,icon])=>`<a href="${url}" class="bottom-nav-item${active===url?' active':''}" ${active===url?'aria-current="page"':''}><span aria-hidden="true" class="bottom-icon">${icon}</span><span>${label}</span></a>`).join('')}</nav>`;}
function setRoute(path){location.hash=path;page=path;render();}
function setError(msg){error=msg;render();}
async function api(route,method='GET',body=null){
  const headers={'Content-Type':'application/json'};if(session?.token)headers.Authorization=`Bearer ${session.token}`;
  const res=await fetch(`${base}${route}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();
  if(!res.ok)throw Error(data.error||'Request failed');return data;
}
async function refresh(){if(!session)return;try{const data=await api(`/api/rooms/${session.id}/state`);state=data;version=data.version;error='';render();}catch(e){setError(e.message);}}
function saveSession(o){session={id:o.room.id,token:o.token,seat:o.room.seat};localStorage.setItem('onirama.session',JSON.stringify(session));}
async function create(mode){
  const name=(document.querySelector('#name')?.value||'Dreamwalker').trim();busy=true;render();
  try{const o=await api(mode==='solo'?'/api/solo':'/api/rooms','POST',{name,config:{ruleset:'official',expansions:[],difficulties:{}}});saveSession(o);await refresh();setRoute('#/game');startStream();}
  catch(e){setError(e.message);}finally{busy=false;render();}
}
async function join(){const code=document.querySelector('#roomcode')?.value;const name=(document.querySelector('#joinname')?.value||'Partner').trim();
  if(!code)return setError('Enter the six-to-eight-character room code.');
  try{const o=await api('/api/join','POST',{code,name});saveSession(o);await refresh();setRoute('#/game');startStream();}catch(e){setError(e.message);}
}
async function doRoom(operation,body={}){if(busy)return;busy=true;try{await api(`/api/rooms/${session.id}/${operation}`,'POST',body);await refresh();}catch(e){setError(e.message);}finally{busy=false;render();}}
async function action(command){if(busy)return;busy=true;render();try{await api(`/api/rooms/${session.id}/action`,'POST',{expectedVersion:version,command});selected=null;await refresh();}catch(e){setError(e.message);await refresh();}finally{busy=false;render();}}
async function startStream(){
  streamAbort?.abort();if(!session)return;const controller=new AbortController();streamAbort=controller;online=false;render();
  try{
    const response=await fetch(`/api/rooms/${session.id}/stream`,{headers:{Authorization:`Bearer ${session.token}`},signal:controller.signal});
    if(!response.ok)throw Error('Disconnected');const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';online=true;render();
    while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const chunks=buffer.split('\n\n');buffer=chunks.pop()||'';
      for(const chunk of chunks){const line=chunk.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;try{
        const incoming=JSON.parse(line.slice(6));state={...state,...incoming};
        // Version is refreshed after every notification to prevent stale submissions.
        const fresh=await api(`/api/rooms/${session.id}/state`);state=fresh;version=fresh.version;render();
      }catch{}}
    }
  }catch(e){if(e.name!=='AbortError'){online=false;render();}}
  finally{if(!controller.signal.aborted){online=false;render();setTimeout(()=>{if(session?.id)startStream();},2500);}}
}
function home(){return `<div class="route home-screen stack"><div class="title-row"><h1>Single Player</h1><span class="chip">Base game</span></div><section class="panel stack"><div class="eyebrow">The doors are waiting</div><p>Find eight Doors before the dream runs out. One player, five cards, and an ever-changing Labyrinth.</p><label for="name">Your display name</label><input id="name" class="inline-input" maxlength="40" value="Dreamwalker" autocomplete="nickname"><div class="actions">${btn('Start solo game','soloStart','primary')}${session?btn('Resume current game','resume'):''}</div></section><section class="panel stack"><h2 class="section-title">Expansions</h2><div class="expansion-list">${EXP.map(([name,phase])=>`<div class="expansion-row"><span>${escape(name)}</span><span class="chip">Phase ${phase.slice(1)}</span></div>`).join('')}</div><p class="muted small">Upcoming expansions cannot be activated until their rules are tested. Your game always uses official base rules.</p></section></div>`;}
function multiplayer(){return `<div class="route stack"><div class="title-row"><h1>Multiplayer</h1><span class="chip">2-player cooperative</span></div><section class="panel stack"><div class="eyebrow">Host a game</div><p>Start a private room and share the 8-character invite code. Each player has their own hand and Labyrinth; two cards are shared.</p><label for="name">Your display name</label><input id="name" class="inline-input" maxlength="40" value="Dreamwalker" autocomplete="nickname"><div class="actions">${btn('Create room','coopStart','primary')}${session?btn('Resume current room','resume'):''}</div></section><section class="panel stack"><div class="eyebrow">Join with a code</div><label for="roomcode">Invitation code</label><input id="roomcode" class="inline-input" placeholder="A1B2C3D4" maxlength="8" autocomplete="off"><label for="joinname">Your display name</label><input id="joinname" class="inline-input" value="Partner" maxlength="40">${btn('Join room','join','primary')}</section></div>`;}
function settings(){return `<div class="route stack"><div class="title-row"><h1>Settings</h1><span class="chip">Stored on this device</span></div><section class="panel stack"><h2 class="section-title">Appearance</h2><label for="themeChoice">Theme</label><select class="inline-input" id="themeChoice" data-setting="theme">${THEME_PRESETS.map(t=>`<option value="${t.id}" ${uiSettings.theme===t.id?'selected':''}>${escape(t.name)}</option>`).join('')}</select><label for="motionChoice">Animations</label><select class="inline-input" id="motionChoice" data-setting="motion"><option value="normal" ${uiSettings.motion==='normal'?'selected':''}>Normal</option><option value="reduced" ${uiSettings.motion==='reduced'?'selected':''}>Reduced motion</option></select><label for="cardSizeChoice">Card size</label><select class="inline-input" id="cardSizeChoice" data-setting="cardSize"><option value="normal" ${uiSettings.cardSize==='normal'?'selected':''}>Standard</option><option value="large" ${uiSettings.cardSize==='large'?'selected':''}>Large</option></select></section><section class="panel stack"><h2 class="section-title">Gameplay and privacy</h2><p class="muted small">No login required. The current room is saved in this browser; game sessions are stored by the game server. A user account would only be useful later for cross-device saves, optional friends, and shared statistics.</p><div class="actions">${session?btn('Resume current game','resume','primary'):''}${btn('How to play','rules')}${btn('Development roadmap','roadmap')}</div></section></div>`;}
function setup(){return `<div class="route"><div class="title-row"><h1>New dream</h1><span class="chip">Base rules · 76 cards</span></div><div class="panel stack"><div class="eyebrow">Choose your mode</div><div class="grid"><button class="${selectedMode==='solo'?'primary':''}" data-action="chooseSolo">◈ Solo</button><button class="${selectedMode==='coop'?'primary':''}" data-action="chooseCoop">◈ Two-player cooperative</button></div><label for="name" class="small">Your display name</label><input class="inline-input" id="name" value="Dreamwalker" maxlength="40" autocomplete="nickname"><div class="eyebrow">Expansions</div><div class="grid">${EXP.map(([name,phase])=>`<label class="muted small" title="Not yet implemented"><input type="checkbox" disabled> ${escape(name)} <span class="micro">(${phase})</span></label>`).join('')}</div><p class="notice">Expansion options are disabled until their rules and interactions have been implemented and verified. Choosing them now would create incorrect games.</p>${btn(`Start ${selectedMode==='solo'?'solo game':'cooperative room'}`,'create','primary')}</div></div>`;}
function joinPage(){return `<div class="route"><h1 class="section-title">Join a dream</h1><div class="panel stack"><label for="roomcode">Room code</label><input id="roomcode" class="inline-input" placeholder="A1B2C3D4" maxlength="8" autocomplete="off"><label for="joinname">Your display name</label><input id="joinname" class="inline-input" value="Partner" maxlength="40">${btn('Join room','join','primary')}</div></div>`;}
function lobby(room){return `<div class="route stack"><div class="title-row"><h1>Cooperative room</h1><span class="chip">Invite-only</span></div><div class="panel stack"><div class="eyebrow">Invite your partner</div><div class="code">${escape(room.code)}</div><p class="muted small">Share this code. Both players must join and mark themselves ready.</p><div class="grid"><div class="panel"><strong>Player 1 ${room.connected[0]?'✓':'—'}</strong><p class="muted small">${room.ready[0]?'Ready':'Not ready'}</p></div><div class="panel"><strong>Player 2 ${room.connected[1]?'✓':'—'}</strong><p class="muted small">${room.ready[1]?'Ready':'Waiting to join'}</p></div></div><div class="actions">${btn(room.ready[room.seat]?'Unready':'I’m ready','ready','primary')}${room.host?btn('Start cooperative game','start',room.ready.every(Boolean)&&room.connected[1]?'primary':''):''}${btn('Copy room code','copyCode')}</div><p class="muted small">Game starts with an eight-card public draft: three personal cards per player, two shared cards.</p></div></div>`;}
function doors(p){return `<div class="door-spots">${COLOR.map(color=>`<div class="door-group"><div class="eyebrow">${color}</div><div class="cards">${p.doors.filter(x=>x.color===color).map(x=>card(x,{tiny:true})).join('')||'<div class="door-slot">◇</div>'}</div></div>`).join('')}</div>`;}
function decision(g,canAct){
  if(g.phase!=='decision')return '';
  if(!canAct)return `<div class="notice">Your partner is resolving a card effect.</div>`;
  const p=g.pending;if(!p)return '';
  if(p.type==='doorSearch')return `<section class="decision stack"><h2>A Door awaits</h2><p>Three consecutive ${p.color} Locations! Search the deck for a ${p.color} Door, or skip the search.</p><div class="actions">${btn('Claim Door','doorSearch:claim','primary')}${btn('Skip','doorSearch:skip')}</div></section>`;
  if(p.type==='door')return `<section class="decision stack"><h2>Oneiric Door</h2><p>A ${p.card.color} Door appeared. Spend a matching Key to claim it, or put the Door into Limbo.</p><div class="actions">${p.keys.map(k=>btn(`Use ${k.zone} Key` ,`useKey:${k.id}`,'primary')).join('')}${btn('Send to Limbo','useKey:limbo')}</div></section>`;
  if(p.type==='nightmare'){
    const keys=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])].filter(c=>c.symbol==='key');
    const ds=g.players[g.active].doors;
    return `<section class="decision stack"><h2>A Nightmare</h2><p>Choose one of the four official penalties. Unavailable resources cannot be sacrificed.</p><div class="stack">${keys.length?`<div class="small">Discard a Key: <div class="actions">${keys.map(k=>btn(`${k.color} Key`,`nightKey:${k.id}`)).join('')}</div></div>`:''}${ds.length?`<div class="small">Lose a Door: <div class="actions">${ds.map(d=>btn(`${d.color} Door`,`nightDoor:${d.id}`)).join('')}</div></div>`:''}<div class="actions">${btn('Reveal up to 5 cards','nightReveal')}${btn('Discard and replace entire hand','nightHand','danger')}</div></div></section>`;
  }
  if(p.type==='prophecy')return prophecy(g);
  return `<div class="notice">Resolving an effect.</div>`;
}
let prophecyDiscard=null,prophecyOrder=[];
function prophecy(g){const cards=g.pending.cards;if(!cards)return '';
  if(!cards.some(c=>c.id===prophecyDiscard)){prophecyDiscard=null;prophecyOrder=cards.map(c=>c.id);}
  if(prophecyOrder.length!==cards.length||prophecyOrder.some(id=>!cards.some(c=>c.id===id)))prophecyOrder=cards.map(c=>c.id);
  return `<section class="decision stack"><h2>Prophecy</h2><p>Choose exactly one card to discard. Reorder the others from top to bottom, then confirm.</p><div class="cards">${prophecyOrder.map((id,index)=>{const c=cards.find(x=>x.id===id);return `<div class="stack" style="align-items:center">${card(c,{tiny:false})}${btn(prophecyDiscard===id?'✓ Discard':'Discard',`prophecyDiscard:${id}`,'mini')}${btn('↑',`prophecyUp:${id}`,'mini')}${btn('↓',`prophecyDown:${id}`,'mini')}</div>`;}).join('')}</div><div class="muted small">Leftmost card will be drawn first.</div>${btn('Confirm Prophecy','prophecyConfirm',prophecyDiscard?'primary':'')}</section>`;
}
function board(g,room){
  const canAct=room.seat===g.active,player=g.players[g.active],my=g.players[room.seat],isDraft=g.phase==='draft';
  let help=g.status==='won'?'Victory — all eight Doors have been found!':g.status==='lost'?'Defeat — the deck was exhausted.':isDraft?'Select a Location from the public draft.':canAct?'Choose one of your available Locations to play or discard.':`Waiting for ${escape(player.name)}.`;
  const mine=g.mode==='solo'?player:my;
  const selections=[...mine.hand,...(g.mode==='coop'?g.shared:[])];const chosen=selections.find(c=>c.id===selected);
  return `<div class="title-row"><h1>${g.mode==='solo'?'Solo labyrinth':'Cooperative labyrinth'}</h1><div class="status"><span class="dot ${online?'':'off'}"></span> ${online?'Connected':'Connecting'} · Turn ${g.turn} · ${g.deckCount} in deck</div></div><div class="game-layout"><main class="board-main"><div class="notice">${help}</div>${g.status!=='active'?`<div class="panel"><h2 class="section-title">${g.status==='won'?'Dream escaped':'The dream ends'}</h2><p>${escape(g.log.at(-1)||'')}</p>${btn('New game','setup','primary')}</div>`:''}
  ${isDraft?`<div class="panel"><div class="section-label">Public draft · ${escape(player.name)} chooses</div><div class="cards">${g.draft.map(c=>card(c,{select:canAct})).join('')}</div><p class="muted small">Each player chooses three cards, alternating turns. The remaining two become shared resources.</p></div>`:''}
  <div class="panel"><div class="row"><div class="section-label">Collected Doors</div><span class="chip">${g.players.reduce((n,p)=>n+p.doors.length,0)}/8</span></div>${g.players.map(p=>`<div class="stack"><strong class="small">${escape(p.name)}</strong>${doors(p)}</div>`).join('')}</div>
  <div class="panel"><div class="section-label">${escape(player.name)}’s Labyrinth</div><div class="cards">${player.labyrinth.slice(-18).map(c=>card(c,{tiny:true})).join('')||'<span class="muted small">No Locations played yet</span>'}</div><p class="muted micro">The last card controls which symbol can be played next. Three consecutive matching colors unlock a Door.</p></div>
  ${g.mode==='coop'?`<div class="panel"><div class="section-label">Partner Labyrinth</div><div class="cards">${g.players[1-g.active].labyrinth.slice(-18).map(c=>card(c,{tiny:true})).join('')||'<span class="muted small">Empty</span>'}</div></div>`:''}
  ${decision(g,canAct)}
  <div class="panel"><div class="row"><div class="section-label">Your personal cards</div><span class="muted micro">${count(mine.hand)} cards</span></div><div class="cards">${mine.hand.map(c=>card(c,{select:canAct&&g.phase==='action'})).join('')}</div>${g.mode==='coop'?`<div class="section-label" style="margin-top:24px">Shared resources</div><div class="cards">${g.shared.map(c=>card(c,{select:canAct&&g.phase==='action'})).join('')}</div>`:''}${canAct&&g.phase==='action'?`<div class="actions spaced">${btn('Play selected','play',chosen&&chosen.symbol!==player.labyrinth.at(-1)?.symbol?'primary':'')}${btn('Discard selected','discard',chosen?'':'ghost')}${g.mode==='coop'?'<span class="muted micro">Optional swap available after discarding</span>':''}</div>`:''}</div></main>
  <aside class="board-side"><div class="panel"><div class="section-label">Dream status</div><div class="stack"><div class="row"><span>Draw pile</span><strong>${g.deckCount}</strong></div><div class="row"><span>Discard</span><strong>${g.discard.length}</strong></div><div class="row"><span>Limbo</span><strong>${g.limbo.length}</strong></div><div class="row"><span>Turn owner</span><strong>${escape(player.name)}</strong></div></div></div><div class="panel"><div class="section-label">Discard pile</div><div class="cards">${g.discard.slice(-5).map(c=>card(c,{tiny:true})).join('')||'<span class="muted small">Empty</span>'}</div></div><div class="panel"><div class="section-label">Action history</div><div class="log">${g.log.slice(-35).reverse().map(msg=>`<div>${escape(msg)}</div>`).join('')}</div></div><div class="panel"><div class="section-label">Rules</div><p class="muted small">Base rules active. All expansion choices are disabled until implemented.</p>${btn('View rules','rules','mini')}</div></aside></div>`;
}
function rules(){return `<article class="route panel prose"><div class="eyebrow">How to play</div><h1 class="section-title">The base game</h1><p>Find all eight Doors before the deck runs out. Solo players collect two Doors of each of four colors. In cooperative play, each player must collect one Door of each color.</p><h2>Each turn</h2><ol><li><strong>Play or discard</strong> one Location. Played Locations must not have the same symbol as the previous Labyrinth card. The third consecutive played Location of a color unlocks one matching Door from the deck; the fourth starts a new sequence.</li><li><strong>Refill</strong> your personal resources to five (or three personal plus two shared in cooperative play). Doors drawn can be claimed with a matching Key from your resources; otherwise they enter Limbo. Nightmares must be resolved immediately.</li><li><strong>Shuffle Limbo</strong> back into the deck at the end of the turn.</li></ol><h2>Keys and Prophecy</h2><p>Discarding a Key lets you inspect the top five cards, discard exactly one, and rearrange the remaining cards on top of the deck.</p><h2>Nightmare penalties</h2><ol><li>Discard a Key.</li><li>Return an acquired Door to Limbo.</li><li>Reveal up to five cards, discarding Locations and placing Dreams/Doors in Limbo.</li><li>Discard and rebuild the entire hand, setting aside Dreams and Doors without resolving them.</li></ol><h2>Cooperative play</h2><p>After revealing eight Locations, players alternately draft three personal cards each; the last two become shared resources. You may play or discard a card from your personal or shared resources on your own turn. You can swap one personal card with one shared card after discarding. Each player has their own Labyrinth and Doors.</p><h2>References</h2><p><a href="https://www.rulespal.com/onirim/rulebook" target="_blank" rel="noopener noreferrer">Onirim Second Edition rules</a></p><p class="notice">This is an original visual implementation and is not affiliated with the game's publisher. Standard expansion support is under development.</p></article>`;}
function roadmap(){const items=[['0','Repository & CI','Implemented'],['1','Base solo engine & interface','Implemented'],['2','Two-player cooperative rooms','Implemented foundation'],['3','Expansion framework and three-tab UI','Implemented foundation'],['4','Book of Steps, Glyphs, Dreamcatchers, Towers','Planned'],['5','Premonitions, Crossroads, Oniverse Door','Planned'],['6','Promo sets, Little Incubus & variants','Planned'],['7','All combination/edge-case verification','Planned'],['8','Accounts, statistics, tutorials, accessibility','Planned'],['9','Production release and security hardening','Planned']];return `<div class="route"><div class="title-row"><h1>Development phases</h1><span class="chip">Living plan</span></div><div class="stack">${items.map(([num,name,status])=>`<div class="panel row"><div><span class="eyebrow">Phase ${num}</span><h2 style="margin:5px 0;font-size:1.1rem">${escape(name)}</h2></div><span class="chip">${escape(status)}</span></div>`).join('')}</div></div>`;}
function render(){page=location.hash||'#/';let content;
  if(page==='#/setup')content=setup();else if(page==='#/join')content=joinPage();else if(page==='#/rules')content=rules();else if(page==='#/roadmap')content=roadmap();else if(page==='#/multiplayer')content=multiplayer();else if(page==='#/settings')content=settings();else if(page==='#/game')content=!state?'<div class="loading">Loading the dream…</div>':state.room.started?board(state.game,state.room):lobby(state.room);else content=home();
  app.innerHTML=nav()+`<div class="page">${error?`<div class="notice error" role="alert">${escape(error)} <button class="mini ghost" data-action="clearError">Dismiss</button></div>`:''}${content}</div>`+bottomNav();
}
function pick(id){selected=selected===id?null:id;render();}
function moveProphecy(id,dir){let i=prophecyOrder.indexOf(id),j=i+dir;if(j<0||j>=prophecyOrder.length)return;[prophecyOrder[i],prophecyOrder[j]]=[prophecyOrder[j],prophecyOrder[i]];render();}
async function handle(actionName){
  if(actionName==='soloStart'){selectedMode='solo';return create('solo');}if(actionName==='coopStart'){selectedMode='coop';return create('coop');}
  if(actionName==='setup')return setRoute('#/setup');if(actionName==='roadmap')return setRoute('#/roadmap');if(actionName==='rules')return setRoute('#/rules');if(actionName==='joinPage')return setRoute('#/join');
  if(actionName==='solo'||actionName==='coop'){selectedMode=actionName;return setRoute('#/setup');}
  if(actionName==='chooseSolo'||actionName==='chooseCoop'){selectedMode=actionName==='chooseSolo'?'solo':'coop';return render();}
  if(actionName==='create')return create(selectedMode);if(actionName==='join')return join();
  if(actionName==='resume'){await refresh();setRoute('#/game');return startStream();}
  if(actionName==='ready')return doRoom('ready',{ready:!state.room.ready[session.seat]});
  if(actionName==='start')return doRoom('start');
  if(actionName==='copyCode'){await navigator.clipboard?.writeText(state.room.code);return;}
  if(actionName==='clearError'){error='';return render();}
  if(!state?.game)return;
  const g=state.game;if(state.room.seat!==g.active)return;
  if(g.phase==='draft'&&actionName.startsWith('draft:'))return action({type:'draft',id:actionName.slice(6)});
  if(actionName==='play'||actionName==='discard'){
    if(!selected)return setError('Select a card first.');
    const c=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])].find(x=>x.id===selected);
    if(!c)return setError('Selected card is not available.');
    if(actionName==='play'&&g.players[g.active].labyrinth.at(-1)?.symbol===c.symbol)return setError('The next Location needs a different symbol.');
    const command={type:actionName,id:selected};
    if(actionName==='discard'&&g.mode==='coop'){
      const want=confirm('After discarding, swap one of your personal cards with one shared card? (Cancel = discard without swapping)');
      if(want){const personals=g.players[g.active].hand.filter(x=>x.id!==selected),shared=g.shared.filter(x=>x.id!==selected);
        if(personals.length&&shared.length){const personal=prompt('Personal card to swap (enter card number):\n'+personals.map((x,i)=>`${i+1}. ${x.color} ${x.symbol}`).join('\n'),'1');
          const sh=prompt('Shared card to swap (enter card number):\n'+shared.map((x,i)=>`${i+1}. ${x.color} ${x.symbol}`).join('\n'),'1');
          const p=personals[Number(personal)-1],q=shared[Number(sh)-1];if(!p||!q)return setError('Swap cancelled. Discard has not been submitted.');command.swapWith={personal:p.id,shared:q.id};
        }
      }
    }
    return action(command);
  }
  if(actionName.startsWith('doorSearch:'))return action({type:'doorSearch',option:actionName.slice(11)});
  if(actionName.startsWith('useKey:'))return action({type:'chooseDoor',keyId:actionName.slice(7)});
  if(actionName.startsWith('nightKey:'))return action({type:'nightmare',option:'key',cardId:actionName.slice(9)});
  if(actionName.startsWith('nightDoor:'))return action({type:'nightmare',option:'door',cardId:actionName.slice(10)});
  if(actionName==='nightReveal')return action({type:'nightmare',option:'reveal'});
  if(actionName==='nightHand')return action({type:'nightmare',option:'hand'});
  if(actionName.startsWith('prophecyDiscard:')){prophecyDiscard=actionName.slice(16);return render();}
  if(actionName.startsWith('prophecyUp:'))return moveProphecy(actionName.slice(11),-1);
  if(actionName.startsWith('prophecyDown:'))return moveProphecy(actionName.slice(13),1);
  if(actionName==='prophecyConfirm'){if(!prophecyDiscard)return setError('Choose one card to discard.');return action({type:'prophecy',discardId:prophecyDiscard,order:prophecyOrder.filter(id=>id!==prophecyDiscard)});}
}
app.addEventListener('change',e=>{const key=e.target?.dataset?.setting;if(!['theme','motion','cardSize'].includes(key))return;const value=e.target.value;if(key==='theme'&&!THEME_PRESETS.some(t=>t.id===value))return;if(key==='motion'&&!['normal','reduced'].includes(value))return;if(key==='cardSize'&&!['normal','large'].includes(value))return;uiSettings[key]=value;localStorage.setItem(SETTINGS_KEY,JSON.stringify(uiSettings));applySettings();render();});
app.addEventListener('click',e=>{
  const target=e.target.closest('[data-action],[data-pick]');if(!target)return;
  if(target.dataset.pick){if(state?.game?.phase==='draft')handle(`draft:${target.dataset.pick}`);else pick(target.dataset.pick);return;}
  handle(target.dataset.action);
});
addEventListener('hashchange',render);
render();if(session){refresh().then(()=>{if((location.hash||'#/')==='#/game')startStream();});}
