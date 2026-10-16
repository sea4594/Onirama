import {icon} from './icons.js';
import {cleanConfig,readHistory,recordResult,summarizeHistory,readPresets,savePreset,deletePreset,clearHistory} from './guest-data.js';
import * as firebase from './firebase-room.js';
import {renderCard} from './tabletop/cards.js';
import {renderSpellbook,spellEligibility} from './tabletop/spellbook.js';
import {createCardInspector,cardHelp} from './tabletop/card-inspection.js';
import {applyTabletopMetrics} from './tabletop/layout.js';
import {fitTabletop} from './tabletop/fit.js';
import {renderSoloTabletop} from './tabletop/solo-board.js';
import {renderCooperativeTabletop} from './tabletop/coop-board.js';
import {createTabletopInteractions,soloLegalTargets,cooperativeLegalTargets,createDecisionReorder,moveOrderedCardToGap,restoreDiscardedCardToGap} from './tabletop/interactions.js';
import {decisionDialogKey,createDialogController} from './tabletop/dialogs.js';
import {renderActionDock,renderPileInspector} from './tabletop/action-dock.js';
import {createTabletopAnimator} from './tabletop/animation.js';
import {renderOverlay} from './game-overlay.js';
import {GUIDE_CHAPTERS,renderRulesReference,renderGuideTutorial,filterGuide} from './rules-guide.js';
import {opponentReplay,replayOverlay,fitReplay,replayStage,replayCaption} from './multiplayer-replay.js';
const app=document.querySelector('#app');
const STATIC_SITE=location.hostname.endsWith('.github.io')||(typeof window!=='undefined'&&window.ONIRAMA_STATIC_BUILD===true);
const REMOTE_API=typeof window!=='undefined'&&typeof window.ONIRAMA_API_ORIGIN==='string'&&/^https:\/\/[^/]+$/.test(window.ONIRAMA_API_ORIGIN)?window.ONIRAMA_API_ORIGIN:'';
const base=STATIC_SITE?REMOTE_API:location.origin;
const USE_FIREBASE=firebase.firebaseConfigured();
const CAN_MULTIPLAYER=USE_FIREBASE||!STATIC_SITE||!!REMOTE_API;
const BUILD_COMMIT=typeof window!=='undefined'&&/^[a-f0-9]{40}$/.test(window.ONIRAMA_BUILD_COMMIT||'')?window.ONIRAMA_BUILD_COMMIT:null;
const IS_LOCAL_SOLO=()=>session?.id==='local'&&STATIC_SITE;
const IS_HOTSEAT=()=>session?.id==='hotseat';
const IS_LOCAL_GAME=()=>IS_LOCAL_SOLO()||IS_HOTSEAT();
let localEngine=null;
const COLOR=['red','blue','green','brown'];
const EXP=[['Book of Steps','P4','book'],['Glyphs','P4','glyphs'],['Dreamcatchers','P4','dreamcatchers'],['Towers','P4','towers'],['Happy Dreams / Premonitions','P5','premonitions'],['Crossroads / Dead Ends','P5','crossroads'],['Door to the Oniverse','P5','oniverse'],['Mirrors (promo)','P6','mirrors'],['Sphinx / Diver / Confusion','P6','sphinx'],['Little Incubus','P6','incubus']];
let mirrorSelection=new Set(),mirrorTarget=null,mirrorPairSelection=new Set(),cyclobotTarget=null,spellOpen=false;
let denizenIntent=null,premonitionKeysSelected=new Set(),happyPremonitionChoice=null,happyBanishMode=false,nightChoice=null,choicePage=0,spellGoals=[],swapPersonalId=null,swapSharedId=null,freeSearchId="";
let session=null;try{const saved=JSON.parse(localStorage.getItem('onirama.session')||'null');if(saved&&typeof saved.id==='string'&&saved.id.length<64&&(['local','hotseat'].includes(saved.id)||typeof saved.token==='string'||saved.transport==='firebase'))session=saved;}catch{localStorage.removeItem('onirama.session');}
if(STATIC_SITE&&USE_FIREBASE&&!['local','hotseat'].includes(session?.id)&&session?.transport!=='firebase'){session=null;localStorage.removeItem('onirama.session');}
let selectedExpansions=new Set(),selectedDifficulties={},spellSelected=new Set(),spellChoice='parallel',effectOrder=[],effectPick=null,incantationStage='claim',effectDiscards=new Set();
const THEME_PRESETS=[{id:'forest',name:'Forest'},{id:'moonlit',name:'Moonlit'},{id:'copper',name:'Copper'},{id:'lagoon',name:'Lagoon'},{id:'heather',name:'Heather'},{id:'sandstone',name:'Sandstone'}];
const SETTINGS_KEY='onirama.ui.settings.v1';
const SESSION_META_KEY='onirama.guest.current.v1';
let tutorialStep=0,tutorialChapter=0,lastAnnouncement='';
let gameOverlay=null,gameRulesFromPause=false,overlayReturnAction=null,pileOpen=null,doorSearchIntent=null,doorSearchChromatic=false,failsafeChoosing=false;
let searchFreeIntent=null,happyFetchSelection=null,lastInputWasKeyboard=false;
let replayFrames=[],replayIndex=0,replayPlaying=false,replayTimer=null,replayAnimator=null;
let reconnectAttempts=0;
function readSettings(){try{const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return {theme:THEME_PRESETS.some(p=>p.id===raw.theme)?raw.theme:'forest',motion:raw.motion==='reduced'?'reduced':'normal',cardSize:raw.cardSize==='large'?'large':'normal',contrast:raw.contrast==='high'?'high':'normal',textSize:raw.textSize==='large'?'large':'normal'};}catch{return {theme:'forest',motion:'normal',cardSize:'normal',contrast:'normal',textSize:'normal'};}}
let uiSettings=readSettings();
let playerDisplayName='',partnerDisplayName='',hotseatName1='',hotseatName2='',multiplayerTab='online',joinCode='',passDevice=session?.id==='hotseat';
function applySettings(){const preset=THEME_PRESETS.find(p=>p.id===uiSettings.theme)||THEME_PRESETS[0];Object.assign(document.documentElement.dataset,{theme:preset.id,motion:uiSettings.motion,cardSize:uiSettings.cardSize,contrast:uiSettings.contrast,textSize:uiSettings.textSize});const meta=document.querySelector('meta[name="theme-color"]');if(meta&&typeof getComputedStyle==='function')meta.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim());}
applySettings();
let state=null,selected=null,error='',busy=false,online=false,streamAbort=null,streamRetry=null,version=0,selectedMode='solo',page=location.hash||'#/';
const roomCodeFromHash=()=>{const match=location.hash.match(/^#\/join\?code=([A-Za-z]{4}|[a-fA-F0-9]{8})$/);return match?match[1].toUpperCase():'';};
const inviteLink=code=>`${location.origin}${location.pathname}${location.search}#/join?code=${encodeURIComponent(code)}`;
function cancelStream(){streamAbort?.abort();streamAbort=null;if(streamRetry!==null){clearTimeout(streamRetry);streamRetry=null;}}
function stopReplay(){if(replayTimer!==null)clearTimeout(replayTimer);replayTimer=null;replayFrames=[];replayIndex=0;replayPlaying=false;replayAnimator?.reset?.();replayAnimator=null;}
function retryStream(){if(!session||IS_LOCAL_GAME()||streamRetry!==null)return;streamAbort?.abort();streamAbort=null;const wait=Math.min(18000,1250*2**Math.min(4,reconnectAttempts++));streamRetry=setTimeout(()=>{streamRetry=null;if(session)startStream();},wait);}
function nextReplay(){if(!replayFrames.length)return;replayIndex=Math.min(replayIndex+1,replayFrames.length-1);updateReplayStage();}
function scheduleReplay(){if(!replayPlaying)return;if(replayTimer!==null)clearTimeout(replayTimer);if(replayIndex===replayFrames.length-1){replayPlaying=false;updateReplayStage();return;}replayTimer=setTimeout(()=>{replayTimer=null;nextReplay();scheduleReplay();},850);}
function updateReplayStage(){const layer=app.querySelector?.('[data-replay-layer]'),entry=replayFrames[replayIndex];if(!layer||!entry)return;replayAnimator?.before?.(entry.frame,'replay','#/game');const stage=layer.querySelector('[data-replay-stage]');if(!stage)return;stage.innerHTML=replayStage(entry,state?.room?.seat??0);fitReplay(layer,entry);replayAnimator?.after?.(entry.frame,'replay','#/game');const count=layer.querySelector('.tt9-replay-count');if(count)count.textContent=`${replayIndex+1}/${replayFrames.length} · ${replayCaption(entry)}`;const buttons=['replayPrev','replayNext','replayPlay'].map(key=>layer.querySelector(`[data-action="${key}"]`));if(buttons[0])buttons[0].disabled=replayIndex===0;if(buttons[1])buttons[1].disabled=replayIndex===replayFrames.length-1;if(buttons[2])buttons[2].textContent=replayPlaying?'Pause':'Play';}

const newId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
function sessionMeta(){if(!session)return null;try{const meta=JSON.parse(localStorage.getItem(SESSION_META_KEY)||'null');if(meta?.roomId===session.id&&typeof meta.gameId==='string')return meta;}catch{}const meta={roomId:session.id,gameId:newId(),startedAt:Date.now()};localStorage.setItem(SESSION_META_KEY,JSON.stringify(meta));return meta;}
function beginGuestSession(){if(!session)return;localStorage.setItem(SESSION_META_KEY,JSON.stringify({roomId:session.id,gameId:newId(),startedAt:Date.now()}));}
function recordCurrentResult(){if(!state?.game||!['won','lost'].includes(state.game.status))return;try{const meta=sessionMeta();recordResult(localStorage,{id:meta.gameId,mode:state.game.mode,status:state.game.status,turn:state.game.turn,config:state.game.config,startedAt:meta.startedAt});}catch(e){console.warn('Unable to save guest result',e);}}
function announceCurrent(){const g=state?.game;if(!g)return;const key=`${g.status}:${g.phase}:${g.turn}:${g.active}:${g.pending?.type||''}`;if(key===lastAnnouncement)return;lastAnnouncement=key;const el=document.querySelector('#sr-announcer');if(el)el.textContent=g.status==='won'?'Game won. All objectives met.':g.status==='lost'?'Game lost.':g.phase==='decision'?'An effect needs a decision.':`Turn ${g.turn}: ${g.players[g.active]?.name||'Player'} to act.`;}
function currentSetup(){return cleanConfig({expansions:[...selectedExpansions],difficulties:Object.fromEntries(Object.entries(selectedDifficulties).filter(([id,v])=>selectedExpansions.has(id)&&v!=='normal'))});}

const escape=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,klass='')=>`<button type="button" class="${klass}" data-action="${action}">${label}</button>`;
const card=(c,options={})=>renderCard(c,{...options,selectedId:selected});
function nav(){return `<header class="nav shell-nav"><a class="brand" href="#/" aria-label="Onirama home"><img class="brand-icon" src="./icons/icon-64.png" width="24" height="24" alt="" aria-hidden="true"><span>ONIRAMA</span></a><div class="nav-right"><a href="#/rules" title="Rules" aria-label="Rules">${icon('help')}</a><a href="#/settings" title="Settings" aria-label="Settings">${icon('settings')}</a></div></header>`;}
function bottomNav(){if(page==='#/game')return '';const entries=[['#/','Single Player','single'],['#/multiplayer','Multiplayer','users'],['#/settings','Settings','settings']];const active=page==='#/multiplayer'||page.startsWith('#/join')?'#/multiplayer':(page==='#/settings'||page==='#/history'||page==='#/roadmap')?'#/settings':'#/';return `<nav class="bottom-nav" aria-label="Primary">${entries.map(([url,label,iconName])=>`<a href="${url}" class="bottom-nav-item${active===url?' active':''}" ${active===url?'aria-current="page"':''}><span aria-hidden="true" class="bottom-icon">${icon(iconName)}</span><span>${label}</span></a>`).join('')}</nav>`;}
function setRoute(path){if(path!=='#/game'){stopReplay();gameOverlay=null;gameRulesFromPause=false;pileOpen=null;failsafeChoosing=false;}location.hash=path;page=path;render();}
function setError(msg){error=msg;render();}
async function api(route,method='GET',body=null){
  const headers={'Content-Type':'application/json'};if(session?.token)headers.Authorization=`Bearer ${session.token}`;
  if(!base)throw Error('Multiplayer backend is not configured. See Settings for deployment instructions.');
  const res=await fetch(`${base}${route}`,{method,headers,body:body?JSON.stringify(body):undefined});const data=await res.json();
  if(!res.ok)throw Error(data.error||'Request failed');return data;
}
async function refresh(){if(IS_LOCAL_GAME()){
 const hot=IS_HOTSEAT(),key=hot?'onirama.hotseat.v1':'onirama.solo.v1',raw=localStorage.getItem(key);
 if(!raw){session=null;state=null;localStorage.removeItem('onirama.session');error='The active saved game is missing. You can start a new game or resume another save.';setRoute('#/');return;}
 if(!localEngine)return;
 try{
  const game=JSON.parse(raw);if(game?.mode!==(hot?'coop':'solo')||![0,1].includes(game.active)||!Array.isArray(game.players))throw Error('Unrecognized saved game');
  const seat=hot?game.active:0,view=localEngine.viewFor(game,seat);
  state={room:{seat,mode:hot?'coop':'solo',started:true,hotseat:hot,host:true},game:view,version:(version||0)+1};
  session={id:hot?'hotseat':'local',seat};online=true;error='';sessionMeta();recordCurrentResult();render();announceCurrent();
 }catch(e){console.error('Unable to resume local game',e);session=null;state=null;version=0;localStorage.removeItem('onirama.session');error='Cannot open this saved game ('+e.message+'). The save has been preserved; you can start a new game or resume the other save.';setRoute('#/');}
 return;
 }if(!session)return;const roomId=session.id,credential=session.token;try{const data=session.transport==='firebase'?await firebase.loadRoom(roomId):await api(`/api/rooms/${roomId}/state`);if(session?.id!==roomId||session?.token!==credential)return;if(Number.isInteger(data.version)&&data.version>=version){if(data.room?.ended){closeEndedRoom();return;}state=data;version=data.version;error='';if(data.room?.started&&page==='#/multiplayer')setRoute('#/game');recordCurrentResult();render();announceCurrent();}}catch(e){if(session?.id===roomId&&session?.token===credential)setError(e.message);}}
function closeEndedRoom(){stopReplay();cancelStream();session=null;state=null;version=0;localStorage.removeItem('onirama.session');gameOverlay=null;error='The host ended the lobby.';setRoute('#/multiplayer');}
async function departRoom(end=false){
 if(!session||['local','hotseat'].includes(session.id))return;
 if(end&&!state?.room?.host)return setError('Only the host can end the game.');
 if(end&&!confirm('End the game for both players?'))return;
 if(busy)return;busy=true;
 try{
  if(session.transport==='firebase'){if(end)await firebase.firebaseEnd(session.id);else await firebase.firebaseLeave(session.id);}
  else await api(`/api/rooms/${session.id}/${end?'end':'leave'}`,'POST',{});
  stopReplay();cancelStream();session=null;state=null;version=0;gameOverlay=null;localStorage.removeItem('onirama.session');setRoute('#/');
 }catch(e){setError(e.message);}finally{busy=false;render();}
}
function saveSession(o){stopReplay();cancelStream();state=null;version=0;session={id:o.room.id,token:o.token||'',seat:o.room.seat,...(o.transport==='firebase'?{transport:'firebase',uid:o.uid}: {})};localStorage.setItem('onirama.session',JSON.stringify(session));}
async function create(mode,repeatConfig=null){
  const name=mode==='solo'?'You':(document.querySelector('#name')?.value||playerDisplayName||'').trim();if(mode==='coop'&&!name)return setError('Enter a display name to host.');const config=repeatConfig||{ruleset:'official',expansions:[...selectedExpansions],difficulties:Object.fromEntries(Object.entries(selectedDifficulties).filter(([id,value])=>selectedExpansions.has(id)&&value!=='normal'))};busy=true;render();
  try{if(STATIC_SITE&&mode==='solo'){cancelStream();localEngine??=await import('./engine/game.js');const game=localEngine.newGame({mode:'solo',config,interactiveDraw:true,names:['You']});localStorage.setItem('onirama.solo.v1',JSON.stringify(game));session={id:'local',seat:0};localStorage.setItem('onirama.session',JSON.stringify(session));beginGuestSession();await refresh();setRoute('#/game');return;}const o=mode==='coop'&&USE_FIREBASE?{...(await firebase.createFirebaseRoom(name,config)),transport:'firebase',uid:await firebase.getFirebaseUid()}:await api(mode==='solo'?'/api/solo':'/api/rooms','POST',{name,config});saveSession(o);beginGuestSession();await refresh();setRoute(mode==='coop'?'#/multiplayer':'#/game');startStream();}
  catch(e){setError(e.message);}finally{busy=false;render();}
}
async function join(){const code=(document.querySelector('#roomcode')?.value||joinCode||roomCodeFromHash()).trim().toUpperCase();const name=(document.querySelector('#joinname')?.value||partnerDisplayName||'').trim();
  if(!name)return setError('Enter a display name to join.');
  if(!CAN_MULTIPLAYER)return setError('Multiplayer is not configured yet. Redeploy GitHub Pages with the built-in Firebase configuration.');
  if(!/^(?:[A-Za-z]{4}|[a-fA-F0-9]{8})$/.test(String(code||'').trim()))return setError('Enter a four-letter room code.');
  try{const o=USE_FIREBASE?{...(await firebase.joinFirebaseRoom(code,name)),transport:'firebase',uid:await firebase.getFirebaseUid()}:await api('/api/join','POST',{code,name});saveSession(o);await refresh();setRoute('#/multiplayer');startStream();}catch(e){setError(e.message);}
}
async function doRoom(operation,body={}){if(busy)return;busy=true;try{if(session.transport==='firebase'){if(operation==='ready')await firebase.firebaseReady(session.id,body.ready);else if(operation==='setup')await firebase.firebaseSetup(session.id,body.config);else if(operation==='start')await firebase.firebaseStart(session.id);else if(operation==='restart')await firebase.firebaseRestart(session.id);else throw Error('Unsupported room action');}else await api(`/api/rooms/${session.id}/${operation}`,'POST',body);await refresh();}catch(e){setError(e.message);}finally{busy=false;render();}}
async function action(command){if(busy||state?.room?.paused||state?.room?.ended)return;busy=true;render();try{if(IS_LOCAL_GAME()){localEngine??=await import('./engine/game.js');const hot=IS_HOTSEAT(),storeKey=hot?'onirama.hotseat.v1':'onirama.solo.v1',original=JSON.parse(localStorage.getItem(storeKey)),wasActive=original.active;const updated=localEngine.act(original,command);localEngine.assertConserved(updated);localStorage.setItem(storeKey,JSON.stringify(updated));if(hot&&updated.active!==wasActive)passDevice=true;selected=null;mirrorTarget=null;cyclobotTarget=null;denizenIntent=null;premonitionKeysSelected.clear();spellOpen=false;spellSelected.clear();effectOrder=[];effectPick=null;incantationStage='claim';effectDiscards.clear();nightChoice=null;happyPremonitionChoice=null;happyBanishMode=false;choicePage=0;spellGoals=[];swapPersonalId=null;swapSharedId=null;freeSearchId='';doorSearchIntent=null;doorSearchChromatic=false;failsafeChoosing=false;searchFreeIntent=null;happyFetchSelection=null;await refresh();return;}if(session.transport==='firebase')await firebase.firebaseAction(session.id,version,command);else await api(`/api/rooms/${session.id}/action`,'POST',{expectedVersion:version,command});selected=null;mirrorTarget=null;cyclobotTarget=null;denizenIntent=null;premonitionKeysSelected.clear();spellOpen=false;spellSelected.clear();effectOrder=[];effectPick=null;incantationStage='claim';effectDiscards.clear();nightChoice=null;happyPremonitionChoice=null;happyBanishMode=false;choicePage=0;spellGoals=[];swapPersonalId=null;swapSharedId=null;freeSearchId='';doorSearchIntent=null;doorSearchChromatic=false;failsafeChoosing=false;searchFreeIntent=null;happyFetchSelection=null;await refresh();}catch(e){setError(e.message);await refresh();}finally{busy=false;render();}}
async function startStream(){
  if(IS_LOCAL_GAME()){cancelStream();online=true;render();return;}
  if(session?.transport==='firebase'){
    cancelStream();const controller=new AbortController(),roomId=session.id,uid=session.uid;streamAbort=controller;online=false;render();
    try{const unsubscribe=await firebase.watchFirebaseRoom(roomId,data=>{if(controller.signal.aborted||session?.id!==roomId||session?.uid!==uid)return;if(data.version>=version){if(data.room?.ended){closeEndedRoom();return;}state=data;version=data.version;error='';online=true;reconnectAttempts=0;if(data.room?.started&&page==='#/multiplayer')setRoute('#/game');recordCurrentResult();render();announceCurrent();}},e=>{if(controller.signal.aborted)return;online=false;console.warn('Realtime Firebase connection lost',e);render();retryStream();});
      if(controller.signal.aborted){unsubscribe();return;}controller.signal.addEventListener('abort',unsubscribe,{once:true});
    }catch(e){if(!controller.signal.aborted){online=false;console.warn('Unable to connect to Firebase',e);render();retryStream();}}return;
  }
  cancelStream();if(!session||!base)return;
  const roomId=session.id,credential=session.token,controller=new AbortController();streamAbort=controller;online=false;render();
  try{
    const response=await fetch(`${base}/api/rooms/${roomId}/stream`,{headers:{Authorization:`Bearer ${credential}`},signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw Error(response.status===401?'Session expired or seat unavailable':'Connection unavailable');
    if(!response.body)throw Error('Streaming unsupported');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';online=true;reconnectAttempts=0;render();
    while(!controller.signal.aborted){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      const chunks=buffer.split('\n\n');buffer=chunks.pop()||'';
      if(buffer.length>262144)throw Error('Event exceeds maximum size');
      for(const chunk of chunks){const line=chunk.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;
        if(controller.signal.aborted||session?.id!==roomId||session?.token!==credential)return;
        // Fetch the version and filtered state together, never pair an event with a stale version.
        const fresh=await api(`/api/rooms/${roomId}/state`);
        if(controller.signal.aborted||session?.id!==roomId||session?.token!==credential)return;
        if(Number.isInteger(fresh.version)&&fresh.version>=version){if(fresh.room?.ended){closeEndedRoom();return;}state=fresh;version=fresh.version;error='';if(fresh.room?.started&&page==='#/multiplayer')setRoute('#/game');recordCurrentResult();render();announceCurrent();}
      }
    }
  }catch(e){if(!controller.signal.aborted&&session?.id===roomId){online=false;render();}}
  finally{if(!controller.signal.aborted&&session?.id===roomId&&session?.token===credential){online=false;render();
      retryStream();
    }}
}

function home(){const active=session?.id==='local',offline=navigator.onLine===false;const soloSave=session?.id!=='local'&&localStorage.getItem('onirama.solo.v1');const hotSave=session?.id!=='hotseat'&&localStorage.getItem('onirama.hotseat.v1');return `<div class="route shell shell-home">
  <div class="shell-emblem" aria-hidden="true"><span>${icon('sun')}</span><span>${icon('moon')}</span><span>${icon('key')}</span><span>${icon('door')}</span></div>
  <h1 class="shell-hero-title">Single Player</h1>
  <div class="shell-primary-actions">
    ${btn('Play solo','setup','primary shell-big')}
    ${session&&(!offline||IS_LOCAL_GAME())?btn('Resume game','resume','shell-small'):''}${soloSave?btn('Resume saved solo','resumeLocalSolo','shell-small'):''}${hotSave?btn('Resume saved hot seat','resumeLocalHotseat','shell-small'):''}
  </div>
  <div class="shell-links">${btn('Learn to play','tutorial','shell-text-button')}${btn('History','history','shell-text-button')}</div>
</div>`;}
function codeInputs(){const value=joinCode||roomCodeFromHash();return `<div class="shell-code-boxes" role="group" aria-label="Four-letter lobby code"><input id="roomcode" type="hidden" value="${escape(value)}">${Array.from({length:4},(_,i)=>`<input type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="1" data-code-index="${i}" aria-label="Code letter ${i+1}" value="${escape(value[i]||'')}">`).join('')}</div>`;}
function multiplayer(){const hot=multiplayerTab==='hotseat',offline=navigator.onLine===false,room=session?.id!=='local'&&session?.id!=='hotseat'&&state?.room&&!state.room.started?state.room:null;
 const tab=`<div class="shell-segment shell-multiplayer-tabs" role="tablist" aria-label="Multiplayer mode"><button type="button" data-action="multiplayerTab:online" role="tab" aria-selected="${!hot}" class="${!hot?'active':''}">Online</button><button type="button" data-action="multiplayerTab:hotseat" role="tab" aria-selected="${hot}" class="${hot?'active':''}">Hot seat</button></div>`;
 if(hot)return `<div class="route shell shell-multiplayer"><h1 class="shell-title">Multiplayer</h1>${tab}<section class="shell-card shell-hotseat-players"><h2>Players</h2><div class="shell-dual"><label>Player 1<input class="inline-input" id="hotseatName1" placeholder="Display name" maxlength="40" value="${escape(hotseatName1)}"></label><label>Player 2<input class="inline-input" id="hotseatName2" placeholder="Display name" maxlength="40" value="${escape(hotseatName2)}"></label></div><p>Players share a device. The screen is hidden between turns and during drafting.</p></section>${setupOptions()}</div>`;
 if(room){if(!room.host){selectedExpansions=new Set(room.config?.expansions||[]);selectedDifficulties={...room.config?.difficulties};}return `<div class="route shell shell-multiplayer"><h1 class="shell-title">Multiplayer</h1>${tab}<div class="shell-online-rooms"><section class="shell-card shell-active-room"><div><small>${room.host?'Your lobby':'Joined lobby'}</small><h2 class="shell-active-code">${escape(room.code)}</h2><p>${room.connected?.filter(Boolean).length||0}/2 players connected</p></div><div>${btn('Copy code','copyCode')}${room.host?btn('End lobby','endRoom','shell-danger'):btn('Leave lobby','leaveRoom','shell-danger')}</div></section></div><section class="shell-card shell-lobby-players">${[0,1].map(i=>`<div class="shell-seat ${room.ready[i]?'ready':''}"><strong>${i===0?'Host':'Guest'}</strong><span>${room.connected[i]?(i===(room.hostSeat??0)?'Hosting':room.ready[i]?'Ready':'Not ready'):'Waiting to join'}</span></div>`).join('')}</section>${setupOptions({locked:!room.host,config:room.config})}${room.host?`<p class="shell-hint">Changing expansions resets the guest's readiness.</p>`:'<p class="shell-hint">The host controls expansion selection.</p>'}</div>`;}
 return `<div class="route shell shell-multiplayer"><h1 class="shell-title">Multiplayer</h1>${tab}<div class="shell-dual shell-online-rooms"><section class="shell-card shell-room"><h2>Host a lobby</h2><div class="shell-code-preview" aria-label="Your lobby code will appear here">${Array.from({length:4},()=>'<span>—</span>').join('')}</div><label for="name">Display name</label><input id="name" class="inline-input" maxlength="40" placeholder="Your name" value="${escape(playerDisplayName)}" autocomplete="nickname"><button type="button" class="primary shell-wide" data-action="coopStart" ${playerDisplayName.trim()&&!offline?'':'disabled'}>Create code</button></section><section class="shell-card shell-room"><h2>Join a lobby</h2>${codeInputs()}<label for="joinname">Display name</label><input id="joinname" class="inline-input" maxlength="40" placeholder="Your name" value="${escape(partnerDisplayName)}" autocomplete="nickname"><button type="button" class="primary shell-wide" data-action="join" ${partnerDisplayName.trim()&&!offline?'':'disabled'}>Join</button></section></div>${offline?'<p class="shell-hint" role="status">Offline: solo and hot seat still work; online multiplayer requires a connection.</p>':!CAN_MULTIPLAYER?'<p class="shell-hint">Online rooms require the multiplayer service to be configured.</p>':''}${setupOptions()}<p class="shell-hint">Choose your expansions before creating a code. The host can adjust them in the lobby.</p></div>`;
}
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
function setupOptions({locked=false,config=null}={}){const enabled=new Set(config?.expansions||[...selectedExpansions]),levels=config?.difficulties||selectedDifficulties,activeCount=enabled.size;
 return `<section class="shell-card shell-expansion-setup"><div class="shell-title-line"><h2 class="shell-section-title">Expansions</h2><span class="shell-count">${activeCount} selected</span></div>
 <div class="shell-expansion-grid">${EXP.map(([name,phase,id])=>`<div class="shell-expansion-entry"><label class="shell-expansion-choice"><input type="checkbox" data-expansion="${id}" ${locked?'disabled':''} ${enabled.has(id)?'checked':''}><span>${escape(({premonitions:'Happy Dreams & Premonitions',crossroads:'Crossroads & Dead Ends',sphinx:'Sphinx, Diver & Confusion'}[id])||name.replace(' (promo)',''))}</span></label>${enabled.has(id)&&['book','dreamcatchers','towers','premonitions','crossroads','mirrors','incubus'].includes(id)?`<label class="visually-hidden" for="difficulty-${id}">${escape(name)} difficulty</label><select id="difficulty-${id}" class="inline-input shell-difficulty" data-difficulty="${id}" ${locked?'disabled':''} aria-label="${escape(name)} difficulty">${id==='incubus'?`<option value="easy" ${!levels[id]||levels[id]==='easy'?'selected':''}>New Dreamwalker</option><option value="apprentice" ${levels[id]==='apprentice'?'selected':''}>Apprentice</option><option value="true" ${levels[id]==='true'?'selected':''}>True Dreamwalker</option>`:`<option value="normal" ${!levels[id]||levels[id]==='normal'?'selected':''}>Normal</option><option value="hard" ${levels[id]==='hard'?'selected':''}>Hard</option>${id==='premonitions'?`<option value="extreme" ${levels[id]==='extreme'?'selected':''}>Very hard (6)</option>`:''}`}</select>`:''}</div>`).join('')}</div>
 </section>`;
}
function setup(){return `<div class="route shell shell-setup"><h1 class="shell-title">Choose expansions</h1>
 <details class="shell-card shell-presets"><summary>Saved setups <span class="shell-count">${readPresets(localStorage).length}</span></summary><div class="shell-preset-actions"><input id="presetName" class="inline-input" maxlength="48" placeholder="Name setup" aria-label="Setup name">${btn('Save','presetSave','primary')}</div><div class="shell-preset-list">${readPresets(localStorage).map(p=>`<div class="shell-preset"><strong>${escape(p.name)}</strong>${btn('Load',`presetLoad:${p.id}`,'mini')}${btn('Delete',`presetDelete:${p.id}`,'mini ghost')}</div>`).join('')}</div></details>
 ${setupOptions()}</div>`;}
function pinnedSetupAction(){
 if(page==='#/setup')return `<div class="shell-pinned-action">${btn('Start solo game','soloStart','primary shell-big shell-wide')}</div>`;
 if(page==='#/multiplayer'&&multiplayerTab==='hotseat')return `<div class="shell-pinned-action">${btn('Start game','startHotseat','primary shell-big shell-wide')}</div>`;
 const room=session?.id!=='local'&&session?.id!=='hotseat'&&state?.room&&!state.room.started?state.room:null;
 if(page==='#/multiplayer'&&room){const hostSeat=room.hostSeat??0,other=1-hostSeat;
  return `<div class="shell-pinned-action">${room.host?`<button class="primary shell-big shell-wide" type="button" data-action="start" ${room.connected?.every(Boolean)&&room.ready?.[other]?'':'disabled'}>Start game</button>`:btn(room.ready?.[room.seat]?'Not ready':'Ready','ready','primary shell-big shell-wide')}</div>`;
 }
 return '';
}
function pagedCards(items,renderOne,pageSize=3){
 const pages=Math.max(1,Math.ceil(items.length/pageSize)),page=Math.max(0,Math.min(choicePage,pages-1));
 const cards=items.slice(page*pageSize,(page+1)*pageSize);
 return `<div class="tt7-compact-row"><div class="tt4-card-choices">${cards.map(renderOne).join('')||'<span>None</span>'}</div>${pages>1?`<div class="tt7-page-actions"><button type="button" data-action="choicePrev" ${page===0?'disabled':''} aria-label="Previous cards">‹</button><small>${page+1}/${pages}</small><button type="button" data-action="choiceNext" ${page===pages-1?'disabled':''} aria-label="Next cards">›</button></div>`:''}</div>`;
}
function orderSlice(ids){const page=Math.min(choicePage,Math.max(0,Math.ceil(ids.length/4)-1));return {visible:ids.slice(page*4,(page+1)*4),offset:page*4,pages:Math.max(1,Math.ceil(ids.length/4)),page};}
function orderPages(ids){const {page,pages}=orderSlice(ids);return pages>1?`<div class="tt7-page-actions"><button data-action="choicePrev" ${page===0?'disabled':''} aria-label="Previous cards">‹</button><small>${page+1}/${pages}</small><button data-action="choiceNext" ${page===pages-1?'disabled':''} aria-label="Next cards">›</button></div>`:'';}
function handAndShared(g){return [...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[]),...(g.expansion?.oniverse?.treasure||[]).filter(c=>g.mode==='solo'||c.owner===g.active)];}
function eligibleDecisionCards(g){
 const ids=new Set();if(!g||g.status!=='active'||state?.room?.paused||state?.room?.seat!==g.active)return ids;
 const p=g.pending||{},cards=handAndShared(g);
 if(g.phase==='decision'){
  if(p.type==='door')for(const k of p.keys||[])ids.add(k.id);
  if(p.type==='nightmare'&&nightChoice==='key')for(const c of cards)if(c.symbol==='key')ids.add(c.id);
  if(p.type==='nightmare'&&nightChoice==='door')for(const c of g.players[g.active].doors)ids.add(c.id);
  if(p.type==='rally')for(const id of p.choices||[])ids.add(id);
  if(p.type==='premonitionDoor')for(const d of p.choices||[])ids.add(d.id);
  if(p.type==='towerPenalty')for(const t of legalPenaltyTowers(g))ids.add(t.id);
 }
 if(mirrorTarget&&g.phase==='action')for(const c of cards)if(c.kind==='location'&&(COLOR.includes(mirrorTarget)?c.color===mirrorTarget||c.color==='wild':mirrorTarget==='rainbow'?COLOR.includes(c.color):c.symbol===mirrorTarget))ids.add(c.id);
 if(g.phase==='decision'&&p.type==='coopSwap')for(const c of [...g.players[g.active].hand,...(g.shared||[])])if(c.kind!=='hidden')ids.add(c.id);
 return ids;
}
function legalPenaltyTowers(g){const a=g.expansion?.towers?.alignment||[];return a.filter((t,i)=>i===0||i===a.length-1||!a[i-1].right||!a[i+1].left||!towerEdgeConflict(a[i-1].right,a[i+1].left));}
function chosenDecisionCards(){return new Set([...mirrorPairSelection,...(swapPersonalId?[swapPersonalId]:[]),...(swapSharedId?[swapSharedId]:[])]);}
function incantationDecision(p){
 const choosing=p.type==='incantation'&&p.cards.some(c=>c.kind==='door');
 if(choosing){
  return `<section class="decision stack tt20-incantation" data-tt-incantation-step="claim"><h2>Incantation: Take a door</h2><div class="tt20-incantation-cards">${p.cards.map(c=>c.kind==='door'?`<button type="button" class="tt20-incantation-choice" data-action="incantationClaim:${escape(c.id)}" aria-label="Take ${escape(c.color)} Door">${card(c)}</button>`:`<span class="tt20-incantation-reveal">${card(c)}</span>`).join('')}</div></section>`;
 }
 const ids=p.cards.map(c=>c.id);
 if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id)))effectOrder=[...ids];
 return `<section class="decision stack tt20-incantation" data-tt-incantation-step="order"><h2>Incantation: Rearrange and put on bottom</h2><div class="tt20-incantation-cards tt3-order-list" data-tt-order-group="effect">${effectOrder.map(id=>{const c=p.cards.find(c=>c.id===id);return `<div class="tt3-order-item" data-tt-order-id="${escape(id)}"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" tabindex="0" role="button" aria-label="Reorder ${escape(c.kind)} card">${card(c)}</div></div>`;}).join('')}<button type="button" class="tt5-order-end" data-tt-order-end="effect" aria-label="Move selected card to end"></button></div>${btn('Confirm','effectConfirm','primary')}</section>`;
}
function happyPeekDecision(p){
 const ids=p.cards.map(c=>c.id);
 if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id))){effectOrder=[...ids];effectDiscards.clear();}
 const kept=effectOrder.filter(id=>!effectDiscards.has(id)),discarded=[...effectDiscards].filter(id=>ids.includes(id));
 const face=id=>card(p.cards.find(c=>c.id===id),{tiny:true});
 return `<section class="decision stack tt23-happy-peek"><div class="tt23-happy-row"><div class="tt23-peek-cards tt3-order-list" data-tt-order-group="effect" aria-label="${kept.length} retained cards; drag to reorder or discard">${kept.map(id=>`<div class="tt3-order-item" data-tt-order-id="${escape(id)}"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" role="button" tabindex="0" aria-label="Move card; drag to discard">${face(id)}</div></div>`).join('')}<button type="button" class="tt5-order-end" data-tt-order-end="effect" aria-label="Move selected card to end"></button></div><div class="tt23-happy-discard" data-tt-happy-discard role="group" aria-label="Discard area; drag a card here or tap a selected card then this area"><span class="tt23-discard-label">Discard (${discarded.length})</span><div class="tt23-discard-stack">${discarded.map(id=>`<button type="button" class="tt23-discard-card" data-action="effectRestore:${escape(id)}" data-tt-happy-restore="${escape(id)}" aria-label="Restore discarded card to retained cards">${face(id)}</button>`).join('')}</div></div></div><div class="tt23-happy-controls">${btn('Confirm','effectConfirm','primary')}</div></section>`;
}
function effectReorder(p){if(!p.cards)return '';if(p.type==='happyPeek')return happyPeekDecision(p);if(['incantation','incantationOrder'].includes(p.type))return incantationDecision(p);const ids=p.cards.map(c=>c.id);if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id)))effectOrder=[...ids];
 const modes={sphinxResolve:'Sphinx — choose the top card if your named aspect matched; arrange the others bottom-first.',diver:'Diver — stop and put last card on top, continue revealing, or resolve a Nightmare.',denizenPeek:'Denizen insight — reorder inspected cards.',happyPeek:'Happy Dream — choose zero or more cards to discard, then reorder the rest.',incantation:'Incantation — choose one Door (if available) and order the others from bottom to top.',towerLook:'Tower insight — order inspected cards from top to bottom.',spellPeek:'Paradoxical Prophecy — pick one card to put on top; order the others from bottom to top.'};
 const options=p.cards.filter(c=>p.type==='incantation'?c.kind==='door':['spellPeek','sphinxResolve'].includes(p.type));
 if(effectPick&&!options.some(c=>c.id===effectPick))effectPick=null;
 return `<section class="decision stack"><h2>${escape(modes[p.type])}</h2><div class="cards tt3-order-list tt24-reveal-list" data-tt-order-group="effect" aria-label="${ids.length} revealed cards, scroll to see all">${effectOrder.map(id=>{const c=p.cards.find(x=>x.id===id);return `<div class="stack tt3-order-item" data-tt-order-id="${escape(id)}" style="align-items:center"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" title="Drag or tap to reorder" role="button" tabindex="0" aria-label="Reorder card: drag, or select then choose insertion point">${card(c)}</div>${options.some(x=>x.id===id)?btn(p.type==='incantation'?(effectPick===id?'✓ Claim':'Claim'):(effectPick===id?'✓ Place on top':'Place on top'),`effectPick:${id}`,'mini'):''}${p.type==='happyPeek'?btn(effectDiscards.has(id)?'✓ Discard':'Discard',`effectDiscard:${id}`,'mini'):''}</div>`;}).join('')}<button type="button" class="tt5-order-end" data-tt-order-end="effect" aria-label="Move selected card to end" title="Insert at end"></button></div>${p.type==='sphinxResolve'?btn('Confirm','sphinxConfirm','primary'):p.type==='diver'?`<div class="actions">${p.cards.at(-1)?.kind==='nightmare'?btn('Nightmare','diverNightmare','danger'):btn('Stop','diverStop','primary')}${p.cards.at(-1)?.kind!=='nightmare'&&p.remaining!==0?btn('Reveal','diverContinue'):''}</div>`:p.type==='incantation'?`<button type="button" data-action="effectConfirm" class="primary" ${options.length&&!effectPick?'disabled aria-label="Select a revealed Door before confirming"':''}>Confirm</button>`:btn('Confirm','effectConfirm','primary')}</section>`;
}
function towerEdgeConflict(left,right){const marks=v=>Array.isArray(v)?v:typeof v==='string'?v.split(/[+|,/ ]+/).filter(Boolean):[];return marks(left).some(mark=>marks(right).includes(mark));}
// Freeing is a separate, optional, tabletop selection after a real deck search.
function beginSearchFree(g,command){
 const d=g.expansion?.dreamcatchers;
 if(!d||!d.stacks.some((stack,i)=>d.active[i]&&stack.length))return action(command);
 searchFreeIntent={command,selected:null};pileOpen=null;return render();
}
function searchFreeCatchers(g){
 const d=g.expansion?.dreamcatchers;
 return d?d.stacks.map((cards,i)=>({cards,i})).filter(({cards,i})=>cards.length&&d.active[i]):[];
}
function searchFreeWorkspace(g){
 const available=searchFreeCatchers(g),chosen=available.find(x=>x.i===searchFreeIntent?.selected);
 return `<section class="decision stack tt21-free-step"><p>Trigger a freeing?</p>${available.length?'<p>Tap a highlighted Dreamcatcher.</p>':''}${chosen?`<div class="tt21-free-detail"><div class="tt21-free-cards">${chosen.cards.map(c=>card(c,{tiny:true})).join('')}</div><div class="tt21-free-buttons">${btn('Free',`searchFree:free:${chosen.i}`,'primary')}${btn('Pass','searchFree:pass','tt21-muted')}</div></div>`:`<div class="tt21-free-buttons">${btn('Pass','searchFree:pass','tt21-muted')}</div>`}</section>`;
}
// Search is an engine action; choosing an optional Dreamcatcher is a UI-only step.
// This does not expose deck identities or change state until the player confirms.
function searchableCatchers(g,intent){
 const d=g.expansion?.dreamcatchers,source=(g.pending?.targets||[]).find(t=>t.id===intent?.doorId)?.source;
 return d?d.stacks.map((cards,i)=>({cards,i})).filter(({cards,i})=>cards.length&&d.active[i]&&source!==`catch${i}`):[];
}
function doorSearchDecision(g,p){
 const all=p.targets||[],intent=doorSearchIntent;
 const valid=intent&&(!intent.doorId||all.some(t=>t.id===intent.doorId));
 if(valid&&g.expansion?.dreamcatchers){
  const available=searchableCatchers(g,intent),chosen=available.find(x=>x.i===intent.selected);
  return `<section class="decision stack tt21-free-step"><p>Trigger a freeing?</p>${available.length?'<p>Tap a highlighted Dreamcatcher.</p>':''}${chosen?`<div class="tt21-free-detail"><div class="tt21-free-cards" aria-label="Dreamcatcher ${chosen.i+1} cards">${chosen.cards.map(c=>card(c,{tiny:true})).join('')}</div><div class="tt21-free-buttons">${btn('Free',`doorSearch:free:${chosen.i}`,'primary')}${btn('Pass','doorSearch:passFree','tt21-muted')}</div></div>`:`<div class="tt21-free-buttons">${btn('Pass','doorSearch:passFree','tt21-muted')}</div>`}</section>`;
 }
 const chromatic=!!(g.expansion?.oniverse?.rallied||[]).find(d=>d.owner===g.active&&d.ability==='chromatic');
 const more=doorSearchChromatic&&chromatic;
 const preview=color=>card({kind:'door',color,expansion:color==='wild'?'oniverse':undefined},{tiny:true});
 const option=(color,source,shuffles,action)=>`<button type="button" class="tt21-search-choice" data-action="${escape(action)}" aria-label="${escape(color==='wild'?'Oniverse':color)} Door, ${escape(source)}, ${shuffles?'shuffle':'no shuffle'}">${preview(color)}<strong>${escape(source)}</strong><span class="tt21-source">${shuffles?'Shuffle':'No shuffle'}</span></button>`;
 const colors=more?COLOR.filter(c=>c!==p.color):[p.color,...(g.expansion?.oniverse?['wild']:[])];
 const actions=[];
 for(const color of colors){
  const deck=all.find(t=>t.source==='deck'&&t.color===color);
  const caught=all.filter(t=>t.source.startsWith('catch')&&t.color===color).filter((t,i,items)=>items.findIndex(x=>x.source===t.source)===i);
  const suffix=more?':chromatic':'';
  if(deck)actions.push(option(color,'from deck',true,`doorSearch:choose:${deck.id}${suffix}`));
  else if(!caught.length)actions.push(option(color,'from deck',true,`doorSearch:search:${color}${suffix}`));
  for(const t of caught){
   const index=Number(t.source.slice(5))+1;
   actions.push(option(color,`from catcher ${index}`,false,`doorSearch:direct:${t.id}${suffix}`));
   if(!deck)actions.push(option(color,`from catcher ${index}`,true,`doorSearch:shuffle:${t.id}${suffix}`));
  }
 }
 const switcher=more?btn('Back','doorSearch:normal','tt21-muted'):chromatic?btn('Chromatic Chaos','doorSearch:chromatic','tt21-chromatic'):'';
 return `<section class="decision stack tt21-door-search"><div class="tt21-search-options">${actions.join('')}${switcher}${btn('Pass','doorSearch:skip','tt21-muted')}</div></section>`;
}
function decision(g,canAct){
  if(g.phase!=='decision')return '';
  if(!canAct)return `<div class="notice">Your partner is resolving a card effect.</div>`;
  const p=g.pending;if(!p)return '';
  if(p.type==='sphinxName')return `<section class="decision stack"><h2>Sphinx: name an aspect</h2><div class="actions">${[...COLOR,'moon','key',...(g.config.expansions.includes('glyphs')?['glyph']:[])].map(a=>btn(a,`sphinxName:${a}`,'primary')).join('')}</div></section>`;
  if(p.type==='sphinxResolve'||p.type==='diver')return effectReorder(p);
  if(p.type==='drawReady'||p.type==='drawn')return '';
  if(p.type==='confusion'){const cards=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[])];const ids=cards.map(c=>c.id);if(effectOrder.length!==ids.length||effectOrder.some(id=>!ids.includes(id)))effectOrder=[...ids];return `<section class="decision stack"><h2>Confusion — reorder your hand</h2><div class="cards tt3-order-list" data-tt-order-group="effect">${orderSlice(effectOrder).visible.map(id=>{const c=cards.find(x=>x.id===id);return `<div class="stack tt3-order-item" data-tt-order-id="${escape(id)}"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" title="Drag or tap to reorder" role="button" tabindex="0" aria-label="Reorder card: drag, or select then choose insertion point">${card(c)}</div></div>`;}).join('')}<button type="button" class="tt5-order-end" data-tt-order-end="effect" aria-label="Move selected card to end" title="Insert at end"></button></div>${btn('Redraw','confusionResolve','primary')}</section>`;}
  if(p.type==='mirrorReward')return `<section class="decision stack"><h2>${escape(p.mirror)} Mirror reward</h2>${p.mirror==='key'?`<label>Door color <select id="mirrorColor" class="inline-input">${COLOR.map(c=>`<option>${c}</option>`).join('')}</select></label>`:''}${pagedCards(p.options,c=>`<label class="tt4-card-option"><input type="checkbox" data-mirror-choice="${escape(c.id)}" ${mirrorSelection.has(c.id)?'checked':''}>${card(c,{tiny:true})}</label>`)}${btn('Confirm','mirrorRewardConfirm','primary')}</section>`;
  if(p.type==='doorSearch')return doorSearchDecision(g,p);

  if(p.type==='door')return `<section class="decision tt25-drawn-door-decision"><button type="button" class="tt25-drawn-door-preview" data-action="useKey:gain" aria-label="Gain ${escape(p.card.color==='wild'?'Door to the Oniverse':p.card.color+' Door')}">${card(p.card)}</button><div class="tt25-drawn-door-actions">${btn('Use Key','useKey:gain','primary')}${btn('Pass','useKey:limbo')}</div></section>`;
  if(p.type==='nightmare'){
    const keys=handAndShared(g).filter(c=>c.symbol==='key'),doors=g.players[g.active].doors;
    const option=(name,id,enabled,chosen=false)=>`<button type="button" data-tt-card-info="${escape(JSON.stringify({kind:'nightmarePenalty',option:name}))}" class="tt7-option ${chosen?'tt7-option-active':''}" data-action="${id}" aria-disabled="${!enabled}" aria-pressed="${chosen}">${name}</button>`;
    const extras=`${g.expansion?.incubus&&!p.incubus&&(g.expansion.incubus.level==='easy'?!g.expansion.incubus.used:g.expansion.incubus.stored.length>0)?btn('Incubus','incubusCancel'):''}${(g.expansion?.oniverse?.rallied||[]).filter(d=>d.ability==='mirror'&&d.owner===g.active).map(d=>btn('Mirror',`mirror:${d.id}`)).join('')}`;
    return `<section class="decision stack"><div class="actions tt7-night-options">${option('Discard key','nightChoose:key',keys.length>0,nightChoice==='key')}${option('Remove door','nightChoose:door',doors.length>0,nightChoice==='door')}${option('5 from deck','nightReveal',true)}${option('Discard hand','nightHand',true)}${extras}</div></section>`;
  }
  if(p.type==='prophecy')return prophecy(g);
  if(p.type==='happyDream')return `<section class="decision stack"><div class="actions tt9-happy-actions">${happyBanishMode?`${btn('Cancel','happyBanishCancel')}<button type="button" class="primary" data-action="happyBanishConfirm" ${happyPremonitionChoice?'':'disabled'}>Submit</button>`:`${(g.expansion?.premonitions?.faceUp||[]).length?btn('Remove Premonition','happyBanishStart','primary'):''}${btn('Peek','happyPeek','primary')}${btn('Move 1 card to top of deck and shuffle','happyFetch','primary')}`}</div></section>`;
  if(p.type==='happyFetch'){
    if(happyFetchSelection&&!p.options.some(c=>c.id===happyFetchSelection))happyFetchSelection=null;
    return `<section class="decision stack tt26-happy-fetch"><div class="tt26-fetch-strip" role="region" tabindex="0" aria-label="Search the deck, scroll horizontally to see all cards">${p.options.map(c=>`<button type="button" class="tt26-fetch-card ${c.id===happyFetchSelection?'tt26-fetch-selected':''}" data-action="happyFetchPick:${escape(c.id)}" aria-pressed="${c.id===happyFetchSelection}" aria-label="Select ${escape(c.color||c.kind)} card">${card(c,{tiny:true})}</button>`).join('')}</div><button type="button" class="primary tt26-fetch-confirm" data-action="happyFetchSelect" ${happyFetchSelection?'':'disabled'}>Select</button></section>`;
  }
  if(p.type==='rally')return `<section class="decision stack"><div class="actions"><span class="tt7-micro">Tap an eligible Location</span>${btn('Skip','rally:skip')}</div></section>`;
  if(p.type==='premonitionPick')return `<section class="decision stack"><h2>Dark Premonitions triggered</h2><p>Choose the order of resolving the active conditions.</p><div class="actions">${pagedCards(p.options,id=>btn(id,`premonitionPick:${id}`,'danger'),2)}</div></section>`;
  if(p.type==='premonitionKeys'){
    const ids=new Set(p.options.map(c=>c.id));for(const id of premonitionKeysSelected)if(!ids.has(id))premonitionKeysSelected.delete(id);
    return `<section class="decision stack tt22-prem-keys"><p>Choose ${p.count} ${p.count===1?'Key':'Keys'} to discard (${premonitionKeysSelected.size}/${p.count}).</p><div class="tt22-prem-options">${p.options.map(c=>`<button type="button" class="tt22-prem-key ${premonitionKeysSelected.has(c.id)?'tt22-picked':''}" data-action="premonitionKey:${escape(c.id)}" aria-pressed="${premonitionKeysSelected.has(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div><button type="button" class="primary" data-action="premonitionKeysConfirm" ${premonitionKeysSelected.size===p.count?'':'disabled'}>Discard selected Keys</button></section>`;
  }
  if(p.type==='premonitionNightmare')return `<section class="decision stack"><p>Select which discarded Nightmare to return to Limbo.</p><div class="tt22-prem-options">${p.options.map(c=>`<button type="button" class="tt22-prem-key" data-action="premonitionNightmare:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div></section>`;
  if(p.type==='premonitionDoor')return `<section class="decision stack"><span class="tt7-micro">Tap a Door</span></section>`;
  if(['incantation','incantationOrder','towerLook','spellPeek','happyPeek','denizenPeek'].includes(p.type))return effectReorder(p);
  if(p.type==='catchChoose')return `<section class="decision stack">${btn('Continue',`catchChoose:${p.choices[0]}`,'primary')}</section>`;
  if(p.type==='catchOverload')return `<section class="decision stack tt23-overload"><button type="button" class="primary" data-action="catchOverload:remove">Remove Dreamcatcher</button></section>`;
  if(p.type==='towerPenalty')return `<section class="decision stack"><div class="actions"><span class="tt7-micro">Tap an outlined Tower to destroy it</span>${btn('False destruction','towerFake')}</div></section>`;
  if(p.type==='moduleDecision')return `<section class="decision stack"><h2>Choose effect: ${escape(p.id)}</h2><div class="actions">${pagedCards(p.options,o=>btn(escape(o),`moduleDecision:${encodeURIComponent(o)}`,'primary'),2)}</div></section>`;
  return `<div class="notice">Resolving an effect.</div>`;
}
let prophecyDiscard=null,prophecyOrder=[];
function prophecy(g){const cards=g.pending.cards;if(!cards)return '';
  if(!cards.some(c=>c.id===prophecyDiscard)){prophecyDiscard=null;prophecyOrder=cards.map(c=>c.id);}
  if(prophecyOrder.length!==cards.length||prophecyOrder.some(id=>!cards.some(c=>c.id===id)))prophecyOrder=cards.map(c=>c.id);
  const remaining=prophecyOrder.filter(id=>id!==prophecyDiscard);
  const discarded=cards.find(c=>c.id===prophecyDiscard);
  return `<section class="decision stack tt7-prophecy"><div class="tt7-compact-row"><div class="cards tt3-order-list tt26-prophecy-cards" data-tt-order-group="prophecy">${remaining.map(id=>{const c=cards.find(x=>x.id===id);return `<div class="tt3-order-item" data-tt-order-id="${escape(id)}"><div class="tt3-order-handle" data-tt-order-handle="${escape(id)}" role="button" tabindex="0" aria-label="Move card">${card(c,{tiny:true})}</div></div>`;}).join('')}<button type="button" class="tt5-order-end" data-tt-order-end="prophecy" aria-label="Move selected card to end"></button></div><button type="button" class="tt7-prophecy-slot" data-tt-prophecy-discard aria-label="Prophecy discard slot: drag or select a card, then activate">${discarded?card(discarded,{tiny:true}):'Discard<br>↓'}</button></div>${prophecyDiscard?btn('Confirm','prophecyConfirm','primary'):'<span class="tt7-micro">Drag a card to Discard</span>'}</section>`;
}
// The new solo and cooperative tabletops are the only supported gameplay surfaces.
// Unknown modes fail visibly instead of silently falling back to obsolete controls.
function board(g,room){
  const incantationPreview=g.pending?.type==='incantation'&&incantationStage==='order'&&effectPick?g.pending.cards.find(c=>c.id===effectPick&&c.kind==='door'):null;
  const incantationClaim=g.phase==='decision'&&g.pending?.type==='incantation'&&g.pending.cards.some(c=>c.kind==='door')&&incantationStage==='claim'&&room.seat===g.active&&!room.paused;
  if(g.mode==='solo')return renderSoloTabletop(g,{selectedId:selected,canAct:!room.paused&&room.seat===g.active,decisionTargets:eligibleDecisionCards(g),decisionSelected:chosenDecisionCards(),spellGoalMode:spellOpen&&spellChoice==='parallel',spellGoals,selectedPremonition:happyBanishMode?happyPremonitionChoice:null,premonitionChoiceMode:happyBanishMode,incantationClaim:false,incantationPreview});
  if(g.mode==='coop')return renderCooperativeTabletop(g,{seat:room.seat,selectedId:selected,canAct:!room.paused&&room.seat===g.active,connected:online,decisionTargets:eligibleDecisionCards(g),decisionSelected:chosenDecisionCards(),spellGoalMode:spellOpen&&spellChoice==='parallel',spellGoals,selectedPremonition:happyBanishMode?happyPremonitionChoice:null,premonitionChoiceMode:happyBanishMode,incantationClaim:false,incantationPreview});
  throw new Error(`Unsupported game mode: ${g.mode}`);
}
// Phase 4: contextual UI lives outside the tabletop. All choices still dispatch
// through the existing command handler and server/local engine.
function denizenWorkspace(g){
 const d=(g.expansion?.oniverse?.rallied||[]).find(x=>x.id===denizenIntent?.id&&x.owner===g.active);if(!d)return null;
 const a=d.ability,info=cardHelp(d),stage=denizenIntent.step||'confirm';
 const hand=[...(g.players[g.active]?.hand||[]),...(g.mode==='coop'?g.shared||[]:[])];
 const movable=a==='keeper'?hand:[...hand,...(g.expansion?.oniverse?.treasure||[]).filter(c=>c.owner===g.active)];
 const eligible=a==='keeper'?movable.filter(c=>c.kind!=='deadEnd'):a==='architect'?movable.filter(c=>c.kind==='location'&&g.players[g.active].labyrinth.at(-1)?.symbol===c.symbol):movable.filter(c=>c.kind==='location');
 const chromaticKeys=g.pending?.type==='door'?(g.pending.keys||[]).map(x=>[...hand,...(g.expansion?.oniverse?.treasure||[]).filter(c=>c.owner===g.active)].find(c=>c.id===x.id)).filter(c=>c&&c.color!==g.pending.card.color&&c.color!=='wild'):[];
 const chromaticDoors=g.pending?.type==='doorSearch'?(g.pending.targets||[]).filter(c=>c.color!==g.pending.color&&c.color!=='wild'):[];
 const available=a==='mirror'?g.pending?.type==='nightmare'&&!g.pending?.incubus:a==='chromatic'?Boolean(chromaticKeys.length||g.pending?.type==='doorSearch'):a==='keeper'?!g.expansion.oniverse.treasure.some(c=>c.holderId===d.id)&&eligible.length>0:a==='hammer'?g.players[g.active].labyrinth.length>0:a==='architect'?eligible.length>0:a==='cyclobot'?eligible.length>0&&g.discard.some(c=>c.kind==='location'):['squirrel','harpoon'].includes(a)?g.deckCount>0:false;
 let content='';
 if(stage==='confirm')content=`<div class="tt22-denizen-card">${card(d,{tiny:true})}</div><p><strong>${escape(info.title)}.</strong> ${escape(info.detail)}</p><div class="tt22-denizen-actions"><button class="primary" data-action="denizenUse" ${available?'':'disabled'}>Use</button>${btn('Cancel','denizenCancel')}</div>`;
 else if(stage==='pick')content=`<p>Select a ${a==='keeper'?'card to store':a==='architect'?'Location to play':'Location to exchange'}.</p><div class="tt22-denizen-choices">${eligible.map(c=>`<button type="button" class="tt22-denizen-choice" data-action="denizenCard:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div>${btn('Cancel','denizenCancel')}`;
 else if(stage==='discard')content=`<p>Select the Location to take from the discard pile.</p><div class="tt22-denizen-choices">${g.discard.filter(c=>c.kind==='location').map(c=>`<button type="button" class="tt22-denizen-choice" data-action="denizenDiscard:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div>${btn('Cancel','denizenCancel')}`;
 else if(stage==='chromaticKey')content=`<p>Choose a differently colored Key to claim the Door.</p><div class="tt22-denizen-choices">${chromaticKeys.map(c=>`<button type="button" class="tt22-denizen-choice" data-action="denizenChromaticKey:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')}</div>${btn('Cancel','denizenCancel')}`;
 return {type:'denizen',key:`denizen:${d.id}:${stage}`,html:`<section class="decision tt22-denizen-dialog">${content}</section>`};
}
function contextualDialog(g,room){
 if(g.status!=='active'||!['action','decision','turnComplete'].includes(g.phase)||room.seat!==g.active)return null;
 const e=g.expansion||{},cards=handAndShared(g);
 if(g.phase==='action'&&mirrorTarget&&e.mirrors&&!e.mirrors.completed.includes(mirrorTarget)){
  const matches=c=>c.kind==='location'&&(COLOR.includes(mirrorTarget)?c.color===mirrorTarget||c.color==='wild':mirrorTarget==='rainbow'?COLOR.includes(c.color):c.symbol===mirrorTarget);
  const html=`<section class="decision stack"><div class="actions"><span class="tt7-micro">Tap two cards (${mirrorPairSelection.size}/2)</span>${btn('Place','mirrorConfirm','primary')}${btn('Cancel','mirrorCancel')}</div></section>`;
  return {type:'mirrorPair',key:`context:mirror:${mirrorTarget}`,html};
 }
 if(g.phase==='action'&&cyclobotTarget&&e.oniverse?.rallied.some(d=>d.id===cyclobotTarget)){
  const eligible=g.discard.filter(c=>c.kind==='location');
  const html=`<section class="decision stack"><h2>Cyclobot exchange</h2><p>Select a hand Location, then select its replacement.</p><div class="tt4-card-choices">${eligible.map(c=>`<button type="button" class="tt4-card-option" data-action="cyclobotSwap:${escape(c.id)}">${card(c,{tiny:true})}</button>`).join('')||'<span>No Locations available.</span>'}</div><div class="actions">${btn('Cancel','cyclobotCancel')}</div></section>`;
  return {type:'cyclobot',key:`context:cyclobot:${cyclobotTarget}`,html};
 }
 if(spellOpen&&e.book){
  return {type:'spellbook',key:'context:spellbook',html:renderSpellbook(g,{choice:spellChoice,selectedGoals:spellGoals})};
 }
 return null;
}
function gameWorkspace(g,room){
 if(!g||!room||g.status!=='active'||room.paused)return null;
 if(searchFreeIntent&&!(searchFreeIntent.command.type==='mirrorPair'?g.phase==='action':g.pending?.type===searchFreeIntent.command.type))searchFreeIntent=null;
 if(searchFreeIntent&&room.seat===g.active)return {type:'freeSearch',key:'search-free:'+searchFreeIntent.command.type,html:searchFreeWorkspace(g)};
 if(denizenIntent){const box=denizenWorkspace(g);if(box&&room.seat===g.active)return box;denizenIntent=null;}
 if(g.phase==='decision'&&['drawReady','drawn'].includes(g.pending?.type))return null;
 if(g.phase==='decision'&&spellOpen&&g.expansion?.book)return contextualDialog(g,room);
 if(g.phase==='decision'&&g.pending?.type==='coopSwap')return null;
 if(g.phase==='decision'){const key=decisionDialogKey(g,room.seat);return key?{type:g.pending.type,key,mandatory:true,html:decision(g,true)}:null;}
 return contextualDialog(g,room);
}
function closeOptionalDialog(){mirrorTarget=null;mirrorPairSelection.clear();cyclobotTarget=null;spellOpen=false;spellSelected.clear();render();}
function rules(){return `<div class="route shell shell-rules"><div class="shell-title-line"><h1 class="shell-title">Rules & card guide</h1><span class="shell-count">All modules</span></div>${renderRulesReference()}</div>`;}
function roadmap(){const phases=['Foundation','Base tabletop','Card gestures','Decision dialogs','Expansion tabletop','Co-op tabletop','Minimal app shell','Visual QA','Final cleanup'];return `<div class="route shell"><div class="shell-title-line"><h1 class="shell-title">UI roadmap</h1><span class="shell-count">9 of 9</span></div><section class="shell-card shell-roadmap">${phases.map((title,i)=>`<div><span>${i+1}</span><strong>${title}</strong><small>${i<9?'✓':'Pending'}</small></div>`).join('')}</section></div>`;}
function tutorial(){return renderGuideTutorial(tutorialChapter,tutorialStep);}
function historyPage(){const list=readHistory(localStorage),stats=summarizeHistory(list);return `<div class="route shell"><div class="shell-title-line"><h1 class="shell-title">History</h1><span class="shell-count">Local</span></div>
 <section class="shell-stats">${[['Games',stats.played],['Wins',stats.wins],['Win rate',stats.winRate+'%'],['Solo · Co-op',stats.solo+' · '+stats.coop]].map(([name,value])=>`<div class="shell-card shell-stat"><strong>${value}</strong><span>${name}</span></div>`).join('')}</section>
 <section class="shell-card shell-history"><h2 class="shell-section-title">Games</h2>${list.length?`<div class="shell-history-list">${list.map(r=>`<div class="shell-history-row"><span class="shell-result ${r.status}">${icon(r.status==='won'?'check':'close')}</span><div><strong>${r.mode==='solo'?'Solo':'Co-op'} · ${r.status==='won'?'Win':'Loss'}</strong><small>${new Date(r.finishedAt).toLocaleDateString()} · Turn ${r.turn}${r.config.expansions.length?' · '+r.config.expansions.length+' expansions':''}</small></div></div>`).join('')}</div>`:'<p class="shell-empty">No completed games</p>'}${list.length?btn('Clear history','historyClear','shell-text-button'):''}</section>
 </div>`;}
