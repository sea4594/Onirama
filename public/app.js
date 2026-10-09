import {icon} from './icons.js';
import {cleanConfig,readHistory,recordResult,summarizeHistory,readPresets,savePreset,deletePreset,clearHistory} from './guest-data.js';
import * as firebase from './firebase-room.js';
import {renderCard} from './tabletop/cards.js';
import {applyTabletopMetrics} from './tabletop/layout.js';
import {renderSoloTabletop} from './tabletop/solo-board.js';
import {renderCooperativeTabletop} from './tabletop/coop-board.js';
import {createTabletopInteractions,soloLegalTargets,cooperativeLegalTargets,createDecisionReorder,moveOrderedCard} from './tabletop/interactions.js';
import {renderGameDialog,decisionDialogKey,createDialogController} from './tabletop/dialogs.js';
import {renderOverlay} from './game-overlay.js';
const app=document.querySelector('#app');
const STATIC_SITE=location.hostname.endsWith('.github.io');
const REMOTE_API=typeof window!=='undefined'&&typeof window.ONIRAMA_API_ORIGIN==='string'&&/^https:\/\/[^/]+$/.test(window.ONIRAMA_API_ORIGIN)?window.ONIRAMA_API_ORIGIN:'';
const base=STATIC_SITE?REMOTE_API:location.origin;
const USE_FIREBASE=firebase.firebaseConfigured();
const CAN_MULTIPLAYER=USE_FIREBASE||!STATIC_SITE||!!REMOTE_API;
const BUILD_COMMIT=typeof window!=='undefined'&&/^[a-f0-9]{40}$/.test(window.ONIRAMA_BUILD_COMMIT||'')?window.ONIRAMA_BUILD_COMMIT:null;
const IS_LOCAL_SOLO=()=>STATIC_SITE&&session?.id==='local';
let localEngine=null;
const COLOR=['red','blue','green','brown'];
const EXP=[['Book of Steps','P4','book'],['Glyphs','P4','glyphs'],['Dreamcatchers','P4','dreamcatchers'],['Towers','P4','towers'],['Happy Dreams / Premonitions','P5','premonitions'],['Crossroads / Dead Ends','P5','crossroads'],['Door to the Oniverse','P5','oniverse'],['Mirrors (promo)','P6','mirrors'],['Sphinx / Diver / Confusion','P6','sphinx'],['Little Incubus','P6','incubus']];
let mirrorSelection=new Set(),mirrorTarget=null,mirrorPairSelection=new Set(),cyclobotTarget=null,swapDraft=null,spellOpen=false;
let session=null;try{const saved=JSON.parse(localStorage.getItem('onirama.session')||'null');if(saved&&typeof saved.id==='string'&&saved.id.length<64&&(saved.id==='local'||typeof saved.token==='string'||saved.transport==='firebase'))session=saved;}catch{localStorage.removeItem('onirama.session');}
if(STATIC_SITE&&USE_FIREBASE&&session?.id!=='local'&&session?.transport!=='firebase'){session=null;localStorage.removeItem('onirama.session');}
let selectedExpansions=new Set(),selectedDifficulties={},spellSelected=new Set(),spellChoice='parallel',effectOrder=[],effectPick=null,effectDiscards=new Set();
const THEME_PRESETS=[{id:'forest',name:'Forest'},{id:'moonlit',name:'Moonlit'},{id:'copper',name:'Copper'},{id:'lagoon',name:'Lagoon'},{id:'heather',name:'Heather'},{id:'sandstone',name:'Sandstone'}];
const SETTINGS_KEY='onirama.ui.settings.v1';
const SESSION_META_KEY='onirama.guest.current.v1';
let tutorialStep=0,lastAnnouncement='';
let gameOverlay=null,gameRulesFromPause=false,overlayReturnAction=null;
function readSettings(){try{const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return {theme:THEME_PRESETS.some(p=>p.id===raw.theme)?raw.theme:'forest',motion:raw.motion==='reduced'?'reduced':'normal',cardSize:raw.cardSize==='large'?'large':'normal',contrast:raw.contrast==='high'?'high':'normal',textSize:raw.textSize==='large'?'large':'normal'};}catch{return {theme:'forest',motion:'normal',cardSize:'normal',contrast:'normal',textSize:'normal'};}}
let uiSettings=readSettings();
let playerDisplayName='Dreamwalker',partnerDisplayName='Partner';
function applySettings(){const preset=THEME_PRESETS.find(p=>p.id===uiSettings.theme)||THEME_PRESETS[0];Object.assign(document.documentElement.dataset,{theme:preset.id,motion:uiSettings.motion,cardSize:uiSettings.cardSize,contrast:uiSettings.contrast,textSize:uiSettings.textSize});const meta=document.querySelector('meta[name="theme-color"]');if(meta&&typeof getComputedStyle==='function')meta.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim());}
applySettings();
let state=null,selected=null,error='',busy=false,online=false,streamAbort=null,streamRetry=null,version=0,selectedMode='solo',page=location.hash||'#/';
const roomCodeFromHash=()=>{const match=location.hash.match(/^#\/join\?code=([a-fA-F0-9]{8})$/);return match?match[1].toUpperCase():'';};
const inviteLink=code=>`${location.origin}${location.pathname}${location.search}#/join?code=${encodeURIComponent(code)}`;
function cancelStream(){streamAbort?.abort();streamAbort=null;if(streamRetry!==null){clearTimeout(streamRetry);streamRetry=null;}}
const newId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
function sessionMeta(){if(!session)return null;try{const meta=JSON.parse(localStorage.getItem(SESSION_META_KEY)||'null');if(meta?.roomId===session.id&&typeof meta.gameId==='string')return meta;}catch{}const meta={roomId:session.id,gameId:newId(),startedAt:Date.now()};localStorage.setItem(SESSION_META_KEY,JSON.stringify(meta));return meta;}
function beginGuestSession(){if(!session)return;localStorage.setItem(SESSION_META_KEY,JSON.stringify({roomId:session.id,gameId:newId(),startedAt:Date.now()}));}
function recordCurrentResult(){if(!state?.game||!['won','lost'].includes(state.game.status))return;try{const meta=sessionMeta();recordResult(localStorage,{id:meta.gameId,mode:state.game.mode,status:state.game.status,turn:state.game.turn,config:state.game.config,startedAt:meta.startedAt});}catch(e){console.warn('Unable to save guest result',e);}}
function announceCurrent(){const g=state?.game;if(!g)return;const key=`${g.status}:${g.phase}:${g.turn}:${g.active}:${g.pending?.type||''}`;if(key===lastAnnouncement)return;lastAnnouncement=key;const el=document.querySelector('#sr-announcer');if(el)el.textContent=g.status==='won'?'Game won. All objectives met.':g.status==='lost'?'Game lost.':g.phase==='decision'?'An effect needs a decision.':`Turn ${g.turn}: ${g.players[g.active]?.name||'Player'} to act.`;}
function currentSetup(){return cleanConfig({expansions:[...selectedExpansions],difficulties:Object.fromEntries(Object.entries(selectedDifficulties).filter(([id,v])=>selectedExpansions.has(id)&&v!=='normal'))});}

const escape=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,klass='')=>`<button type="button" class="${klass}" data-action="${action}">${label}</button>`;
const card=(c,options={})=>renderCard(c,{...options,selectedId:selected});
function nav(){return `<header class="nav shell-nav"><a class="brand" href="#/" aria-label="Onirama home">${icon('diamond')}<span>ONIRAMA</span></a><div class="nav-right"><a href="#/rules" title="Rules" aria-label="Rules">${icon('help')}</a><a href="#/settings" title="Settings" aria-label="Settings">${icon('settings')}</a></div></header>`;}
function bottomNav(){if(page==='#/game')return '';const entries=[['#/','Single Player','single'],['#/multiplayer','Multiplayer','users'],['#/settings','Settings','settings']];const active=page==='#/multiplayer'||page.startsWith('#/join')?'#/multiplayer':(page==='#/settings'||page==='#/history'||page==='#/roadmap')?'#/settings':'#/';return `<nav class="bottom-nav" aria-label="Primary">${entries.map(([url,label,iconName])=>`<a href="${url}" class="bottom-nav-item${active===url?' active':''}" ${active===url?'aria-current="page"':''}><span aria-hidden="true" class="bottom-icon">${icon(iconName)}</span><span>${label}</span></a>`).join('')}</nav>`;}
function setRoute(path){if(path!=='#/game'){gameOverlay=null;gameRulesFromPause=false;}location.hash=path;page=path;render();}
function setError(msg){error=msg;render();}
async function api(route,method='GET',body=null){
  const headers={'Content-Type':'application/json'};if(session?.token)headers.Authorization=`Bearer ${session.token}`;
  if(!base)throw Error('Multiplayer backend is not configured. See Settings for deployment instructions.');
  const res=await fetch(`${base}${route}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();
  if(!res.ok)throw Error(data.error||'Request failed');return data;
}
async function refresh(){if(IS_LOCAL_SOLO()){const raw=localStorage.getItem('onirama.solo.v1');if(raw&&localEngine){const game=JSON.parse(raw);state={room:{seat:0,mode:'solo',started:true},game:localEngine.viewFor(game,0),version:(version||0)+1};session={id:'local',seat:0};online=true;sessionMeta();recordCurrentResult();render();announceCurrent();}return;}if(!session)return;const roomId=session.id,credential=session.token;try{const data=session.transport==='firebase'?await firebase.loadRoom(roomId):await api(`/api/rooms/${roomId}/state`);if(session?.id!==roomId||session?.token!==credential)return;if(Number.isInteger(data.version)&&data.version>=version){state=data;version=data.version;error='';recordCurrentResult();render();announceCurrent();}}catch(e){if(session?.id===roomId&&session?.token===credential)setError(e.message);}}
function saveSession(o){cancelStream();state=null;version=0;session={id:o.room.id,token:o.token||'',seat:o.room.seat,...(o.transport==='firebase'?{transport:'firebase',uid:o.uid}: {})};localStorage.setItem('onirama.session',JSON.stringify(session));}
async function create(mode){
  const name=(document.querySelector('#name')?.value||playerDisplayName||'Dreamwalker').trim();const config={ruleset:'official',expansions:[...selectedExpansions],difficulties:Object.fromEntries(Object.entries(selectedDifficulties).filter(([id,value])=>selectedExpansions.has(id)&&value!=='normal'))};busy=true;render();
  try{if(STATIC_SITE&&mode==='solo'){cancelStream();localEngine??=await import('./engine/game.js');const game=localEngine.newGame({mode:'solo',config});localStorage.setItem('onirama.solo.v1',JSON.stringify(game));session={id:'local',seat:0};localStorage.setItem('onirama.session',JSON.stringify(session));beginGuestSession();await refresh();setRoute('#/game');return;}const o=mode==='coop'&&USE_FIREBASE?{...(await firebase.createFirebaseRoom(name,config)),transport:'firebase',uid:await firebase.getFirebaseUid()}:await api(mode==='solo'?'/api/solo':'/api/rooms','POST',{name,config});saveSession(o);beginGuestSession();await refresh();setRoute('#/game');startStream();}
  catch(e){setError(e.message);}finally{busy=false;render();}
}
async function join(){const code=document.querySelector('#roomcode')?.value;const name=(document.querySelector('#joinname')?.value||partnerDisplayName||'Partner').trim();
  if(!CAN_MULTIPLAYER)return setError('Multiplayer is not configured yet. Redeploy GitHub Pages with the built-in Firebase configuration.');
  if(!/^[a-fA-F0-9]{8}$/.test(String(code||'').trim()))return setError('Enter the eight-character invitation code.');
  try{const o=USE_FIREBASE?{...(await firebase.joinFirebaseRoom(code,name)),transport:'firebase',uid:await firebase.getFirebaseUid()}:await api('/api/join','POST',{code,name});saveSession(o);await refresh();setRoute('#/game');startStream();}catch(e){setError(e.message);}
}
async function doRoom(operation,body={}){if(busy)return;busy=true;try{if(session.transport==='firebase'){if(operation==='ready')await firebase.firebaseReady(session.id,body.ready);else if(operation==='start')await firebase.firebaseStart(session.id);else throw Error('Unsupported room action');}else await api(`/api/rooms/${session.id}/${operation}`,'POST',body);await refresh();}catch(e){setError(e.message);}finally{busy=false;render();}}
async function action(command){if(busy)return;busy=true;render();try{if(IS_LOCAL_SOLO()){localEngine??=await import('./engine/game.js');const original=JSON.parse(localStorage.getItem('onirama.solo.v1'));const updated=localEngine.act(original,command);localEngine.assertConserved(updated);localStorage.setItem('onirama.solo.v1',JSON.stringify(updated));selected=null;mirrorTarget=null;cyclobotTarget=null;swapDraft=null;spellOpen=false;spellSelected.clear();effectOrder=[];effectPick=null;effectDiscards.clear();await refresh();return;}if(session.transport==='firebase')await firebase.firebaseAction(session.id,version,command);else await api(`/api/rooms/${session.id}/action`,'POST',{expectedVersion:version,command});selected=null;mirrorTarget=null;cyclobotTarget=null;swapDraft=null;spellOpen=false;spellSelected.clear();effectOrder=[];effectPick=null;effectDiscards.clear();await refresh();}catch(e){setError(e.message);await refresh();}finally{busy=false;render();}}
async function startStream(){
  if(IS_LOCAL_SOLO()){cancelStream();online=true;render();return;}
  if(session?.transport==='firebase'){
    cancelStream();const controller=new AbortController(),roomId=session.id,uid=session.uid;streamAbort=controller;online=false;render();
    try{const unsubscribe=await firebase.watchFirebaseRoom(roomId,data=>{if(controller.signal.aborted||session?.id!==roomId||session?.uid!==uid)return;if(data.version>=version){state=data;version=data.version;error='';online=true;recordCurrentResult();render();announceCurrent();}},e=>{if(controller.signal.aborted)return;online=false;setError('Realtime Firebase connection: '+e.message);});
      if(controller.signal.aborted){unsubscribe();return;}controller.signal.addEventListener('abort',unsubscribe,{once:true});online=true;render();
    }catch(e){if(!controller.signal.aborted){online=false;setError('Unable to connect to Firebase: '+e.message);}}return;
  }
  cancelStream();if(!session||!base)return;
  const roomId=session.id,credential=session.token,controller=new AbortController();streamAbort=controller;online=false;render();
  try{
    const response=await fetch(`${base}/api/rooms/${roomId}/stream`,{headers:{Authorization:`Bearer ${credential}`},signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error(response.status===401?'Session expired or seat unavailable':'Connection unavailable');
    if(!response.body)throw Error('Streaming unsupported');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';online=true;render();
    while(!controller.signal.aborted){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      const chunks=buffer.split('\n\n');buffer=chunks.pop()||'';
      if(buffer.length>262144)throw Error('Event exceeds maximum size');
      for(const chunk of chunks){const line=chunk.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;
        if(controller.signal.aborted||session?.id!==roomId||session?.token!==credential)return;
        // Fetch the version and filtered state together, never pair an event with a stale version.
        const fresh=await api(`/api/rooms/${roomId}/state`);
        if(controller.signal.aborted||session?.id!==roomId||session?.token!==credential)return;
        if(Number.isInteger(fresh.version)&&fresh.version>=version){state=fresh;version=fresh.version;error='';recordCurrentResult();render();announceCurrent();}
      }
    }
  }catch(e){if(!controller.signal.aborted&&session?.id===roomId){online=false;render();}}
  finally{if(!controller.signal.aborted&&session?.id===roomId&&session?.token===credential){online=false;render();
      streamRetry=setTimeout(()=>{streamRetry=null;if(session?.id===roomId&&session?.token===credential)startStream();},3500);
    }}
}

function home(){const active=session?.id==='local';return `<div class="route shell shell-home">
  <div class="shell-emblem" aria-hidden="true"><span>${icon('sun')}</span><span>${icon('moon')}</span><span>${icon('key')}</span><span>${icon('door')}</span></div>
  <h1 class="shell-hero-title">Single Player</h1>
  <div class="shell-primary-actions">
    ${btn('Play solo','soloStart','primary shell-big')}
    ${btn('Choose expansions','setup','shell-big')}
    ${session?btn(active?'Resume game':'Resume game','resume','shell-small'):''}
  </div>
  <div class="shell-links">${btn('Learn to play','tutorial','shell-text-button')}${btn('History','history','shell-text-button')}</div>
</div>`;}
function multiplayer(){return `<div class="route shell"><h1 class="shell-title">Multiplayer</h1>
 <div class="shell-dual">
  <section class="shell-card shell-room"><div class="shell-card-heading"><span class="shell-icon" aria-hidden="true">${icon('plus')}</span><h2>Create room</h2></div>
   <label class="visually-hidden" for="name">Host name</label><input id="name" class="inline-input" maxlength="40" placeholder="Your name" value="${escape(playerDisplayName)}" autocomplete="nickname">
   ${btn('Create room','coopStart','primary shell-wide')}
  </section>
  <section class="shell-card shell-room"><div class="shell-card-heading"><span class="shell-icon" aria-hidden="true">${icon('enter')}</span><h2>Join room</h2></div>
   <label class="visually-hidden" for="roomcode">8-character room code</label><input id="roomcode" class="inline-input shell-code-input" placeholder="ROOM CODE" aria-label="8-character room code" maxlength="8" autocapitalize="characters" spellcheck="false" autocomplete="off" value="${escape(roomCodeFromHash())}">
   <label class="visually-hidden" for="joinname">Your name</label><input id="joinname" class="inline-input" maxlength="40" placeholder="Your name" value="${escape(partnerDisplayName)}" autocomplete="nickname">
   ${btn('Join','join','primary shell-wide')}
  </section>
 </div>
 ${session?.id!=='local'&&session?`<div class="shell-foot-actions">${btn('Resume room','resume','shell-text-button')}</div>`:''}
 ${!CAN_MULTIPLAYER?'<p class="notice" role="status">Multiplayer unavailable · check Firebase setup.</p>':''}
</div>`;}
function settings(){const field=(id,label,options,key)=>`<label class="shell-setting"><span>${label}</span><select class="inline-input" id="${id}" data-setting="${key}" aria-label="${label}">${options}</select></label>`;
const options=(key,choices)=>choices.map(([value,label])=>`<option value="${value}" ${uiSettings[key]===value?'selected':''}>${label}</option>`).join('');
return `<div class="route shell"><h1 class="shell-title">Settings</h1>
 <section class="shell-card shell-settings"><h2 class="shell-section-title">Appearance</h2>
 ${field('themeChoice','Theme',options('theme',THEME_PRESETS.map(t=>[t.id,t.name])),'theme')}
 ${field('motionChoice','Animations',options('motion',[['normal','On'],['reduced','Reduced motion']]),'motion')}
 ${field('cardSizeChoice','Cards',options('cardSize',[['normal','Standard'],['large','Large']]),'cardSize')}
 ${field('contrastChoice','Contrast',options('contrast',[['normal','Standard'],['high','High contrast']]),'contrast')}
 ${field('textSizeChoice','Text',options('textSize',[['normal','Standard'],['large','Large']]),'textSize')}
 </section>
 <section class="shell-card shell-shortcuts"><h2 class="shell-section-title">More</h2>
  ${session?btn('Resume','resume','shell-link'):''}
  ${btn('Rules','rules','shell-link')}${btn('Guided tutorial','tutorial','shell-link')}${btn('History & statistics','history','shell-link')}${CAN_MULTIPLAYER?`<button type="button" class="shell-link" data-action="testBackend" aria-label="Test multiplayer connection">Test connection <span aria-hidden="true">›</span></button>`:''}
  
 </section>
 <footer class="shell-about"><span>Current commit: ${BUILD_COMMIT?`<a href="https://github.com/sea4594/Onirama/commit/${BUILD_COMMIT}" target="_blank" rel="noopener noreferrer" title="${BUILD_COMMIT}" class="commit-sha"><code>${BUILD_COMMIT.slice(0,8)}</code><span class="visually-hidden">${BUILD_COMMIT}</span></a>`:'<span title="Unavailable (local development)">local</span>'}</span><span><a href="#/roadmap">Roadmap</a> · Saved on this device</span></footer>
 </div>`;}
function setup(){const activeCount=selectedExpansions.size, cards=76+12*Number(selectedExpansions.has('glyphs'))+4*Number(selectedExpansions.has('dreamcatchers'))+12*Number(selectedExpansions.has('towers'))+4*Number(selectedExpansions.has('premonitions'))+16*Number(selectedExpansions.has('crossroads'))+17*Number(selectedExpansions.has('oniverse'))+14*Number(selectedExpansions.has('sphinx'));
return `<div class="route shell shell-setup"><div class="shell-title-line"><h1 class="shell-title">New game</h1><span class="shell-count" title="Deck size">${cards} cards</span></div>
 <section class="shell-card shell-setup-top"><div class="shell-segment" role="group" aria-label="Game mode"><button type="button" class="${selectedMode==='solo'?'active':''}" data-action="chooseSolo" aria-pressed="${selectedMode==='solo'}">Solo</button><button type="button" class="${selectedMode==='coop'?'active':''}" data-action="chooseCoop" aria-pressed="${selectedMode==='coop'}">Co-op</button></div><label class="visually-hidden" for="name">Player name</label><input class="inline-input" id="name" placeholder="Your name" value="Dreamwalker" maxlength="40" autocomplete="nickname"></section>
 <section class="shell-card shell-expansion-setup"><div class="shell-title-line"><h2 class="shell-section-title">Expansions</h2><span class="shell-count">${activeCount} selected</span></div>
 <div class="shell-expansion-grid">${EXP.map(([name,phase,id])=>`<div class="shell-expansion-entry"><label class="shell-expansion-choice"><input type="checkbox" data-expansion="${id}" ${selectedExpansions.has(id)?'checked':''}><span>${escape(({premonitions:'Happy Dreams & Premonitions',crossroads:'Crossroads & Dead Ends',sphinx:'Sphinx, Diver & Confusion'}[id])||name.replace(' (promo)',''))}</span></label>${selectedExpansions.has(id)&&['book','dreamcatchers','towers','premonitions','crossroads','mirrors','incubus'].includes(id)?`<label class="visually-hidden" for="difficulty-${id}">${escape(name)} difficulty</label><select id="difficulty-${id}" class="inline-input shell-difficulty" data-difficulty="${id}" aria-label="${escape(name)} difficulty">${id==='incubus'?`<option value="easy" ${!selectedDifficulties[id]||selectedDifficulties[id]==='easy'?'selected':''}>New Dreamwalker</option><option value="apprentice" ${selectedDifficulties[id]==='apprentice'?'selected':''}>Apprentice</option><option value="true" ${selectedDifficulties[id]==='true'?'selected':''}>True Dreamwalker</option>`:`<option value="normal" ${!selectedDifficulties[id]||selectedDifficulties[id]==='normal'?'selected':''}>Normal</option><option value="hard" ${selectedDifficulties[id]==='hard'?'selected':''}>Hard</option>${id==='premonitions'?`<option value="extreme" ${selectedDifficulties[id]==='extreme'?'selected':''}>Very hard (6)</option>`:''}`}</select>`:''}</div>`).join('')}</div>
 </section>
 <div class="shell-start">${btn(selectedMode==='solo'?'Start solo':'Create room','create','primary shell-big shell-wide')}</div>
 <details class="shell-card shell-presets"><summary>Saved setups <span class="shell-count">${readPresets(localStorage).length}</span></summary><div class="shell-preset-actions"><label class="visually-hidden" for="presetName">Setup name</label><input id="presetName" class="inline-input" maxlength="48" placeholder="Name setup">${btn('Save','presetSave','primary')}</div><div class="shell-preset-list">${readPresets(localStorage).map(p=>`<div class="shell-preset"><strong>${escape(p.name)}</strong>${btn('Load',`presetLoad:${p.id}`,'mini')}${btn('Delete',`presetDelete:${p.id}`,'mini ghost')}</div>`).join('')}</div></details>
 </div>`;}
function joinPage(){return `<div class="route shell shell-join"><h1 class="shell-title">Join room</h1><section class="shell-card shell-room"><label class="visually-hidden" for="roomcode">Room code</label><input id="roomcode" class="inline-input shell-code-input" placeholder="ROOM CODE" aria-label="Room code" maxlength="8" autocapitalize="characters" spellcheck="false" autocomplete="off" value="${escape(roomCodeFromHash())}"><label class="visually-hidden" for="joinname">Your name</label><input id="joinname" class="inline-input" value="${escape(partnerDisplayName)}" placeholder="Your name" maxlength="40">${btn('Join room','join','primary shell-wide')}</section></div>`;}
function lobby(room){return `<div class="route shell shell-lobby"><div class="shell-title-line"><h1 class="shell-title">Room</h1><span class="shell-status">${room.connected?.filter(Boolean).length||0}/2</span></div>
 <section class="shell-card shell-invite"><label class="visually-hidden" for="roomcodeDisplay">Room code</label><input id="roomcodeDisplay" class="shell-room-code" readonly value="${escape(room.code)}" aria-label="Room code"><div class="shell-invite-buttons">${btn('Copy code','copyCode')}<button type="button" data-action="copyInvite" aria-label="Copy invite link">Copy link</button></div><label class="visually-hidden" for="inviteUrl">Invite link</label><input id="inviteUrl" class="inline-input shell-invite-url" readonly aria-label="Invite link" value="${escape(inviteLink(room.code))}"></section>
 <section class="shell-card shell-lobby-players" aria-label="Player readiness">${[0,1].map((i)=>`<div class="shell-seat ${room.ready[i]?'ready':''}"><span class="shell-seat-icon" aria-hidden="true">${icon(room.ready[i]?'check':room.connected[i]?'dot':'circle')}</span><span>Player ${i+1}</span><small>${room.ready[i]?'Ready':room.connected[i]?'Joined':'Waiting'}</small></div>`).join('')}</section>
 <div class="shell-start">${btn(room.ready[room.seat]?'Not ready':'Ready','ready','primary shell-big')}${room.host?`<button type="button" data-action="start" class="shell-big" ${room.ready.every(Boolean)&&room.connected[1]?'':'disabled title="Both players must be ready"'}>Start</button>`:''}</div>
 </div>`;}
function effectReorder(p){if(!p.cards)return '';const ids=p.cards.map(c=>c.id);if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id)))effectOrder=[...ids];
 const modes={sphinxResolve:'Sphinx — choose the top card if your named aspect matched; arrange the others bottom-first.',diver:'Diver — stop and put last card on top, continue revealing, or resolve a Nightmare.',denizenPeek:'Denizen insight — reorder inspected cards.',happyPeek:'Happy Dream — choose zero or more cards to discard, then reorder the rest.',incantation:'Incantation — choose one Door (if available) and order the others from bottom to top.',towerLook:'Tower insight — order inspected cards from top to bottom.',spellPeek:'Paradoxical Prophecy — pick one card to put on top; order the others from bottom to top.'};
 const options=p.cards.filter(c=>p.type==='incantation'?c.kind==='door':['spellPeek','sphinxResolve'].includes(p.type));
 if(effectPick&&!options.some(c=>c.id===effectPick))effectPick=null;
 return `<section class="decision stack"><h2>${escape(modes[p.type])}</h2><p>Use arrows to rearrange the revealed cards. Leftmost is first in the indicated ordering.</p><div class="cards tt3-order-list" data-tt-order-group="effect">${effectOrder.map(id=>{const c=p.cards.find(x=>x.id===id);return `<div class="stack tt3-order-item" data-tt-order-id="${escape(id)}" style="align-items:center"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" title="Drag to reorder">${card(c)}</div>${options.some(x=>x.id===id)?btn(effectPick===id?'✓ Selected':'Select',`effectPick:${id}`,'mini'):''}${p.type==='happyPeek'?btn(effectDiscards.has(id)?'✓ Discard':'Keep / discard',`effectDiscard:${id}`,'mini'):''}${btn('↑',`effectUp:${id}`,'mini')}${btn('↓',`effectDown:${id}`,'mini')}</div>`;}).join('')}</div>${p.type==='sphinxResolve'?`<div class="actions">${p.cards.map(c=>btn(`Top: ${c.id}`,`effectPick:${c.id}`,'mini')).join('')}</div>${btn('Resolve Sphinx','sphinxConfirm','primary')}`:p.type==='diver'?`<div class="actions">${p.cards.at(-1)?.kind==='nightmare'?btn('Resolve Diver as Nightmare','diverNightmare','danger'):btn('Stop here','diverStop','primary')}${p.cards.at(-1)?.kind!=='nightmare'&&p.remaining!==0?btn('Reveal another','diverContinue'):''}</div>`:btn('Confirm effect','effectConfirm','primary')}</section>`;
}
function towerEdgeConflict(left,right){const marks=v=>Array.isArray(v)?v:typeof v==='string'?v.split(/[+|,/ ]+/).filter(Boolean):[];return marks(left).some(mark=>marks(right).includes(mark));}
function catcherSearchChoice(g,searchesDeck){
 if(!searchesDeck||!g.expansion?.dreamcatchers)return '';
 const d=g.expansion.dreamcatchers;
 return `<label class="muted small">Optional: free a Dreamcatcher when shuffling after this search<select id="freeOnSearch" class="inline-input"><option value="">Do not free</option>${d.stacks.map((stack,i)=>stack.length&&d.active[i]?`<option value="${i}">Free catcher ${i+1}</option>`:'').join('')}</select></label>`;
}
function searchFreeId(){const selected=document.querySelector('#freeOnSearch')?.value;return selected===undefined||selected===''?undefined:Number(selected);}
function decision(g,canAct){
  if(g.phase!=='decision')return '';
  if(!canAct)return `<div class="notice">Your partner is resolving a card effect.</div>`;
  const p=g.pending;if(!p)return '';
  if(p.type==='sphinxName')return `<section class="decision stack"><h2>Sphinx: name an aspect</h2><div class="actions">${[...COLOR,'moon','key',...(g.config.expansions.includes('glyphs')?['glyph']:[])].map(a=>btn(a,`sphinxName:${a}`,'primary')).join('')}</div></section>`;
  if(p.type==='sphinxResolve'||p.type==='diver')return effectReorder(p);
  if(p.type==='confusion'){const cards=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])];const ids=cards.map(c=>c.id);if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id)))effectOrder=[...ids];return `<section class="decision stack"><h2>Confusion — reorder your hand</h2><p>Arrange cards bottom-first, then draw a new hand. Doors and Dreams drawn during replacement go to Limbo without resolving.</p><div class="cards tt3-order-list" data-tt-order-group="effect">${effectOrder.map(id=>{const c=cards.find(x=>x.id===id);return `<div class="stack tt3-order-item" data-tt-order-id="${escape(id)}"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" title="Drag to reorder">${card(c)}</div>${btn('↑',`effectUp:${id}`,'mini')}${btn('↓',`effectDown:${id}`,'mini')}</div>`;}).join('')}</div>${btn('Return cards and redraw','confusionResolve','primary')}</section>`;}
  if(p.type==='mirrorReward')return `<section class="decision stack"><h2>${escape(p.mirror)} Mirror reward</h2><p>Select cards from the ${p.mirror==='blue'?'discard pile':'deck'}; choose exactly the printed number if available.</p>${p.mirror==='key'?`<label>Door color <select id="mirrorColor" class="inline-input">${COLOR.map(c=>`<option>${c}</option>`).join('')}</select></label>`:''}<div class="tt4-card-choices">${p.options.map(c=>`<label class="tt4-card-option"><input type="checkbox" data-mirror-choice="${escape(c.id)}" ${mirrorSelection.has(c.id)?'checked':''}>${card(c,{tiny:true})}</label>`).join('')}</div>${catcherSearchChoice(g,p.mirror!=='blue')}${btn('Apply Mirror effect','mirrorRewardConfirm','primary')}</section>`;
  if(p.type==='doorSearch')return `<section class="decision stack"><h2>A Door awaits</h2><p>Three ${p.color} Locations. Search for an eligible Door, or skip.</p><div class="actions">${(p.targets||[]).map(t=>`<button type="button" class="tt4-card-option" data-action="doorSearch:claim:${escape(t.id)}" title="Claim Door">${card({id:t.id,kind:'door',color:p.color},{tiny:true})}<span class="muted small">${t.source==='deck'?'Deck':`Catcher ${Number(t.source.slice(5))+1}`}</span></button>`).join('')||'<span class="muted small">No Door is available for this search.</span>'}${btn('Skip','doorSearch:skip')}</div>${g.expansion?.dreamcatchers?`<p class="muted small">Optional: free one Dreamcatcher when shuffling after a deck search.</p><select id="freeOnSearch" class="inline-input"><option value="">Do not free</option>${g.expansion.dreamcatchers.stacks.map((stack,i)=>stack.length&&g.expansion.dreamcatchers.active[i]?`<option value="${i}">Free catcher ${i+1}</option>`:'').join('')}</select>`:''}</section>`;
  if(p.type==='door')return `<section class="decision stack"><h2>Oneiric Door</h2><p>A ${p.card.color} Door appeared. Spend a matching Key to claim it, or put the Door into Limbo.</p><div class="actions">${p.keys.map(k=>`<button type="button" class="tt4-card-option" data-action="useKey:${escape(k.id)}" title="Use Key from ${escape(k.zone)}">${card([...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])].find(c=>c.id===k.id)||{kind:'location',symbol:'key',color:p.card.color},{tiny:true})}<span class="muted small">${escape(k.zone)}</span></button>`).join('')}${btn('Send to Limbo','useKey:limbo')}</div></section>`;
  if(p.type==='nightmare'){
    const keys=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])].filter(c=>c.symbol==='key');
    const ds=g.players[g.active].doors;
    return `<section class="decision stack"><h2>A Nightmare</h2><p>Choose one of the four official penalties. Unavailable resources cannot be sacrificed.</p><div class="stack">${g.expansion?.incubus&&!p.incubus&&(g.expansion.incubus.level==='easy'?!g.expansion.incubus.used:g.expansion.incubus.stored.length>0)?btn('Cancel with Little Incubus','incubusCancel','primary'):''}${(g.expansion?.oniverse?.rallied||[]).filter(d=>d.ability==='mirror'&&d.owner===g.active).map(d=>btn('Mirror Denizen — cancel Nightmare',`mirror:${d.id}`,'primary')).join('')}${keys.length?`<div class="small">Discard a Key: <div class="actions">${keys.map(k=>`<button type="button" class="tt4-card-option" data-action="nightKey:${escape(k.id)}">${card(k,{tiny:true})}</button>`).join('')}</div></div>`:''}${ds.length?`<div class="small">Lose a Door: <div class="actions">${ds.map(d=>`<button type="button" class="tt4-card-option" data-action="nightDoor:${escape(d.id)}">${card(d,{tiny:true})}</button>`).join('')}</div></div>`:''}<div class="actions">${btn('Reveal up to 5 cards','nightReveal')}${btn('Discard and replace entire hand','nightHand','danger')}</div></div></section>`;
  }
  if(p.type==='prophecy')return prophecy(g);
  if(p.type==='happyDream')return `<section class="decision stack"><h2>Happy Dream</h2><p>Choose one benefit.</p><div class="actions">${(g.expansion?.premonitions?.faceUp||[]).map(id=>btn(`Cancel ${id}`,`happyBanish:${id}`,'primary')).join('')}${btn('Inspect top seven','happyPeek','primary')}${btn('Search for one card','happyFetch','primary')}</div></section>`;
  if(p.type==='happyFetch')return `<section class="decision stack"><h2>Happy Dream — find a card</h2><p>Select one deck card to place on top (deck reshuffles).</p><div class="actions">${p.options.map(c=>`<button type="button" class="tt4-card-option" data-action="happyFetch:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div>${catcherSearchChoice(g,true)}</section>`;
  if(p.type==='rally')return `<section class="decision stack"><h2>Rally ${escape(p.card.ability)}?</h2><p>Discard an eligible Location to keep this Denizen for one later ability.</p><div class="actions">${p.choices.map(id=>`<button type="button" class="tt4-card-option" data-action="rally:${escape(id)}">${card([...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])].find(c=>c.id===id)||{kind:'location',color:'red',symbol:'sun'},{tiny:true})}</button>`).join('')}${btn('Do not rally','rally:skip')}</div></section>`;
  if(p.type==='premonitionPick')return `<section class="decision stack"><h2>Dark Premonitions triggered</h2><p>Choose the order of resolving the active conditions.</p><div class="actions">${p.options.map(id=>btn(`Resolve ${id}`,`premonitionPick:${id}`,'danger')).join('')}</div></section>`;
  if(p.type==='premonitionDoor')return `<section class="decision stack"><h2>Premonition — sacrifice a Door</h2><div class="actions">${p.choices.map(d=>`<button type="button" class="tt4-card-option" data-action="premonitionDoor:${escape(d.id)}">${card(d,{tiny:true})}<span class="muted small">Player ${d.owner+1}</span></button>`).join('')}</div></section>`;
  if(['incantation','towerLook','spellPeek','happyPeek','denizenPeek'].includes(p.type))return effectReorder(p);
  if(p.type==='catchChoose'||p.type==='catchOverload')return `<section class="decision stack"><h2>${p.type==='catchChoose'?'Assign Limbo to a free Dreamcatcher':'Dreamcatcher overload'}</h2><p>${p.type==='catchChoose'?'Choose which free Dreamcatcher stores this turn’s Limbo.':'All catchers are occupied. Sacrifice one catcher and shuffle its cards with Limbo.'}</p><div class="actions">${p.choices.map(i=>btn(`Catcher ${i+1}`,`${p.type}:${i}`,'primary')).join('')}</div></section>`;
  if(p.type==='towerPenalty')return `<section class="decision stack"><h2>Nightmare threatens the Towers</h2><p>Discard a legal Tower, or put this Nightmare into Limbo instead (false destruction).</p><div class="actions">${g.expansion.towers.alignment.filter((t,i,a)=>i===0||i===a.length-1||!a[i-1].right||!a[i+1].left||!towerEdgeConflict(a[i-1].right,a[i+1].left)).map(t=>btn(`Discard ${t.color} Tower`,`towerPenalty:${t.id}`)).join('')}${btn('False destruction','towerFake','primary')}</div></section>`;
  if(p.type==='moduleDecision')return `<section class="decision stack"><h2>Choose effect: ${escape(p.id)}</h2><div class="actions">${p.options.map(o=>btn(escape(o),`moduleDecision:${encodeURIComponent(o)}`,'primary')).join('')}</div></section>`;
  return `<div class="notice">Resolving an effect.</div>`;
}
let prophecyDiscard=null,prophecyOrder=[];
function prophecy(g){const cards=g.pending.cards;if(!cards)return '';
  if(!cards.some(c=>c.id===prophecyDiscard)){prophecyDiscard=null;prophecyOrder=cards.map(c=>c.id);}
  if(prophecyOrder.length!==cards.length||prophecyOrder.some(id=>!cards.some(c=>c.id===id)))prophecyOrder=cards.map(c=>c.id);
  return `<section class="decision stack"><h2>Prophecy</h2><p>Choose exactly one card to discard. Reorder the others from top to bottom, then confirm.</p><div class="cards tt3-order-list" data-tt-order-group="prophecy">${prophecyOrder.map((id,index)=>{const c=cards.find(x=>x.id===id);return `<div class="stack tt3-order-item" data-tt-order-id="${escape(id)}" style="align-items:center"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" title="Drag to reorder">${card(c,{tiny:false})}</div>${btn(prophecyDiscard===id?'✓ Discard':'Discard',`prophecyDiscard:${id}`,'mini')}${btn('↑',`prophecyUp:${id}`,'mini')}${btn('↓',`prophecyDown:${id}`,'mini')}</div>`;}).join('')}</div><div class="muted small">Leftmost card will be drawn first.</div>${btn('Confirm Prophecy','prophecyConfirm',prophecyDiscard?'primary':'')}</section>`;
}
// The new solo and cooperative tabletops are the only supported gameplay surfaces.
// Unknown modes fail visibly instead of silently falling back to obsolete controls.
function board(g,room){
  if(g.mode==='solo')return renderSoloTabletop(g,{selectedId:selected,canAct:room.seat===g.active});
  if(g.mode==='coop')return renderCooperativeTabletop(g,{seat:room.seat,selectedId:selected,canAct:room.seat===g.active,connected:online});
  throw new Error(`Unsupported game mode: ${g.mode}`);
}
// Phase 4: contextual UI lives outside the tabletop. All choices still dispatch
// through the existing command handler and server/local engine.
function contextualDialog(g,room){
 if(g.status!=='active'||!['action','decision'].includes(g.phase)||room.seat!==g.active)return null;
 const e=g.expansion||{},cards=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])];
 if(g.phase==='action'&&mirrorTarget&&e.mirrors&&!e.mirrors.completed.includes(mirrorTarget)){
  const matches=c=>c.kind==='location'&&(COLOR.includes(mirrorTarget)?c.color===mirrorTarget||c.color==='wild':mirrorTarget==='rainbow'?COLOR.includes(c.color):c.symbol===mirrorTarget);
  const html=`<section class="decision stack"><h2>Place two cards · ${escape(mirrorTarget)}</h2><div class="tt4-card-choices">${cards.filter(matches).map(c=>`<label class="tt4-card-option"><input type="checkbox" data-mirror-pair="${escape(c.id)}" ${mirrorPairSelection.has(c.id)?'checked':''}>${card(c,{tiny:true})}</label>`).join('')}</div>${mirrorTarget==='green'&&e.dreamcatchers?catcherSearchChoice(g,true):''}<div class="actions">${btn('Place pair','mirrorConfirm','primary')}${btn('Cancel','mirrorCancel')}</div></section>`;
  return {type:'mirrorPair',key:`context:mirror:${mirrorTarget}`,html};
 }
 if(g.phase==='action'&&cyclobotTarget&&e.oniverse?.rallied.some(d=>d.id===cyclobotTarget)){
  const eligible=g.discard.filter(c=>c.kind==='location');
  const html=`<section class="decision stack"><h2>Cyclobot exchange</h2><p>Select a hand Location, then select its replacement.</p><div class="tt4-card-choices">${eligible.map(c=>`<button type="button" class="tt4-card-option" data-action="cyclobotSwap:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')||'<span>No Locations available.</span>'}</div><div class="actions">${btn('Cancel','cyclobotCancel')}</div></section>`;
  return {type:'cyclobot',key:`context:cyclobot:${cyclobotTarget}`,html};
 }
 if(g.phase==='action'&&swapDraft){
  const discarded=cards.find(c=>c.id===swapDraft.cardId);if(discarded){
   const html=`<section class="decision stack"><h2>Discard ${escape(discarded.color||discarded.kind)} ${escape(discarded.symbol||'')}</h2><p>Optional: swap one personal card with one shared card.</p><label>Personal card<select id="swapPersonal" class="inline-input"><option value="">No swap</option>${g.players[g.active].hand.filter(c=>c.id!==discarded.id).map(c=>`<option value="${escape(c.id)}">${escape(c.color||c.kind)} ${escape(c.symbol||'')}</option>`).join('')}</select></label><label>Shared card<select id="swapShared" class="inline-input"><option value="">No swap</option>${g.shared.filter(c=>c.id!==discarded.id).map(c=>`<option value="${escape(c.id)}">${escape(c.color||c.kind)} ${escape(c.symbol||'')}</option>`).join('')}</select></label><div class="actions">${btn('Confirm discard','discardConfirm','primary')}${btn('Cancel','discardCancel')}</div></section>`;
   return {type:'coopDiscard',key:`context:discard:${discarded.id}`,html};
  }
 }
 if(spellOpen&&e.book){const b=e.book;
  const html=`<section class="decision stack"><h2>Cast a spell</h2><label>Spell<select id="spellChoice" data-spell-choice="true" class="inline-input"><option value="parallel" ${spellChoice==='parallel'?'selected':''}>Parallel Planning · ${b.costs.parallel}</option><option value="paradox" ${spellChoice==='paradox'?'selected':''}>Paradoxical Prophecy · ${b.costs.paradox}</option><option value="punishment" ${spellChoice==='punishment'?'selected':''}>Powerful Punishment · ${b.costs.punishment}</option></select></label><p>Choose ${b.costs[spellChoice]} discarded cards.</p><div class="tt4-card-choices">${g.discard.map(c=>`<button type="button" class="tt4-card-option" aria-pressed="${spellSelected.has(c.id)}" data-action="spellCost:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')||'<span>No discarded cards</span>'}</div>${spellChoice==='parallel'?`<div class="row"><label>Goal A<input class="inline-input goal-input" id="goalA" type="number" min="1" max="${b.goals.length}" value="1"></label><label>Goal B<input class="inline-input goal-input" id="goalB" type="number" min="1" max="${b.goals.length}" value="2"></label></div>`:''}${spellChoice==='punishment'&&(g.pending?.type!=='nightmare'||g.pending.incubus)?'<p>Requires a real pending Nightmare.</p>':''}<div class="actions">${btn('Cast spell','castSpell','primary')}${btn('Cancel','dialogClose')}</div></section>`;
  return {type:'spellbook',key:'context:spellbook',html};
 }
 return null;
}
function gameDialog(g,room){
 if(!g||!room||g.status!=='active')return '';
 if(g.phase==='decision'&&spellOpen&&g.expansion?.book){const spell=contextualDialog(g,room);if(spell)return renderGameDialog({...spell,mandatory:false});}
 if(g.phase==='decision'){
  const key=decisionDialogKey(g,room.seat);
  if(!key)return '';
  return renderGameDialog({type:g.pending.type,key,mandatory:true,html:decision(g,true)+(g.expansion?.book?`<div class="tt4-spell-shortcut">${btn('Cast spell','openSpells','mini')}</div>`:'')});
 }
 const context=contextualDialog(g,room);
 return context?renderGameDialog({...context,mandatory:false}):'';
}
function closeOptionalDialog(){mirrorTarget=null;mirrorPairSelection.clear();cyclobotTarget=null;swapDraft=null;spellOpen=false;spellSelected.clear();render();}
function rules(){return `<div class="route shell shell-rules"><h1 class="shell-title">Rules</h1><p class="shell-rules-intro">Collect all eight Doors before the deck runs out.</p>
<details class="shell-card shell-rule"><summary>Each turn</summary><ol><li>Play or discard one Location.</li><li>Refill your hand, resolving each Door or Nightmare immediately.</li><li>Shuffle Limbo into the deck.</li></ol></details>
<details class="shell-card shell-rule"><summary>Labyrinth & Doors</summary><p>Adjacent played Locations must have different symbols. Three consecutive Locations of the same color unlock a matching Door from the deck. The fourth starts a new sequence.</p><p>Solo: two Doors of each color. Co-op: one per player.</p></details>
<details class="shell-card shell-rule"><summary>Keys & Prophecy</summary><p>Discard a Key to inspect the top five deck cards. Discard one; return the rest to the top in any order. A matching Key can claim a Door drawn while refilling.</p></details>
<details class="shell-card shell-rule"><summary>Nightmares</summary><ol><li>Discard a Key.</li><li>Return an acquired Door to Limbo.</li><li>Reveal up to five cards; discard Locations, put Doors and Dreams in Limbo.</li><li>Discard your entire hand and refill, setting aside Dreams and Doors without resolving them.</li></ol></details>
<details class="shell-card shell-rule"><summary>Two-player co-op</summary><p>Draft eight visible Locations, alternating until each player has three personal cards. The remaining two are shared. Take turns using personal or shared Locations, with separate Labyrinths and Door collections. After discarding, optionally swap one personal and one shared card.</p></details>
<details class="shell-card shell-rule"><summary>Expansions & difficulty</summary><p>Choose expansions and difficulty variants in New game. Goals, spells, new Dreams and cards, Towers, Dreamcatchers, Mirrors and Denizens appear on the tabletop; complex effects open a decision sheet. The Little Incubus is base-game-only in official mode.</p></details>
<footer class="shell-rules-footer"><a href="https://www.rulespal.com/onirim/rulebook" target="_blank" rel="noopener noreferrer">Official base rules ↗</a><span>Independent adaptation; unresolved combination rulings are documented in the repo.</span></footer></div>`;}
function roadmap(){const phases=['Foundation','Base tabletop','Card gestures','Decision dialogs','Expansion tabletop','Co-op tabletop','Minimal app shell','Visual QA','Final cleanup'];return `<div class="route shell"><div class="shell-title-line"><h1 class="shell-title">UI roadmap</h1><span class="shell-count">9 of 9</span></div><section class="shell-card shell-roadmap">${phases.map((title,i)=>`<div><span>${i+1}</span><strong>${title}</strong><small>${i<9?'✓':'Pending'}</small></div>`).join('')}</section></div>`;}
const TUTORIAL=[
 ['The objective','Collect all eight Doors before the deck runs out.'],
 ['Your hand','Play or discard one Location each turn.'],
 ['Symbols','Adjacent played cards must have different symbols.'],
 ['Doors','Three consecutive Locations of one color unlock a matching Door.'],
 ['Keys','Discard a Key to inspect five cards, discard one and reorder the rest.'],
 ['Nightmares','Choose one penalty when a Nightmare appears during a refill.'],
 ['Expansions','Turn on optional expansions before starting a new game.']
];
function tutorial(){const [heading,body]=TUTORIAL[tutorialStep];return `<div class="route shell shell-tutorial"><div class="shell-title-line"><h1 class="shell-title">Guided tutorial</h1><span class="shell-count">${tutorialStep+1}/${TUTORIAL.length}</span></div><section class="shell-card shell-tutorial-card"><div class="shell-tutorial-symbol" aria-hidden="true">${icon(['diamond','users','sun','door','key','sparkle','leaf'][tutorialStep])}</div><h2>${escape(heading)}</h2><p>${escape(body)}</p><div class="tutorial-track" role="progressbar" aria-label="Tutorial progress" aria-valuenow="${tutorialStep+1}" aria-valuemin="1" aria-valuemax="${TUTORIAL.length}"><div style="width:${(tutorialStep+1)/TUTORIAL.length*100}%"></div></div><div class="shell-tutorial-nav">${tutorialStep>0?btn('←','tutorialBack','shell-arrow'):''}${tutorialStep<TUTORIAL.length-1?btn('Next →','tutorialNext','primary'):btn('Play','tutorialStart','primary')}</div></section><div class="shell-foot-actions">${btn('Full rules','rules','shell-text-button')}</div></div>`;}
function historyPage(){const list=readHistory(localStorage),stats=summarizeHistory(list);return `<div class="route shell"><div class="shell-title-line"><h1 class="shell-title">History</h1><span class="shell-count">Local</span></div>
 <section class="shell-stats">${[['Games',stats.played],['Wins',stats.wins],['Win rate',stats.winRate+'%'],['Solo · Co-op',stats.solo+' · '+stats.coop]].map(([name,value])=>`<div class="shell-card shell-stat"><strong>${value}</strong><span>${name}</span></div>`).join('')}</section>
 <section class="shell-card shell-history"><h2 class="shell-section-title">Games</h2>${list.length?`<div class="shell-history-list">${list.map(r=>`<div class="shell-history-row"><span class="shell-result ${r.status}">${icon(r.status==='won'?'check':'close')}</span><div><strong>${r.mode==='solo'?'Solo':'Co-op'} · ${r.status==='won'?'Win':'Loss'}</strong><small>${new Date(r.finishedAt).toLocaleDateString()} · Turn ${r.turn}${r.config.expansions.length?' · '+r.config.expansions.length+' expansions':''}</small></div></div>`).join('')}</div>`:'<p class="shell-empty">No completed games</p>'}${list.length?btn('Clear history','historyClear','shell-text-button'):''}</section>
 </div>`;}