function fitGameTabletop(){
  const viewport=app.querySelector?.('.tt6-table-slot'),table=viewport?.querySelector?.('.tt2-root');
  return fitTabletop(viewport,table,{mode:state?.game?.mode,expansions:state?.game?.config?.expansions||[]});
}
let lastRenderedMarkup=null;
function render(){if(state?.game?.phase!=='action'||state?.game?.status!=='active')failsafeChoosing=false;tabletopAnimator?.before?.(state?.game,session?.id,page);cardInspector?.close();const dialogFocus=typeof dialogController!=='undefined'?dialogController?.capture?.():null;const focused=document.activeElement;const focusKind=lastInputWasKeyboard?['action','pick','setting','expansion','difficulty'].find(k=>focused?.dataset?.[k]):null;const focusValue=focusKind?focused.dataset[focusKind]:null;
  const previousLabyrinths=new Map([...(app.querySelectorAll?.('[data-tabletop-scroll]')||[])].map(el=>[el.dataset.tabletopScroll,{count:el.querySelectorAll('.card.tiny').length,left:el.scrollLeft}]));
  const previousDock=app.querySelector?.('.tt6-dock-scroll'),dockScroll=previousDock?.scrollTop||0,dockX=previousDock?.scrollLeft||0;
  const previousPile=app.querySelector?.('.tt6-pile-scroll'),pileScroll=previousPile?.scrollTop||0;
  const oldDiscardStrip=app.querySelector?.('.tt8-discard-history'),discardX=oldDiscardStrip?.scrollLeft,discardWasAtEnd=!oldDiscardStrip||oldDiscardStrip.scrollWidth-oldDiscardStrip.clientWidth-oldDiscardStrip.scrollLeft<=4;
  const previousWindow=app.querySelector?.('.shell-viewport-window');
  const windowScroll=previousWindow?.scrollTop||0,windowRoute=previousWindow?.dataset?.pageRoute;
  const previousOverlay=app.querySelector?.('[data-game-menu-dialog]');
  const overlayScroll=previousOverlay?.querySelector?.('[data-game-menu-scroll]')?.scrollTop||0;
  const expandedRules=[...(previousOverlay?.querySelectorAll?.('details[open][data-rule-index]')||[])].map(el=>el.dataset.ruleIndex);
  const settingsExpanded=!!previousOverlay?.querySelector?.('[data-pause-settings][open]');
  const overlayFocused=focused?.closest?.('[data-game-menu-dialog]')?focused?.dataset?.action||focused?.dataset?.setting:null;
  const replayFocused=focused?.closest?.('[data-replay-layer]')?focused?.dataset?.action:null;
  page=location.hash||'#/';if(page!=='#/game'){gameOverlay=null;gameRulesFromPause=false;}let content;
  if(page==='#/setup')content=setup();else if(page==='#/join'||roomCodeFromHash()){joinCode=joinCode||roomCodeFromHash();content=multiplayer();}else if(page==='#/rules')content=rules();else if(page==='#/roadmap')content=roadmap();else if(page==='#/multiplayer')content=multiplayer();else if(page==='#/settings')content=settings();else if(page==='#/history')content=historyPage();else if(page==='#/tutorial')content=tutorial();else if(page==='#/game')content=!state?'<div class="loading">Loading the dream…</div>':!state.room.started?multiplayer():IS_HOTSEAT()&&passDevice?`<section class="shell-pass-card" role="dialog" aria-modal="true"><h1>Pass the device</h1><p>Hand the device to ${escape(state.game.players[state.game.active]?.name||'the next player')}. Their cards are hidden until they are ready.</p>${btn('I’m ready','passReady','primary shell-big')}</section>`:board(state.game,state.room);else content=home();
  const passScreen=IS_HOTSEAT()&&passDevice&&page==='#/game';
  const inGame=page==='#/game'&&!!state?.room?.started&&!passScreen;
  const errorMessage=error?`<div class="shell-notice-layer" data-notice-backdrop><section class="shell-notice-dialog" role="alertdialog" aria-modal="true" aria-label="Information" tabindex="-1"><p>${escape(error)}</p>${btn('OK','clearError','primary')}</section></div>`:'';
  const workspace=inGame?gameWorkspace(state.game,state.room):null;
  const legal=inGame&&selected&&state.room.seat===state.game.active?(state.game.mode==='coop'?cooperativeLegalTargets(state.game,selected,state.room.seat):soloLegalTargets(state.game,selected,state.room.seat)):[];
  const dock=inGame?(state.room.paused?`<section class="tt6-workspace tt8-required" data-action-dock aria-label="Waiting for player"><div class="tt6-dock-status"><strong>Waiting for player</strong></div><div class="tt6-dock-buttons"><button type="button" data-action="copyInvite">Copy invite</button><button type="button" data-action="openGamePause">Game menu</button></div></section>`:typeof renderActionDock==='function'?renderActionDock(state.game,state.room.seat,{selectedId:selected,legal,dialog:workspace,prophecyDiscard,failsafeChoosing}):''):'';
  const replayAvailable=inGame&&state?.room?.mode==='coop'&&opponentReplay(state?.replay,state.room.seat).length>1;
  const replayLaunch=replayAvailable?'<button type="button" class="tt9-replay-launch" data-action="replayOpen" aria-label="Replay partner turn">Replay</button>':'';
  const dockWithReplay=replayAvailable?dock.replace(/(<section\b[^>]*data-action-dock[^>]*>)/,'$1'+replayLaunch):dock;
  const pile=inGame&&pileOpen&&typeof renderPileInspector==='function'?renderPileInspector(state.game,pileOpen,state.room?.seat):'';
  const markup=(inGame?'':nav())+`<main class="page${inGame?' game-viewport':''}" id="main-content" tabindex="-1">${inGame?`<div class="tt6-table-slot">${content}</div>${dockWithReplay}${pile}`:`<div class="shell-viewport-window" data-page-route="${escape(page)}" role="region" aria-label="Page content" tabindex="0">${content}</div>`}${inGame?'':pinnedSetupAction()}</main>${errorMessage}`+(inGame?'':bottomNav())+(inGame&&typeof renderOverlay==='function'?renderOverlay(gameOverlay,state.game?.config?.expansions,state.game?.mode==='coop',{...uiSettings,fromPause:gameRulesFromPause,themes:THEME_PRESETS,log:state.game?.log||[],multiplayer:state.room?.mode==='coop',host:state.room?.host,paused:state.room?.paused}):'')+(inGame&&replayFrames.length?replayOverlay(replayFrames,replayIndex,state.room.seat,replayPlaying):'');
  if(markup!==lastRenderedMarkup){app.innerHTML=markup;lastRenderedMarkup=markup;}
  if(inGame){
    applyTabletopMetrics(app.querySelector?.('.tt2-root'),{mode:state.game.mode,expansions:state.game.config?.expansions||[]});
    fitGameTabletop();
    const pending=state.game.pending;
    if(failsafeChoosing&&state.game.phase==='action'&&state.room?.seat===state.game.active&&state.game.expansion?.dreamcatchers){
      const d=state.game.expansion.dreamcatchers;
      for(const catcher of app.querySelectorAll('.tt5-catcher[data-action^="inspectCatcher:"]')){
        const i=Number(catcher.dataset.action.slice(15));
        catcher.classList.toggle('tt23-failsafe-target',Boolean(d.active[i]&&d.stacks[i]?.length));
      }
    }
    if(searchFreeIntent&&state.game.expansion?.dreamcatchers){
      const available=new Set(searchFreeCatchers(state.game).map(x=>x.i));
      for(const catcher of app.querySelectorAll('.tt5-catcher[data-action^="inspectCatcher:"]')){
        const i=Number(catcher.dataset.action.slice(15));
        catcher.classList.toggle('tt-search-free-eligible',available.has(i));
        catcher.classList.toggle('tt-search-free-chosen',available.has(i)&&searchFreeIntent.selected===i);
      }
    }
    if(pending?.type==='doorSearch'&&doorSearchIntent&&state.game.expansion?.dreamcatchers){
      const available=new Set(searchableCatchers(state.game,doorSearchIntent).map(x=>x.i));
      for(const catcher of app.querySelectorAll('.tt5-catcher[data-action^="inspectCatcher:"]')){
        const i=Number(catcher.dataset.action.slice(15));
        catcher.classList.toggle('tt-search-free-eligible',available.has(i));
        catcher.classList.toggle('tt-search-free-chosen',available.has(i)&&doorSearchIntent.selected===i);
      }
    }
    // Preserve deliberate horizontal inspection; newly played cards remain visible.
    for(const lane of app.querySelectorAll?.('[data-tabletop-scroll]')||[]){const old=previousLabyrinths.get(lane.dataset.tabletopScroll);if(old&&old.count===lane.querySelectorAll('.card.tiny').length)lane.scrollLeft=old.left;}
  }
  tabletopAnimator?.after?.(inGame?state.game:null,session?.id,page);
  if(inGame&&replayFrames.length){const replayLayer=app.querySelector?.('[data-replay-layer]');if(replayLayer){replayAnimator=createTabletopAnimator({root:replayLayer});replayAnimator.after(replayFrames[replayIndex].frame,'replay','#/game');fitReplay(replayLayer,replayFrames[replayIndex]);}}
  const nextDock=app.querySelector?.('.tt6-dock-scroll');if(nextDock){nextDock.scrollTop=dockScroll;nextDock.scrollLeft=dockX;}
  const nextPile=app.querySelector?.('.tt6-pile-scroll');if(nextPile)nextPile.scrollTop=pileScroll;
  const newDiscardStrip=app.querySelector?.('.tt8-discard-history');if(newDiscardStrip)newDiscardStrip.scrollLeft=discardWasAtEnd?newDiscardStrip.scrollWidth:discardX;
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
  for(const node of app.querySelectorAll?.('.page,.tt4-overlay')||[]){if(gameOverlay||replayFrames.length)node.setAttribute?.('inert','');else node.removeAttribute?.('inert');}
  if(replayFrames.length&&replayFocused){(app.querySelector?.(`[data-replay-layer] [data-action="${replayFocused}"]`)||app.querySelector?.('[data-replay-layer] [data-action="replayClose"]'))?.focus?.({preventScroll:true});}
  if(lastInputWasKeyboard&&focusKind&&!gameOverlay&&!replayFrames.length){const replacement=[...(app.querySelectorAll?.('[data-action],[data-pick],[data-setting],[data-expansion],[data-difficulty]')||[])].find(el=>el.dataset?.[focusKind]===focusValue);if(!app.querySelector?.('[data-tt4-dialog]')||app.querySelector('[data-tt4-dialog]').contains(replacement))replacement?.focus?.({preventScroll:true});}
}
function pick(id){
 const g=state?.game;if(g&&state?.room?.seat===g.active){
  const targets=eligibleDecisionCards(g);if(targets.has(id)){
   const p=g.pending||{};
   if(g.phase==='decision'){
    if(p.type==='coopSwap'){
    const personal=g.players[g.active].hand.some(c=>c.id===id),shared=g.shared?.some(c=>c.id===id);
    if(!personal&&!shared)return;
    if(personal)swapPersonalId=swapPersonalId===id?null:id;else swapSharedId=swapSharedId===id?null:id;
    if(swapPersonalId&&swapSharedId)return action({type:'coopSwap',option:'swap',personal:swapPersonalId,shared:swapSharedId});
    return render();
   }
   if(p.type==='door')return action({type:'chooseDoor',keyId:id});
    if(p.type==='nightmare'&&nightChoice)return action({type:'nightmare',option:nightChoice,cardId:id});
    if(p.type==='rally')return action({type:'rally',cardId:id});
    if(p.type==='premonitionDoor')return action({type:'premonitionDoor',doorId:id});
    if(p.type==='towerPenalty')return action({type:'towerPenalty',option:'discard',towerId:id});
   }
   if(g.phase==='action'&&mirrorTarget){if(mirrorPairSelection.has(id))mirrorPairSelection.delete(id);else if(mirrorPairSelection.size<2)mirrorPairSelection.add(id);return render();}

  }
 }
 selected=selected===id?null:id;render();
}
async function handle(actionName){
  if(actionName==='replayOpen'){if(page!=='#/game'||state?.room?.mode!=='coop')return;const frames=opponentReplay(state.replay,state.room.seat);if(frames.length<2)return;stopReplay();gameOverlay=null;pileOpen=null;replayFrames=frames;replayIndex=0;render();app.querySelector?.('[data-replay-layer] .tt9-replay-dialog')?.focus?.();return;}
  if(actionName==='replayClose'){stopReplay();render();app.querySelector?.('[data-action="replayOpen"]')?.focus?.({preventScroll:true});return;}
  if(actionName==='replayPrev'||actionName==='replayNext'){replayPlaying=false;if(replayTimer!==null)clearTimeout(replayTimer);replayTimer=null;replayIndex=Math.max(0,Math.min(replayFrames.length-1,replayIndex+(actionName==='replayNext'?1:-1)));return updateReplayStage();}
  if(actionName==='replayPlay'){replayPlaying=!replayPlaying;updateReplayStage();scheduleReplay();return;}
  if(replayFrames.length)return;
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
  if(actionName==='leaveRoom')return departRoom(false);
  if(actionName==='endRoom')return departRoom(true);
  if(actionName==='gameGoHome'){gameOverlay=null;gameRulesFromPause=false;return setRoute('#/');}
  if(actionName==='soloStart'){selectedMode='solo';return create('solo');}if(actionName==='coopStart'){selectedMode='coop';return create('coop');}
  if(actionName==='passReady'){passDevice=false;return render();}
  if(actionName==='startHotseat'){if(session&&!['hotseat','local'].includes(session.id)&&navigator.onLine!==false)return setError('Leave your online lobby before starting hot seat.');const n1=hotseatName1.trim(),n2=hotseatName2.trim();if(!n1||!n2)return setError('Enter both player names.');try{cancelStream();localEngine??=await import('./engine/game.js');const game=localEngine.newGame({mode:'coop',names:[n1,n2],config:currentSetup(),interactiveDraw:true,manualTurnEnd:true});localStorage.setItem('onirama.hotseat.v1',JSON.stringify(game));session={id:'hotseat',seat:0};localStorage.setItem('onirama.session',JSON.stringify(session));passDevice=true;beginGuestSession();await refresh();setRoute('#/game');}catch(e){setError(e.message);}return;}
  if(actionName.startsWith('multiplayerTab:')){multiplayerTab=actionName.slice(15)==='hotseat'?'hotseat':'online';return render();}
  if(actionName==='history')return setRoute('#/history');
  if(actionName==='tutorial'){tutorialStep=0;tutorialChapter=0;return setRoute('#/tutorial');}
  if(actionName==='tutorialBack'){if(tutorialStep>0)tutorialStep--;else if(tutorialChapter>0)tutorialStep=GUIDE_CHAPTERS[--tutorialChapter].entries.length-1;return render();}
  if(actionName==='tutorialNext'){if(tutorialStep<GUIDE_CHAPTERS[tutorialChapter].entries.length-1)tutorialStep++;else if(tutorialChapter<GUIDE_CHAPTERS.length-1){tutorialChapter++;tutorialStep=0;}return render();}
  if(actionName==='tutorialStart'){selectedMode='solo';selectedExpansions.clear();selectedDifficulties={};return setRoute('#/setup');}
  if(actionName==='historyClear'){if(confirm('Delete all completed game summaries stored in this browser?')){clearHistory(localStorage);return render();}return;}
  if(actionName==='presetSave'){try{const preset=savePreset(localStorage,document.querySelector('#presetName')?.value,currentSetup());return render();}catch(e){return setError(e.message);}}
  if(actionName.startsWith('presetLoad:')){const preset=readPresets(localStorage).find(p=>p.id===actionName.slice(11));if(!preset)return setError('Saved setup not found');selectedExpansions=new Set(preset.config.expansions);selectedDifficulties={...preset.config.difficulties};return render();}
  if(actionName.startsWith('presetDelete:')){const id=actionName.slice(13);if(confirm('Delete this saved setup?')){deletePreset(localStorage,id);return render();}return;}
  if(actionName==='exitFinished'){if(state?.game?.status==='active')return;return setRoute('#/');}
  if(actionName==='playAgain'){
    const finished=state?.game;if(!finished||finished.status==='active')return;
    const config=finished.config;
    if(IS_LOCAL_GAME()){
      try{localEngine??=await import('./engine/game.js');const hot=IS_HOTSEAT();const again=localEngine.newGame({mode:hot?'coop':'solo',config,names:hot?finished.players.map(p=>p.name):['You'],interactiveDraw:true,manualTurnEnd:hot});localStorage.setItem(hot?'onirama.hotseat.v1':'onirama.solo.v1',JSON.stringify(again));selected=null;gameOverlay=null;passDevice=hot;await refresh();setRoute('#/game');}catch(e){setError(e.message);}return;
    }
    if(finished.mode==='solo')return create('solo',config);
    return doRoom('restart',{expectedVersion:version});
  }
  if(actionName==='resumeLocalSolo'||actionName==='resumeLocalHotseat'){
    const hot=actionName==='resumeLocalHotseat',key=hot?'onirama.hotseat.v1':'onirama.solo.v1';
    if(!localStorage.getItem(key))return setError('That saved game is unavailable.');
    cancelStream();localEngine??=await import('./engine/game.js');
    session={id:hot?'hotseat':'local',seat:0};localStorage.setItem('onirama.session',JSON.stringify(session));
    passDevice=hot;state=null;version=0;await refresh();if(session)return setRoute('#/game');return;
  }
  if(actionName==='setup')return setRoute('#/setup');if(actionName==='roadmap')return setRoute('#/roadmap');if(actionName==='rules')return setRoute('#/rules');if(actionName==='joinPage')return setRoute('#/join');
  if(actionName==='solo'||actionName==='coop'){selectedMode=actionName;return setRoute('#/setup');}
  if(actionName==='chooseSolo'||actionName==='chooseCoop'){selectedMode=actionName==='chooseSolo'?'solo':'coop';return render();}
  if(actionName==='create')return create('solo');if(actionName==='join')return join();
  if(actionName==='resume'){await refresh();if(!state)return;setRoute('#/game');return startStream();}
  if(actionName==='testBackend'&&USE_FIREBASE){try{const data=await firebase.testFirebase();return setError('Firebase anonymous session connected to '+data.projectId+'. Create a room to verify Firestore permissions.');}catch(e){return setError('Firebase connection failed: '+e.message);}}
  if(actionName==='testBackend'){try{const res=await fetch(`${base}/api/health`,{cache:'no-store'});const data=await res.json();if(!res.ok||data.ok!==true)throw Error('Server did not report healthy');return setError(`Multiplayer server is reachable (version ${data.version||'unknown'}).`);}catch(e){return setError('Cannot reach multiplayer server: '+e.message);}}
  if(actionName==='retryConnection'){return startStream();}
  if(actionName==='ready')return doRoom('ready',{ready:!state.room.ready[session.seat]});
  if(actionName==='start')return doRoom('start');
  if(actionName==='copyCode'||actionName==='copyInvite'){try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(actionName==='copyCode'?state.room.code:inviteLink(state.room.code));error=actionName==='copyCode'?'Room code copied.':'Invite link copied.';render();}catch{return setError('Clipboard permission unavailable. Select and copy the displayed code or invite link field instead.');}return;}
  if(actionName.startsWith('inspectCatcher:')){const index=Number(actionName.slice(15));if(Number.isInteger(index)&&index>=0&&index<4&&state?.game?.expansion?.dreamcatchers){
    if(failsafeChoosing){
      const g=state.game,d=g.expansion.dreamcatchers;
      if(g.phase==='action'&&state.room?.seat===g.active&&d.failsafes>0&&d.active[index]&&d.stacks[index]?.length){pileOpen=null;return action({type:'freeCatcher',index});}
      return;
    }
    if(searchFreeIntent){
      if(searchFreeCatchers(state.game).some(x=>x.i===index)){searchFreeIntent.selected=index;pileOpen=null;render();}
      return;
    }
    if(state.game.pending?.type==='doorSearch'&&doorSearchIntent){
      if(searchableCatchers(state.game,doorSearchIntent).some(x=>x.i===index)){doorSearchIntent.selected=index;pileOpen=null;render();}return;
    }
    const id=`catcher:${index}`;pileOpen=pileOpen===id?null:id;return render();}return;}
  if(actionName.startsWith('inspectPile:')){const pile=actionName.slice(12);if(['deck','discard','limbo','reserve'].includes(pile)){pileOpen=pileOpen===pile?null:pile;return render();}return;}
  if(actionName==='closePile'){pileOpen=null;return render();}
  if(actionName==='failsafeStart'){
    const g=state?.game,d=g?.expansion?.dreamcatchers;
    if(g?.phase==='action'&&state.room?.seat===g.active&&d?.failsafes>0&&d.active.some((a,i)=>a&&d.stacks[i]?.length)){failsafeChoosing=true;pileOpen=null;return render();}
    return;
  }
  if(actionName==='failsafeCancel'){failsafeChoosing=false;return render();}
  if(actionName==='choicePrev'){choicePage=Math.max(0,choicePage-1);return render();}
  if(actionName==='choiceNext'){choicePage++;return render();}
  if(actionName.startsWith('goalPick:')){const i=Number(actionName.slice(9));if(!spellOpen||spellChoice!=='parallel'||!Number.isInteger(i)||i<0||i>=(state?.game?.expansion?.book?.goals?.length||0))return;spellGoals=spellGoals.includes(i)?spellGoals.filter(j=>j!==i):[...spellGoals.slice(-1),i];return render();}
  if(actionName==='dialogClose'){if(state?.game?.phase!=='decision'||spellOpen)closeOptionalDialog();return;}
  if(actionName.startsWith('spellSelect:')){const next=actionName.slice('spellSelect:'.length);if(!['parallel','paradox','punishment'].includes(next))return;spellChoice=next;spellGoals=[];return render();}
  if(actionName==='openSpells'){spellOpen=true;spellSelected.clear();spellGoals=[];choicePage=0;freeSearchId='';return render();}
  if(actionName==='clearError'){error='';return render();}
  if(!state?.game||state.room?.paused||IS_HOTSEAT()&&passDevice)return;
  const g=state.game;if(state.room.seat!==g.active)return;
  if(actionName==='endTurn'&&g.phase==='turnComplete')return action({type:'endTurn'});
  if(['play','discard','towerLeft','towerRight'].includes(actionName)&&selected){
    const targets=g.mode==='coop'?cooperativeLegalTargets(g,selected,state.room.seat):soloLegalTargets(g,selected,state.room.seat);
    if(!targets.includes(actionName))return;
    if(actionName==='discard'&&g.mode==='coop')return action({type:'discard',id:selected});
    if(actionName.startsWith('tower'))return action({type:'playTower',id:selected,side:actionName==='towerLeft'?'left':'right'});
    return action({type:actionName,id:selected});
  }
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
    mirrorTarget=null;mirrorPairSelection.clear();return m==='green'&&(g.expansion?.mirrors?.stacks?.green?.length===2)?beginSearchFree(g,{type:'mirrorPair',mirror:m,ids}):action({type:'mirrorPair',mirror:m,ids});
  }
  if(actionName==='mirrorRewardConfirm'){const ids=[...mirrorSelection],color=document.querySelector('#mirrorColor')?.value;mirrorSelection.clear();const command={type:'mirrorReward',ids,color};return g.pending?.mirror!=='blue'?beginSearchFree(g,command):action(command);}
  if(actionName.startsWith('mirror:'))return action({type:'nightmare',option:'mirror',denizenId:actionName.slice(7)});
  if(actionName==='happyBanishStart'){if(g.pending?.type==='happyDream'&&(g.expansion?.premonitions?.faceUp||[]).length){happyBanishMode=true;happyPremonitionChoice=null;render();}return;}
  if(actionName==='happyBanishCancel'){happyBanishMode=false;happyPremonitionChoice=null;return render();}
  if(actionName.startsWith('happyPremonitionSelect:')){const id=actionName.slice('happyPremonitionSelect:'.length);if(happyBanishMode&&state?.game?.pending?.type==='happyDream'&&state?.room?.seat===state.game.active&&state.game.expansion?.premonitions?.faceUp?.includes(id)){happyPremonitionChoice=happyPremonitionChoice===id?null:id;return render();}return;}
  if(actionName==='happyBanishConfirm'){if(happyBanishMode&&happyPremonitionChoice&&state?.game?.pending?.type==='happyDream'&&state.game.expansion?.premonitions?.faceUp?.includes(happyPremonitionChoice))return action({type:'happyDream',option:'banish',premonitionId:happyPremonitionChoice});return;}
  if(actionName.startsWith('happyBanish:'))return action({type:'happyDream',option:'banish',premonitionId:actionName.slice(12)});
  if(actionName==='happyPeek')return action({type:'happyDream',option:'peek'});
  if(actionName==='happyFetch'){happyFetchSelection=null;return action({type:'happyDream',option:'fetch'});}
  if(actionName.startsWith('happyFetchPick:')&&g.pending?.type==='happyFetch'){
    const id=actionName.slice('happyFetchPick:'.length);
    if(g.pending.options.some(c=>c.id===id)){happyFetchSelection=happyFetchSelection===id?null:id;return render();}
    return;
  }
  if(actionName==='happyFetchSelect'&&g.pending?.type==='happyFetch'&&g.pending.options.some(c=>c.id===happyFetchSelection))return beginSearchFree(g,{type:'happyFetch',cardId:happyFetchSelection});
  if(actionName.startsWith('searchFree:')&&searchFreeIntent){
    const [,mode,index]=actionName.split(':'),freeId=mode==='free'?Number(index):undefined;
    if(mode!=='pass'&&!(mode==='free'&&searchFreeCatchers(g).some(x=>x.i===freeId)))return;
    const cmd={...searchFreeIntent.command,...(freeId!==undefined?{freeId}:{})};searchFreeIntent=null;return action(cmd);
  }
  if(actionName.startsWith('rally:'))return action({type:'rally',cardId:actionName.slice(6)});
  if(actionName.startsWith('premonitionPick:'))return action({type:'premonitionPick',id:actionName.slice(16)});
  if(actionName.startsWith('premonitionDoor:'))return action({type:'premonitionDoor',doorId:actionName.slice(16)});
  if(actionName.startsWith('premonitionKey:')&&g.pending?.type==='premonitionKeys'){
    const id=actionName.slice(15);if(!g.pending.options.some(c=>c.id===id))return;
    if(premonitionKeysSelected.has(id))premonitionKeysSelected.delete(id);else if(premonitionKeysSelected.size<g.pending.count)premonitionKeysSelected.add(id);return render();
  }
  if(actionName==='premonitionKeysConfirm'&&g.pending?.type==='premonitionKeys'&&premonitionKeysSelected.size===g.pending.count)return action({type:'premonitionKeys',ids:[...premonitionKeysSelected]});
  if(actionName.startsWith('premonitionNightmare:')&&g.pending?.type==='premonitionNightmare')return action({type:'premonitionNightmare',id:actionName.slice(21)});
  if(actionName.startsWith('effectRestore:')){effectDiscards.delete(actionName.slice(14));return render();}
  if(actionName.startsWith('effectDiscard:')){const id=actionName.slice(14);if(effectDiscards.has(id))effectDiscards.delete(id);else effectDiscards.add(id);return render();}
  if(actionName.startsWith('denizen:')){const id=actionName.slice(8),denizen=(g.expansion?.oniverse?.rallied||[]).find(d=>d.id===id&&d.owner===g.active);if(!denizen)return;denizenIntent={id,step:'confirm'};return render();}
  if(actionName==='denizenCancel'){denizenIntent=null;return render();}
  if(actionName==='denizenUse'&&denizenIntent){const d=(g.expansion?.oniverse?.rallied||[]).find(x=>x.id===denizenIntent.id&&x.owner===g.active);if(!d)return;const a=d.ability;
    if(a==='mirror'&&g.pending?.type==='nightmare')return action({type:'nightmare',option:'mirror',denizenId:d.id});
    if(a==='chromatic'&&g.pending?.type==='door'){denizenIntent.step='chromaticKey';return render();}
    if(a==='chromatic'&&g.pending?.type==='doorSearch'){denizenIntent=null;doorSearchChromatic=true;doorSearchIntent=null;return render();}
    if(['squirrel','harpoon','hammer'].includes(a))return action({type:'useDenizen',id:d.id});
    if(['architect','keeper','cyclobot'].includes(a)){denizenIntent.step='pick';return render();}return;
  }
  if(actionName.startsWith('denizenCard:')&&denizenIntent?.step==='pick'){
    const id=actionName.slice(12),d=(g.expansion?.oniverse?.rallied||[]).find(x=>x.id===denizenIntent.id&&x.owner===g.active);
    const pool=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared||[]:[]),...(d?.ability!=='keeper'?(g.expansion?.oniverse?.treasure||[]).filter(c=>c.owner===g.active):[])];
    if(!d||!pool.some(c=>c.id===id))return;
    if(d.ability==='cyclobot'){denizenIntent={...denizenIntent,step:'discard',cardId:id};return render();}
    return action({type:'useDenizen',id:d.id,cardId:id});
  }
  if(actionName.startsWith('denizenChromaticKey:')&&denizenIntent?.step==='chromaticKey'){
    const id=actionName.slice('denizenChromaticKey:'.length),p=g.pending;
    if(p?.type==='door'&&p.keys.some(k=>k.id===id))return action({type:'chooseDoor',keyId:id});
    return;
  }
  if(actionName.startsWith('denizenDiscard:')&&denizenIntent?.step==='discard'){
    const id=actionName.slice(15);if(!g.discard.some(c=>c.id===id&&c.kind==='location'))return;
    return action({type:'useDenizen',id:denizenIntent.id,cardId:denizenIntent.cardId,discardId:id});
  }
  if(actionName==='cyclobotCancel'){cyclobotTarget=null;return render();}
  if(actionName.startsWith('cyclobotSwap:')){
    if(!cyclobotTarget||!selected)return setError('Select a hand Location and a rallied Cyclobot first.');
    const denizenId=cyclobotTarget;cyclobotTarget=null;
    return action({type:'useDenizen',id:denizenId,cardId:selected,discardId:actionName.slice(14)});
  }
  if(actionName==='swapPass'&&g.phase==='decision'&&g.pending?.type==='coopSwap')return action({type:'coopSwap',option:'pass'});
  if(actionName==='towerLeft'||actionName==='towerRight'){if(!selected)return setError('Choose a Tower.');return action({type:'playTower',id:selected,side:actionName==='towerLeft'?'left':'right'});}
  if(actionName==='play'||actionName==='discard'){
    if(!selected)return setError('Select a card first.');
    const c=[...g.players[g.active].hand,...(g.mode==='coop'?g.shared:[]),...(g.mode==='solo'?g.expansion?.oniverse?.treasure||[]:[])].find(x=>x.id===selected);
    if(!c)return setError('Selected card is not available.');
    if(actionName==='play'&&g.players[g.active].labyrinth.at(-1)?.symbol===c.symbol)return setError('The next Location needs a different symbol.');
    const command={type:actionName,id:selected};
    if(actionName==='discard'&&g.mode==='coop')return action({type:'discard',id:selected});
    return action(command);
  }
  if(actionName==='draw'||actionName==='confirmDraw')return action({type:actionName});
  if(actionName.startsWith('doorSearch:')){
    const [,mode,id,flag]=actionName.split(':');if(g.pending?.type!=='doorSearch')return;
    const chromatic=flag==='chromatic';
    if(mode==='chromatic'){
      const denizen=(g.expansion?.oniverse?.rallied||[]).find(d=>d.owner===g.active&&d.ability==='chromatic');
      if(denizen){denizenIntent={id:denizen.id,step:'confirm'};return render();}return;
    }
    if(mode==='normal'){doorSearchChromatic=false;doorSearchIntent=null;return render();}
    if(mode==='skip'){doorSearchIntent=null;doorSearchChromatic=false;return action({type:'doorSearch',option:'skip'});}
    if(mode==='free'||mode==='passFree'){
      if(!doorSearchIntent)return;
      const freeId=mode==='free'?Number(id):undefined;
      if(mode==='free'&&!searchableCatchers(g,doorSearchIntent).some(x=>x.i===freeId))return;
      const cmd={type:'doorSearch',...doorSearchIntent,freeId};delete cmd.selected;
      doorSearchIntent=null;doorSearchChromatic=false;return action(cmd);
    }
    if(mode==='direct'){
      const target=g.pending.targets?.find(t=>t.id===id&&t.source.startsWith('catch'));
      if(!target||chromatic!==(target.color!==g.pending.color&&target.color!=='wild'))return;
      doorSearchIntent=null;doorSearchChromatic=false;
      return action({type:'doorSearch',option:'claim',doorId:id,...(chromatic?{chromatic:true}:{})});
    }
    if(['choose','shuffle','search'].includes(mode)){
      const target=g.pending.targets?.find(t=>t.id===id),color=mode==='search'?id:target?.color;
      if(mode!=='search'&&!target)return;
      if(mode==='shuffle'&&target.source==='deck')return;
      if(chromatic!==(color!==g.pending.color&&color!=='wild'))return;
      doorSearchIntent={option:mode==='search'?'search':'claim',...(target?{doorId:id}:{doorColor:color}),...(mode==='shuffle'?{searchBeforeClaim:true}:{}),...(chromatic?{chromatic:true}:{}),selected:null};
      pileOpen=null;
      if(!g.expansion?.dreamcatchers||!searchableCatchers(g,doorSearchIntent).length){const cmd={type:'doorSearch',...doorSearchIntent};delete cmd.selected;doorSearchIntent=null;doorSearchChromatic=false;return action(cmd);}
      return render();
    }
    if(mode==='claim')return action({type:'doorSearch',option:'claim',doorId:id});
  }
  if(actionName==='useKey:gain'){const pending=g.pending,hand=[...g.players[g.active].hand,...(g.shared||[])];const best=pending?.keys?.map(k=>hand.find(c=>c.id===k.id)).filter(Boolean).sort((a,b)=>{const rank=c=>pending.card.color==='wild'?(c.color==='wild'?1:0):(c.color===pending.card.color?0:c.color==='wild'?1:2);return rank(a)-rank(b);})[0];if(!best)return setError('No eligible Key to claim this Door.');return action({type:'chooseDoor',keyId:best.id});}
  if(actionName.startsWith('useKey:'))return action({type:'chooseDoor',keyId:actionName.slice(7)});
  if(actionName.startsWith('nightKey:'))return action({type:'nightmare',option:'key',cardId:actionName.slice(9)});
  if(actionName.startsWith('nightDoor:'))return action({type:'nightmare',option:'door',cardId:actionName.slice(10)});
  if(actionName.startsWith('nightChoose:')){nightChoice=nightChoice===actionName.slice(12)?null:actionName.slice(12);return render();}
  if(actionName==='nightReveal')return action({type:'nightmare',option:'reveal'});
  if(actionName==='nightHand')return action({type:'nightmare',option:'hand'});
  if(actionName.startsWith('prophecyDiscard:')){prophecyDiscard=actionName.slice(16);return render();}
  if(actionName.startsWith('freeCatcher:'))return action({type:'freeCatcher',index:Number(actionName.slice(12))});
  if(actionName.startsWith('catchChoose:'))return action({type:'catchChoose',index:Number(actionName.slice(12))});
  if(actionName==='catchOverload:remove')return action({type:'catchOverload'});
  if(actionName.startsWith('towerPenalty:'))return action({type:'towerPenalty',option:'discard',towerId:actionName.slice(13)});
  if(actionName==='towerFake')return action({type:'towerPenalty',option:'fake'});
  if(actionName.startsWith('spellCost:')){const id=actionName.slice(10);if(spellSelected.has(id))spellSelected.delete(id);else spellSelected.add(id);return render();}
  if(actionName==='castSpell'){const g=state?.game,eligibility=spellEligibility(g,spellChoice,spellGoals);if(!spellOpen||!eligibility.ready)return;const [a,b]=spellGoals;return action({type:'cast',spell:spellChoice,...(spellChoice==='parallel'?{first:a,second:b}:{})});}
  if(actionName.startsWith('incantationClaim:')&&g.pending?.type==='incantation')return action({type:'incantationClaim',doorId:actionName.slice('incantationClaim:'.length)});
  if(actionName.startsWith('effectPick:')){effectPick=actionName.slice(11);return render();}
  if(actionName.startsWith('moduleDecision:'))return action({type:'moduleDecision',decisionId:g.pending.id,choice:decodeURIComponent(actionName.slice(15))});
  if(actionName==='effectConfirm'){const p=state.game.pending;if(p.type==='incantation'&&p.cards.some(c=>c.kind==='door'))return;const cards=p.cards;if(p.type==='happyPeek')return action({type:'happyPeek',discardIds:[...effectDiscards],order:effectOrder.filter(id=>!effectDiscards.has(id))});if(p.type==='denizenPeek')return action({type:'denizenPeek',order:effectOrder});return p.type==='incantationOrder'?action({type:'incantationOrder',order:effectOrder}):p.type==='towerLook'?action({type:'towerLook',order:effectOrder}):p.type==='spellPeek'?action({type:'spellPeek',topId:effectPick,bottomOrder:effectOrder.filter(id=>id!==effectPick)}):action({type:'incantation',doorId:effectPick||null,order:effectOrder.filter(id=>id!==effectPick)});}
  if(actionName==='prophecyConfirm'){if(!prophecyDiscard)return setError('Choose one card to discard.');return action({type:'prophecy',discardId:prophecyDiscard,order:prophecyOrder.filter(id=>id!==prophecyDiscard)});}
}
// Interaction adapter: gestures never mutate state. They produce the same
// validated play/discard commands as the original buttons.
let tabletopController=null,dialogController=null,cardInspector=null;
let tabletopAnimator=typeof createTabletopAnimator==='function'?createTabletopAnimator({root:app}):null;
function installTabletopController(){
  if(typeof createTabletopInteractions!=='function')return; // lightweight legacy UI test harness
  tabletopController=createTabletopInteractions({
    root:app,getGame:()=>state?.game,getSeat:()=>state?.room?.seat??-1,
    isBusy:()=>busy||!state?.room?.started,
    onDrop:(id,rect)=>tabletopAnimator?.dragRelease?.(id,rect),
    onSwap:(personal,shared)=>{if(state?.game?.phase==='decision'&&state.game.pending?.type==='coopSwap')return action({type:'coopSwap',option:'swap',personal,shared});},
    onSelect:id=>{if(page==='#/game'&&state?.game&&['solo','coop'].includes(state.game.mode))pick(id);},
    onCommand:(type,id)=>{
      if(page!=='#/game'||busy||!state?.game)return;
      const targets=state.game.mode==='coop'?cooperativeLegalTargets(state.game,id,state.room?.seat):soloLegalTargets(state.game,id,state.room?.seat);
      if(!targets.includes(type))return;
      if(type==='discard'&&state.game.mode==='coop')return action({type:'discard',id});
      if(type==='towerLeft'||type==='towerRight')return action({type:'playTower',id,side:type==='towerLeft'?'left':'right'});
      return action({type,id});
    }
  });
  createDecisionReorder({root:app,
    canReorder:kind=>!busy&&page==='#/game'&&state?.game?.phase==='decision'&&state.room?.seat===state.game.active&&['effect','prophecy'].includes(kind)&&!(kind==='effect'&&state.game.pending?.type==='incantation'&&state.game.pending.cards.some(c=>c.kind==='door')),
    onDiscard:id=>{if(state?.game?.pending?.type==='happyPeek'){effectDiscards.add(id);render();return;}if(state?.game?.pending?.type!=='prophecy')return;prophecyDiscard=id;render();},
    onRestore:(id,gap)=>{if(state?.game?.pending?.type!=='happyPeek'||!effectDiscards.has(id))return;
      effectOrder=restoreDiscardedCardToGap(effectOrder,effectDiscards,id,gap);
      effectDiscards.delete(id);render();
    },
    onReorder:(kind,from,gap)=>{
      if(busy||state?.game?.phase!=='decision'||state.room?.seat!==state.game.active)return;
      if(kind==='prophecy'&&state.game.pending?.type==='prophecy'){if(!prophecyDiscard)return;const ids=prophecyOrder.filter(id=>id!==prophecyDiscard);const moved=moveOrderedCardToGap(ids,from,gap);prophecyOrder=[...moved,...(prophecyDiscard?[prophecyDiscard]:[])];}
      else if(kind==='effect'&&state.game.pending?.type==='happyPeek'){const kept=effectOrder.filter(id=>!effectDiscards.has(id)),discarded=effectOrder.filter(id=>effectDiscards.has(id));effectOrder=[...moveOrderedCardToGap(kept,from,gap),...discarded];}
      else if(kind==='effect'&&state.game.pending?.type!=='prophecy')effectOrder=moveOrderedCardToGap(effectOrder,from,(state.game.pending?.type==='confusion'?orderSlice(effectOrder).offset:0)+gap);
      else return;
      render();
    }
  });
}
function syncCodeBoxes(){const boxes=[...app.querySelectorAll('[data-code-index]')];joinCode=boxes.map(x=>x.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,1)).join('');const hidden=app.querySelector('#roomcode');if(hidden)hidden.value=joinCode;}
function codeFocus(i){const boxes=[...app.querySelectorAll('[data-code-index]')];const first=boxes.findIndex(x=>!x.value);const target=boxes[first>=0&&i>=first?first:Math.max(0,Math.min(boxes.length-1,i))];target?.focus();target?.select();}
app.addEventListener('input',e=>{if(e.target?.dataset?.codeIndex!==undefined){const i=Number(e.target.dataset.codeIndex);e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(-1);syncCodeBoxes();if(e.target.value)codeFocus(i+1);return;}if(e.target?.matches?.('[data-guide-search]')){filterGuide(e.target.closest('[data-guide-root]'),e.target.value);return;}if(e.target?.id==='name'){playerDisplayName=String(e.target.value).slice(0,40);const button=app.querySelector('[data-action="coopStart"]');if(button)button.disabled=!playerDisplayName.trim();}if(e.target?.id==='joinname'){partnerDisplayName=String(e.target.value).slice(0,40);const button=app.querySelector('[data-action="join"]');if(button)button.disabled=!partnerDisplayName.trim();}if(e.target?.id==='hotseatName1')hotseatName1=String(e.target.value).slice(0,40);if(e.target?.id==='hotseatName2')hotseatName2=String(e.target.value).slice(0,40);});
app.addEventListener('change',e=>{if(e.target?.matches?.('[data-tutorial-chapter]')){const chapter=Number(e.target.value);if(Number.isInteger(chapter)&&chapter>=0&&chapter<GUIDE_CHAPTERS.length){tutorialChapter=chapter;tutorialStep=0;render();}return;}if(e.target?.dataset?.mirrorPair){if(e.target.checked)mirrorPairSelection.add(e.target.dataset.mirrorPair);else mirrorPairSelection.delete(e.target.dataset.mirrorPair);return;}if(e.target?.dataset?.mirrorChoice){if(e.target.checked)mirrorSelection.add(e.target.dataset.mirrorChoice);else mirrorSelection.delete(e.target.dataset.mirrorChoice);return;}if(e.target?.dataset?.expansion){const id=e.target.dataset.expansion;if(e.target.checked){if(id==='incubus')selectedExpansions.clear();else selectedExpansions.delete('incubus');selectedExpansions.add(id);}else{selectedExpansions.delete(id);delete selectedDifficulties[id];}if(page==='#/multiplayer'&&state?.room&&!state.room.started&&!IS_LOCAL_GAME())return doRoom('setup',{config:currentSetup()});return render();}if(e.target?.dataset?.difficulty){selectedDifficulties[e.target.dataset.difficulty]=e.target.value;if(page==='#/multiplayer'&&state?.room&&!state.room.started&&!IS_LOCAL_GAME())return doRoom('setup',{config:currentSetup()});return render();}if(e.target?.dataset?.spellChoice){spellChoice=e.target.value;spellSelected.clear();spellGoals=[];choicePage=0;return render();}const key=e.target?.dataset?.setting;if(!['theme','motion','cardSize','contrast','textSize'].includes(key))return;const value=e.target.value;if(key==='theme'&&!THEME_PRESETS.some(t=>t.id===value))return;if(key==='motion'&&!['normal','reduced'].includes(value))return;if(key==='cardSize'&&!['normal','large'].includes(value))return;if(key==='contrast'&&!['normal','high'].includes(value))return;if(key==='textSize'&&!['normal','large'].includes(value))return;uiSettings[key]=value;localStorage.setItem(SETTINGS_KEY,JSON.stringify(uiSettings));applySettings();render();});
app.addEventListener('paste',e=>{if(e.target?.dataset?.codeIndex===undefined)return;const pasted=e.clipboardData?.getData('text')?.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);if(!pasted)return;e.preventDefault();app.querySelectorAll('[data-code-index]').forEach((node,i)=>node.value=pasted[i]||'');syncCodeBoxes();codeFocus(pasted.length);});
app.addEventListener('pointerdown',()=>{lastInputWasKeyboard=false;},true);
app.addEventListener('touchstart',()=>{lastInputWasKeyboard=false;},{capture:true,passive:true});
app.addEventListener('keydown',e=>{if(['Tab','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))lastInputWasKeyboard=true;},true);
app.addEventListener('click',e=>{
  if(e.target.closest?.('[data-notice-backdrop]')&&!e.target.closest?.('.shell-notice-dialog')){handle('clearError');return;}
  if(e.target?.dataset?.codeIndex!==undefined){const boxes=[...app.querySelectorAll('[data-code-index]')];const first=boxes.findIndex(x=>!x.value);if(first>=0&&first<Number(e.target.dataset.codeIndex))codeFocus(first);return;}
  if(IS_HOTSEAT()&&passDevice&&!e.target.closest?.('[data-action="passReady"]'))return;
  if(e.target.closest?.('[data-replay-stage]')){e.preventDefault();return;}
  if(replayFrames.length&&!e.target.closest?.('[data-replay-layer]')){e.preventDefault();return;}
  if(e.target.closest?.('[data-game-menu-dismiss]')){handle('closeGameOverlay');return;}
  if(pileOpen&&!e.target.closest?.('[data-pile-inspector],[data-action^="inspectPile:"],[data-action^="inspectCatcher:"]')){pileOpen=null;render();return;}
  const jump=e.target.closest?.('[data-guide-jump]');if(jump){const root=jump.closest('[data-guide-root]'),chapter=[...(root?.querySelectorAll('[data-guide-chapter]')||[])].find(el=>el.dataset.guideChapter===jump.dataset.guideJump);if(chapter){if(chapter.hidden){const search=root?.querySelector('[data-guide-search]');if(search)search.value='';filterGuide(root,'');}chapter.querySelector('[data-guide-entry]')?.setAttribute('open','');chapter.scrollIntoView?.({block:'start',behavior:'smooth'});}return;}
  const target=e.target.closest('[data-action],[data-pick]');if(!target||target.getAttribute('aria-disabled')==='true')return;
  if(gameOverlay&&!target.closest?.('[data-game-menu-dialog]'))return;
  if(target.dataset.pick){if(state?.game?.phase==='draft')handle(`draft:${target.dataset.pick}`);else pick(target.dataset.pick);return;}
  handle(target.dataset.action);
});
app.addEventListener('keydown',e=>{
  if(e.target?.dataset?.codeIndex!==undefined){const i=Number(e.target.dataset.codeIndex),boxes=[...app.querySelectorAll('[data-code-index]')];if(e.key==='Backspace'){e.preventDefault();const pos=boxes[i]?.value?i:Math.max(0,i-1);if(boxes[pos])boxes[pos].value='';syncCodeBoxes();codeFocus(pos);return;}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();codeFocus(i+(e.key==='ArrowRight'?1:-1));return;}if(e.key.length===1&&/^[a-z]$/i.test(e.key)){e.preventDefault();boxes[i].value=e.key.toUpperCase();syncCodeBoxes();codeFocus(i+1);return;}}
  if(error&&e.key==='Escape'){e.preventDefault();handle('clearError');return;}
  if(IS_HOTSEAT()&&passDevice&&e.key==='Escape'){e.preventDefault();return;}
  if(replayFrames.length){
    if(e.key==='Escape'){e.preventDefault();handle('replayClose');return;}
    if(e.key==='Tab'){
      const dialog=app.querySelector?.('[data-replay-layer] .tt9-replay-dialog');
      const items=[...(dialog?.querySelectorAll?.('button:not([disabled])')||[])].filter(el=>el.getClientRects?.().length!==0);
      if(!items.length)return;
      const first=items[0],last=items.at(-1),active=document.activeElement;
      if(e.shiftKey&&(active===first||!dialog.contains(active))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(active===last||!dialog.contains(active))){e.preventDefault();first.focus();}
    }
    return;
  }
  // Expansion tiles are intentionally not nested buttons (some contain an
  // independent action button). Make their button roles operable from a keyboard.
  if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.tt5-tile[role="button"][data-action]')){
    if(!gameOverlay){e.preventDefault();handle(e.target.dataset.action);}return;
  }
  if(pileOpen&&e.key==='Escape'&&!gameOverlay){e.preventDefault();pileOpen=null;render();return;}
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
addEventListener('online',()=>{render();if(session&&!IS_LOCAL_GAME())startStream();});
addEventListener('offline',()=>{render();});
addEventListener('pageshow',e=>{if(e.persisted&&session&&!IS_LOCAL_SOLO())startStream();});
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden&&session&&!IS_LOCAL_SOLO()){if(streamAbort===null)startStream();else if(session.transport==='firebase')startStream();else refresh();}});
render();if(typeof createCardInspector==='function')cardInspector=createCardInspector({root:app});installTabletopController();if(typeof createDialogController==='function')dialogController=createDialogController({root:app,onDismiss:closeOptionalDialog});dialogController?.sync();if(STATIC_SITE||IS_HOTSEAT()){import('./engine/game.js').then(async m=>{localEngine=m;if(IS_LOCAL_GAME()){if(IS_HOTSEAT())passDevice=true;return refresh();}if(session&&CAN_MULTIPLAYER){await refresh();if((location.hash||'#/')==='#/game')startStream();}}).catch(e=>setError('Unable to load rules engine: '+e.message));}else if(session){refresh().then(()=>{if((location.hash||'#/')==='#/game'||page==='#/multiplayer')startStream();});}

// Phase 1: attach layout metrics after orientation changes without changing game commands.
function resizeGameplay(){if(replayFrames.length)fitReplay(app.querySelector?.('[data-replay-layer]'),replayFrames[replayIndex]);if(page==='#/game'&&state?.room.started){applyTabletopMetrics(app.querySelector?.('.tt2-root'),{mode:state.game.mode,expansions:state.game.config?.expansions||[]});fitGameTabletop();}}
// iOS applies the new visual viewport in multiple passes during rotation.
// Never rescale on card selection; refit only on actual viewport changes.
let lastViewport='',orientationRefits=[];
function settleViewport(){
 const next=`${window.innerWidth}x${window.innerHeight}:${window.visualViewport?.width||0}x${window.visualViewport?.height||0}`;
 if(next!==lastViewport){lastViewport=next;resizeGameplay();}
 for(const timer of orientationRefits)clearTimeout(timer);
 orientationRefits=[80,220,480].map(ms=>setTimeout(()=>{lastViewport='';settleViewportOnce();},ms));
}
function settleViewportOnce(){lastViewport=`${window.innerWidth}x${window.innerHeight}:${window.visualViewport?.width||0}x${window.visualViewport?.height||0}`;resizeGameplay();}
addEventListener('resize',()=>{settleViewportOnce();});
if(typeof window!=='undefined'){
 window.visualViewport?.addEventListener?.('resize',resizeGameplay);
 window.addEventListener?.('orientationchange',settleViewport);
 window.addEventListener?.('pageshow',settleViewportOnce);
}


// Only the built static/PWA site installs the offline shell; local development
// continues to use the Node server without registering a missing worker.
if(STATIC_SITE&&'serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'})
    .catch(e=>console.warn('Offline installation unavailable:',e));
}