function fitGameTabletop(){
  const viewport=app.querySelector?.('.game-viewport'),table=viewport?.querySelector?.('.tt2-root');if(!table)return;
  table.style.transform='';table.style.zoom='1';
  // Temporary compact-size fallback until Phase 4's actual zone rearrangement.
  // CSS zoom keeps the board full width (unlike transform:scale) and permits
  // layout reflow at each candidate size. Nothing gets scrolled offscreen.
  const available=viewport.clientHeight||0;if(!available)return;
  if(table.getBoundingClientRect().height<=available){table.style.setProperty?.('--game-fit-scale','1');return;}
  let low=.2,high=1,best=.2;
  for(let i=0;i<8;i++){
    const candidate=(low+high)/2;table.style.zoom=String(candidate);
    if(table.getBoundingClientRect().height<=available-2){best=candidate;low=candidate;}else high=candidate;
  }
  table.style.zoom=String(best);table.style.setProperty?.('--game-fit-scale',String(best));
}
function render(){const dialogFocus=typeof dialogController!=='undefined'?dialogController?.capture?.():null;const focused=document.activeElement;const focusKind=['action','pick','setting','expansion','difficulty'].find(k=>focused?.dataset?.[k]);const focusValue=focusKind?focused.dataset[focusKind]:null;
  const previousWindow=app.querySelector?.('.shell-viewport-window');
  const windowScroll=previousWindow?.scrollTop||0,windowRoute=previousWindow?.dataset?.pageRoute;
  const previousOverlay=app.querySelector?.('[data-game-menu-dialog]');
  const overlayScroll=previousOverlay?.querySelector?.('[data-game-menu-scroll]')?.scrollTop||0;
  const expandedRules=[...(previousOverlay?.querySelectorAll?.('details[open][data-rule-index]')||[])].map(el=>el.dataset.ruleIndex);
  const settingsExpanded=!!previousOverlay?.querySelector?.('[data-pause-settings][open]');
  const overlayFocused=focused?.closest?.('[data-game-menu-dialog]')?focused?.dataset?.action||focused?.dataset?.setting:null;
  page=location.hash||'#/';if(page!=='#/game'){gameOverlay=null;gameRulesFromPause=false;}let content;
  if(page==='#/setup')content=setup();else if(page==='#/join'||roomCodeFromHash())content=joinPage();else if(page==='#/rules')content=rules();else if(page==='#/roadmap')content=roadmap();else if(page==='#/multiplayer')content=multiplayer();else if(page==='#/settings')content=settings();else if(page==='#/history')content=historyPage();else if(page==='#/tutorial')content=tutorial();else if(page==='#/game')content=!state?'<div class="loading">Loading the dream…</div>':state.room.started?board(state.game,state.room):lobby(state.room);else content=home();
  const inGame=page==='#/game'&&!!state?.room?.started;
  const errorMessage=error?`<div class="notice error" role="alert">${escape(error)} <button class="mini ghost" data-action="clearError">Dismiss</button></div>`:'';
  app.innerHTML=(inGame?'':nav())+`<main class="page${inGame?' game-viewport':''}" id="main-content" tabindex="-1">${errorMessage}${inGame?content:`<div class="shell-viewport-window" data-page-route="${escape(page)}" role="region" aria-label="Page content" tabindex="0">${content}</div>`}</main>`+(inGame?'':bottomNav())+(inGame?gameDialog(state.game,state.room):'')+(inGame&&typeof renderOverlay==='function'?renderOverlay(gameOverlay,state.game?.config?.expansions,state.game?.mode==='coop',{...uiSettings,fromPause:gameRulesFromPause,themes:THEME_PRESETS}):'');
  if(inGame){
    applyTabletopMetrics(app.querySelector?.('.tt2-root'),{mode:state.game.mode,expansions:state.game.config?.expansions||[]});
    for(const labyrinth of app.querySelectorAll?.('[data-tabletop-scroll]')||[]){labyrinth.scrollLeft=labyrinth.scrollWidth;}
    fitGameTabletop();
  }
  const nextWindow=app.querySelector?.('.shell-viewport-window');
  if(nextWindow&&windowRoute===page)nextWindow.scrollTop=windowScroll;
  if(typeof dialogController!=='undefined'&&dialogController)dialogController.sync(dialogFocus);
  const openMenu=app.querySelector?.('[data-game-menu-dialog]');
  if(openMenu){
    const scroller=openMenu.querySelector?.('[data-game-menu-scroll]');if(scroller)scroller.scrollTop=overlayScroll;
    for(const detail of openMenu.querySelectorAll?.('[data-rule-index]')||[])detail.open=expandedRules.includes(detail.dataset.ruleIndex);
    const pauseSettings=openMenu.querySelector?.('[data-pause-settings]');if(pauseSettings)pauseSettings.open=settingsExpanded;
    const match=overlayFocused?[...(openMenu.querySelectorAll?.('[data-action],[data-setting]')||[])].find(el=>el.dataset.action===overlayFocused||el.dataset.setting===overlayFocused):null;
    (match||openMenu.querySelector?.('button,[href],summary,select')||openMenu)?.focus?.({preventScroll:true});
  }else if(overlayReturnAction){(app.querySelector?.(`.tt4-overlay [data-action="${overlayReturnAction}"]`)||app.querySelector?.(`[data-action="${overlayReturnAction}"]`))?.focus?.({preventScroll:true});overlayReturnAction=null;}
  for(const node of app.querySelectorAll?.('.page,.tt4-overlay')||[]){if(gameOverlay)node.setAttribute?.('inert','');else node.removeAttribute?.('inert');}
  if(focusKind&&!gameOverlay){const replacement=[...(app.querySelectorAll?.('[data-action],[data-pick],[data-setting],[data-expansion],[data-difficulty]')||[])].find(el=>el.dataset?.[focusKind]===focusValue);if(!app.querySelector?.('[data-tt4-dialog]')||app.querySelector('[data-tt4-dialog]').contains(replacement))replacement?.focus?.({preventScroll:true});}
}
function pick(id){selected=selected===id?null:id;swapDraft=null;render();}
function moveProphecy(id,dir){let i=prophecyOrder.indexOf(id),j=i+dir;if(j<0||j>=prophecyOrder.length)return;[prophecyOrder[i],prophecyOrder[j]]=[prophecyOrder[j],prophecyOrder[i]];render();}
async function handle(actionName){
  if(actionName==='openGamePause'||actionName==='openGameRules'){
    if(page!=='#/game'||!state?.room?.started)return;
    gameRulesFromPause=actionName==='openGameRules'&&gameOverlay==='pause';
    gameOverlay=actionName==='openGamePause'?'pause':'rules';return render();
  }
  if(actionName==='closeGameOverlay'){
    if(!gameOverlay)return;
    overlayReturnAction=gameOverlay==='pause'?'openGamePause':'openGameRules';
    gameOverlay=null;gameRulesFromPause=false;return render();
  }
  if(actionName==='gameGoHome'){gameOverlay=null;gameRulesFromPause=false;return setRoute('#/');}
  if(actionName==='soloStart'){selectedMode='solo';return create('solo');}if(actionName==='coopStart'){selectedMode='coop';return create('coop');}
  if(actionName==='history')return setRoute('#/history');
  if(actionName==='tutorial'){tutorialStep=0;return setRoute('#/tutorial');}
  if(actionName==='tutorialBack'){tutorialStep=Math.max(0,tutorialStep-1);return render();}
  if(actionName==='tutorialNext'){tutorialStep=Math.min(TUTORIAL.length-1,tutorialStep+1);return render();}
  if(actionName==='tutorialStart'){selectedMode='solo';selectedExpansions.clear();selectedDifficulties={};return setRoute('#/setup');}
  if(actionName==='historyClear'){if(confirm('Delete all completed game summaries stored in this browser?')){clearHistory(localStorage);return render();}return;}
  if(actionName==='presetSave'){try{const preset=savePreset(localStorage,document.querySelector('#presetName')?.value,currentSetup());return render();}catch(e){return setError(e.message);}}
  if(actionName.startsWith('presetLoad:')){const preset=readPresets(localStorage).find(p=>p.id===actionName.slice(11));if(!preset)return setError('Saved setup not found');selectedExpansions=new Set(preset.config.expansions);selectedDifficulties={...preset.config.difficulties};return render();}
  if(actionName.startsWith('presetDelete:')){const id=actionName.slice(13);if(confirm('Delete this saved setup?')){deletePreset(localStorage,id);return render();}return;}
  if(actionName==='setup')return setRoute('#/setup');if(actionName==='roadmap')return setRoute('#/roadmap');if(actionName==='rules')return setRoute('#/rules');if(actionName==='joinPage')return setRoute('#/join');
  if(actionName==='solo'||actionName==='coop'){selectedMode=actionName;return setRoute('#/setup');}
  if(actionName==='chooseSolo'||actionName==='chooseCoop'){selectedMode=actionName==='chooseSolo'?'solo':'coop';return render();}
  if(actionName==='create')return create(selectedMode);if(actionName==='join')return join();
  if(actionName==='resume'){await refresh();if(!state)return;setRoute('#/game');return startStream();}
  if(actionName==='testBackend'&&USE_FIREBASE){try{const data=await firebase.testFirebase();return setError('Firebase anonymous session connected to '+data.projectId+'. Create a room to verify Firestore permissions.');}catch(e){return setError('Firebase connection failed: '+e.message);}}
  if(actionName==='testBackend'){try{const res=await fetch(`${base}/api/health`,{cache:'no-store'});const data=await res.json();if(!res.ok||data.ok!==true)throw Error('Server did not report healthy');return setError(`Multiplayer server is reachable (version ${data.version||'unknown'}).`);}catch(e){return setError('Cannot reach multiplayer server: '+e.message);}}
  if(actionName==='retryConnection'){return startStream();}
  if(actionName==='ready')return doRoom('ready',{ready:!state.room.ready[session.seat]});
  if(actionName==='start')return doRoom('start');
  if(actionName==='copyCode'||actionName==='copyInvite'){try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(actionName==='copyCode'?state.room.code:inviteLink(state.room.code));error=actionName==='copyCode'?'Room code copied.':'Invite link copied.';render();}catch{return setError('Clipboard permission unavailable. Select and copy the displayed code or invite link field instead.');}return;}
  if(actionName==='dialogClose'){if(state?.game?.phase!=='decision'||spellOpen)closeOptionalDialog();return;}
  if(actionName==='openSpells'){spellOpen=true;spellSelected.clear();return render();}
  if(actionName==='clearError'){error='';return render();}
  if(!state?.game)return;
  const g=state.game;if(state.room.seat!==g.active)return;
  if(g.phase==='draft'&&actionName.startsWith('draft:'))return action({type:'draft',id:actionName.slice(6)});
  if(actionName==='escape')return action({type:'escape'});
  if(actionName==='incubusActivate')return action({type:'incubusActivate'});
  if(actionName==='incubusCancel')return action({type:'incubusCancel'});
  if(actionName.startsWith('sphinxName:'))return action({type:'sphinxName',aspect:actionName.slice(11)});
  if(actionName==='sphinxConfirm')return action({type:'sphinxResolve',topId:effectPick,order:effectOrder});
  if(actionName==='diverContinue')return action({type:'diver',option:'continue'});
  if(actionName==='diverStop')return action({type:'diver',option:'stop',order:effectOrder.filter(id=>id!==g.pending.cards.at(-1).id)});
  if(actionName==='diverNightmare')return action({type:'diver',option:'nightmare',order:effectOrder});
  if(actionName==='confusionResolve')return action({type:'confusion',order:[...effectOrder]});
  if(actionName.startsWith('mirrorPlay:')){mirrorTarget=actionName.slice(11);mirrorPairSelection.clear();return render();}
  if(actionName==='mirrorCancel'){mirrorTarget=null;mirrorPairSelection.clear();return render();}
  if(actionName==='mirrorConfirm'){
    const m=mirrorTarget,ids=[...mirrorPairSelection];if(!m||ids.length!==2)return setError('Select exactly two eligible Location cards.');
    const candidates=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])];const cards=ids.map(id=>candidates.find(c=>c.id===id));
    if(cards.some(c=>!c||c.kind!=='location'||!(COLOR.includes(m)?c.color===m||c.color==='wild':m==='rainbow'?COLOR.includes(c.color):c.symbol===m)))return setError('Both cards must match the selected Mirror.');
    if(m==='rainbow'&&new Set([...(g.expansion?.mirrors?.stacks?.rainbow||[]).map(c=>c.color),...cards.map(c=>c.color)]).size!==(g.expansion?.mirrors?.stacks?.rainbow||[]).length+2)return setError('Rainbow requires four distinct colors.');
    const freeId=searchFreeId();mirrorTarget=null;mirrorPairSelection.clear();return action({type:'mirrorPair',mirror:m,ids,freeId});
  }
  if(actionName==='mirrorRewardConfirm'){const ids=[...mirrorSelection];mirrorSelection.clear();return action({type:'mirrorReward',ids,color:document.querySelector('#mirrorColor')?.value,freeId:searchFreeId()});}
  if(actionName.startsWith('mirror:'))return action({type:'nightmare',option:'mirror',denizenId:actionName.slice(7)});
  if(actionName.startsWith('happyBanish:'))return action({type:'happyDream',option:'banish',premonitionId:actionName.slice(12)});
  if(actionName==='happyPeek')return action({type:'happyDream',option:'peek'});
  if(actionName==='happyFetch')return action({type:'happyDream',option:'fetch'});
  if(actionName.startsWith('happyFetch:'))return action({type:'happyFetch',cardId:actionName.slice(11),freeId:searchFreeId()});
  if(actionName.startsWith('rally:'))return action({type:'rally',cardId:actionName.slice(6)});
  if(actionName.startsWith('premonitionPick:'))return action({type:'premonitionPick',id:actionName.slice(16)});
  if(actionName.startsWith('premonitionDoor:'))return action({type:'premonitionDoor',doorId:actionName.slice(16)});
  if(actionName.startsWith('effectDiscard:')){const id=actionName.slice(14);if(effectDiscards.has(id))effectDiscards.delete(id);else effectDiscards.add(id);return render();}
  if(actionName.startsWith('denizen:')){const id=actionName.slice(8),denizen=(g.expansion?.oniverse?.rallied||[]).find(d=>d.id===id);if(!denizen)return setError('Denizen unavailable');
    const ability=denizen.ability;if(['squirrel','harpoon','hammer'].includes(ability))return action({type:'useDenizen',id});
    const cards=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])];
    if(ability==='architect'||ability==='keeper'){
      const c=cards.find(x=>x.id===selected);if(!c)return setError('Select a Location from your hand or shared resources first.');return action({type:'useDenizen',id,cardId:c.id});
    }
    if(ability==='cyclobot'){
      const c=cards.find(x=>x.id===selected);if(!c||c.kind!=='location')return setError('Select a hand Location to exchange first.');
      cyclobotTarget=id;return render();
    }
  }
  if(actionName==='cyclobotCancel'){cyclobotTarget=null;return render();}
  if(actionName.startsWith('cyclobotSwap:')){
    if(!cyclobotTarget||!selected)return setError('Select a hand Location and a rallied Cyclobot first.');
    const denizenId=cyclobotTarget;cyclobotTarget=null;
    return action({type:'useDenizen',id:denizenId,cardId:selected,discardId:actionName.slice(14)});
  }
  if(actionName==='discardCancel'){swapDraft=null;return render();}
  if(actionName==='discardConfirm'){
    if(!swapDraft)return setError('Select a card to discard first.');
    const discardId=swapDraft.cardId,personal=document.querySelector('#swapPersonal')?.value||'',shared=document.querySelector('#swapShared')?.value||'';
    if(Boolean(personal)!==Boolean(shared))return setError('Select both a personal and shared card, or neither.');
    swapDraft=null;return action({type:'discard',id:discardId,...(personal&&shared?{swapWith:{personal,shared}}:{})});
  }
  if(actionName==='towerLeft'||actionName==='towerRight'){if(!selected)return setError('Choose a Tower.');return action({type:'playTower',id:selected,side:actionName==='towerLeft'?'left':'right'});}
  if(actionName==='play'||actionName==='discard'){
    if(!selected)return setError('Select a card first.');
    const c=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[]),...(g.mode==='solo'?g.expansion?.oniverse?.treasure||[]:[])].find(x=>x.id===selected);
    if(!c)return setError('Selected card is not available.');
    if(actionName==='play'&&g.players[g.active].labyrinth.at(-1)?.symbol===c.symbol)return setError('The next Location needs a different symbol.');
    const command={type:actionName,id:selected};
    if(actionName==='discard'&&g.mode==='coop'){swapDraft={cardId:selected};return render();}
    return action(command);
  }
  if(actionName.startsWith('doorSearch:')){const value=document.querySelector('#freeOnSearch')?.value,parts=actionName.split(':'),freeId=value===''||value===undefined?undefined:Number(value);if(parts[1]==='claim'&&freeId!==undefined){const target=g.pending?.targets?.find(t=>t.id===parts[2]);if(target?.source===`catch${freeId}`)return setError('You cannot free the same Dreamcatcher holding the selected Door. Choose a different catcher or no freeing.');}return action({type:'doorSearch',option:parts[1],doorId:parts[2],freeId});}
  if(actionName.startsWith('useKey:'))return action({type:'chooseDoor',keyId:actionName.slice(7)});
  if(actionName.startsWith('nightKey:'))return action({type:'nightmare',option:'key',cardId:actionName.slice(9)});
  if(actionName.startsWith('nightDoor:'))return action({type:'nightmare',option:'door',cardId:actionName.slice(10)});
  if(actionName==='nightReveal')return action({type:'nightmare',option:'reveal'});
  if(actionName==='nightHand')return action({type:'nightmare',option:'hand'});
  if(actionName.startsWith('prophecyDiscard:')){prophecyDiscard=actionName.slice(16);return render();}
  if(actionName.startsWith('prophecyUp:'))return moveProphecy(actionName.slice(11),-1);
  if(actionName.startsWith('prophecyDown:'))return moveProphecy(actionName.slice(13),1);
  if(actionName.startsWith('freeCatcher:'))return action({type:'freeCatcher',index:Number(actionName.slice(12))});
  if(actionName.startsWith('catchChoose:'))return action({type:'catchChoose',index:Number(actionName.slice(12))});
  if(actionName.startsWith('catchOverload:'))return action({type:'catchOverload',index:Number(actionName.slice(14))});
  if(actionName.startsWith('towerPenalty:'))return action({type:'towerPenalty',option:'discard',towerId:actionName.slice(13)});
  if(actionName==='towerFake')return action({type:'towerPenalty',option:'fake'});
  if(actionName.startsWith('spellCost:')){const id=actionName.slice(10);if(spellSelected.has(id))spellSelected.delete(id);else spellSelected.add(id);return render();}
  if(actionName==='castSpell'){const goals=state.game.expansion?.book?.goals||[];const a=Number(document.querySelector('#goalA')?.value)-1,b=Number(document.querySelector('#goalB')?.value)-1;return action({type:'cast',spell:spellChoice,costIds:[...spellSelected],...(spellChoice==='parallel'?{first:a,second:b}:{})});}
  if(actionName.startsWith('effectPick:')){effectPick=actionName.slice(11);return render();}
  if(actionName.startsWith('effectUp:')||actionName.startsWith('effectDown:')){const id=actionName.split(':')[1],i=effectOrder.indexOf(id),j=i+(actionName.startsWith('effectUp:')?-1:1);if(i>=0&&j>=0&&j<effectOrder.length)[effectOrder[i],effectOrder[j]]=[effectOrder[j],effectOrder[i]];return render();}
  if(actionName.startsWith('moduleDecision:'))return action({type:'moduleDecision',decisionId:g.pending.id,choice:decodeURIComponent(actionName.slice(15))});
  if(actionName==='effectConfirm'){const p=state.game.pending;const cards=p.cards;if(p.type==='happyPeek')return action({type:'happyPeek',discardIds:[...effectDiscards],order:effectOrder.filter(id=>!effectDiscards.has(id))});if(p.type==='denizenPeek')return action({type:'denizenPeek',order:effectOrder});return p.type==='towerLook'?action({type:'towerLook',order:effectOrder}):p.type==='spellPeek'?action({type:'spellPeek',topId:effectPick,bottomOrder:effectOrder.filter(id=>id!==effectPick)}):action({type:'incantation',doorId:effectPick||undefined,order:effectOrder.filter(id=>id!==effectPick)});}
  if(actionName==='prophecyConfirm'){if(!prophecyDiscard)return setError('Choose one card to discard.');return action({type:'prophecy',discardId:prophecyDiscard,order:prophecyOrder.filter(id=>id!==prophecyDiscard)});}
}
// Interaction adapter: gestures never mutate state. They produce the same
// validated play/discard commands as the original buttons.
let tabletopController=null,dialogController=null;
function installTabletopController(){
  if(typeof createTabletopInteractions!=='function')return; // lightweight legacy UI test harness
  tabletopController=createTabletopInteractions({
    root:app,getGame:()=>state?.game,getSeat:()=>state?.room?.seat??-1,
    isBusy:()=>busy||!state?.room?.started,
    onSelect:id=>{if(page==='#/game'&&state?.game&&['solo','coop'].includes(state.game.mode))pick(id);},
    onCommand:(type,id)=>{
      if(page!=='#/game'||busy||!state?.game)return;
      const targets=state.game.mode==='coop'?cooperativeLegalTargets(state.game,id,state.room?.seat):soloLegalTargets(state.game,id,state.room?.seat);
      if(!targets.includes(type))return;
      if(type==='discard'&&state.game.mode==='coop'){selected=id;swapDraft={cardId:id};return render();}
      if(type==='towerLeft'||type==='towerRight')return action({type:'playTower',id,side:type==='towerLeft'?'left':'right'});
      return action({type,id});
    }
  });
  createDecisionReorder({root:app,
    canReorder:kind=>!busy&&page==='#/game'&&state?.game?.phase==='decision'&&state.room?.seat===state.game.active&&['effect','prophecy'].includes(kind),
    onReorder:(kind,from,to)=>{
      if(busy||state?.game?.phase!=='decision'||state.room?.seat!==state.game.active)return;
      if(kind==='prophecy'&&state.game.pending?.type==='prophecy')prophecyOrder=moveOrderedCard(prophecyOrder,from,to);
      else if(kind==='effect'&&state.game.pending?.type!=='prophecy')effectOrder=moveOrderedCard(effectOrder,from,to);
      else return;
      render();
    }
  });
}
app.addEventListener('input',e=>{if(e.target?.id==='name')playerDisplayName=String(e.target.value).slice(0,40);if(e.target?.id==='joinname')partnerDisplayName=String(e.target.value).slice(0,40);});
app.addEventListener('change',e=>{if(e.target?.dataset?.mirrorPair){if(e.target.checked)mirrorPairSelection.add(e.target.dataset.mirrorPair);else mirrorPairSelection.delete(e.target.dataset.mirrorPair);return;}if(e.target?.dataset?.mirrorChoice){if(e.target.checked)mirrorSelection.add(e.target.dataset.mirrorChoice);else mirrorSelection.delete(e.target.dataset.mirrorChoice);return;}if(e.target?.dataset?.expansion){const id=e.target.dataset.expansion;if(e.target.checked){if(id==='incubus')selectedExpansions.clear();else selectedExpansions.delete('incubus');selectedExpansions.add(id);}else{selectedExpansions.delete(id);delete selectedDifficulties[id];}return render();}if(e.target?.dataset?.difficulty){selectedDifficulties[e.target.dataset.difficulty]=e.target.value;return render();}if(e.target?.dataset?.spellChoice){spellChoice=e.target.value;spellSelected.clear();return render();}const key=e.target?.dataset?.setting;if(!['theme','motion','cardSize','contrast','textSize'].includes(key))return;const value=e.target.value;if(key==='theme'&&!THEME_PRESETS.some(t=>t.id===value))return;if(key==='motion'&&!['normal','reduced'].includes(value))return;if(key==='cardSize'&&!['normal','large'].includes(value))return;if(key==='contrast'&&!['normal','high'].includes(value))return;if(key==='textSize'&&!['normal','large'].includes(value))return;uiSettings[key]=value;localStorage.setItem(SETTINGS_KEY,JSON.stringify(uiSettings));applySettings();render();});
app.addEventListener('click',e=>{
  if(e.target.closest?.('[data-game-menu-dismiss]')){handle('closeGameOverlay');return;}
  const target=e.target.closest('[data-action],[data-pick]');if(!target)return;
  if(gameOverlay&&!target.closest?.('[data-game-menu-dialog]'))return;
  if(target.dataset.pick){if(state?.game?.phase==='draft')handle(`draft:${target.dataset.pick}`);else pick(target.dataset.pick);return;}
  handle(target.dataset.action);
});
app.addEventListener('keydown',e=>{
  const popup=app.querySelector?.('[data-game-menu-dialog]');if(!popup)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation?.();handle('closeGameOverlay');return;}
  if(e.key!=='Tab')return;
  const items=[...(popup.querySelectorAll?.('button:not([disabled]),a[href],summary,select:not([disabled]),[tabindex]:not([tabindex="-1"])')||[])].filter(el=>el.getClientRects?.().length!==0);
  if(!items.length){e.preventDefault();popup.focus();return;}
  const first=items[0],last=items.at(-1),active=document.activeElement;
  if(e.shiftKey&&(active===first||!popup.contains(active))){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(active===last||!popup.contains(active))){e.preventDefault();first.focus();}
},true);
addEventListener('hashchange',render);
addEventListener('online',()=>{if(session&&!IS_LOCAL_SOLO())startStream();});
addEventListener('pageshow',e=>{if(e.persisted&&session&&!IS_LOCAL_SOLO())startStream();});
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden&&session&&!IS_LOCAL_SOLO()&&streamAbort===null)startStream();});
render();installTabletopController();if(typeof createDialogController==='function')dialogController=createDialogController({root:app,onDismiss:closeOptionalDialog});dialogController?.sync();if(STATIC_SITE){import('./engine/game.js').then(async m=>{localEngine=m;if(session?.id==='local')return refresh();if(session&&CAN_MULTIPLAYER){await refresh();if((location.hash||'#/')==='#/game')startStream();}}).catch(e=>setError('Unable to load rules engine: '+e.message));}else if(session){refresh().then(()=>{if((location.hash||'#/')==='#/game')startStream();});}

// Phase 1: attach layout metrics after orientation changes without changing game commands.
addEventListener('resize',()=>{if(page==='#/game'&&state?.room.started){applyTabletopMetrics(app.querySelector?.('.tt2-root'),{mode:state.game.mode,expansions:state.game.config?.expansions||[]});fitGameTabletop();}});
