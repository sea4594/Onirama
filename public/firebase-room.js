// BibleGuessr-style Firestore multiplayer: anonymous auth, transactions, onSnapshot.
// No separate Node server is required. These client-side cooperative rooms assume trusted players.
import {ROOM_COLLECTION,makeRoom,allocateRoom,joinRoom,setReady,updateSetup,startRoom,restartRoom,playRoom,leaveRoom,endRoom,roomView,seatFor} from './engine/firebase-protocol.js';
import {explainRoomPermissionError} from './firebase-permissions.js';
import {toFirestore,fromFirestore} from './firebase-wire.js';
import {createOptimisticQueue,canonicalGameKey} from './firebase-optimistic.js';
let clientPromise;
const roomCache=new Map(),actionQueues=new Map();
function remember(code,room){const key=String(code).toUpperCase(),prior=roomCache.get(key);if(!room.__localUid&&prior?.__localUid)Object.defineProperty(room,'__localUid',{value:prior.__localUid,configurable:true});if(!prior||room.version>=prior.version)roomCache.set(key,room);}
export function hasPendingFirebaseActions(code){return !!actionQueues.get(String(code).toUpperCase())?.hasPending();}
function config(){const c=window.ONIRAMA_FIREBASE_CONFIG;return c&&['apiKey','authDomain','projectId','appId'].every(k=>typeof c[k]==='string'&&c[k].length)?c:null;}
export function firebaseConfigured(){return !!config();}
async function connect(){
  if(!firebaseConfigured())throw Error('Firebase is not configured. See Settings for setup instructions.');
  if(!clientPromise)clientPromise=(async()=>{
    const [appMod,authMod,storeMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
    const app=appMod.getApps().find(a=>a.name==='onirama-multiplayer')||appMod.initializeApp(config(),'onirama-multiplayer');
    const auth=authMod.getAuth(app);
    // Wait for persistence and auth restoration BEFORE checking currentUser or subscribing.
    await authMod.setPersistence(auth,authMod.browserLocalPersistence);
    await auth.authStateReady();
    if(!auth.currentUser)await authMod.signInAnonymously(auth);
    if(!auth.currentUser)throw Error('Anonymous Firebase authentication failed');
    return {uid:auth.currentUser.uid,db:storeMod.getFirestore(app),store:storeMod};
  })().catch(err=>{clientPromise=null;throw err;});
  return clientPromise;
}
function roomRef(c,code){return c.store.doc(c.db,ROOM_COLLECTION,String(code).toUpperCase());}
function code4(){let code='';while(code.length<4){const bytes=new Uint8Array(4);crypto.getRandomValues(bytes);for(const x of bytes){if(x<234&&code.length<4)code+=String.fromCharCode(65+x%26);}}return code;}
async function update(code,transition,operation='update'){const c=await connect();const ref=roomRef(c,code);
  try{
    const room=await c.store.runTransaction(c.db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('Room not found');const previous=fromFirestore(snap.data()),next=transition(previous,c.uid);if(next!==previous)tx.set(ref,toFirestore(next));return next;});
    Object.defineProperty(room,'__localUid',{value:c.uid,configurable:true});remember(code,room);return roomView(room,c.uid);
  }catch(err){throw explainRoomPermissionError(err,operation);}
}
export async function createFirebaseRoom(name,setup){
  const c=await connect();
  // A transaction cannot read a non-existent code under the published room get rules.
  // A direct set is a rules-protected CREATE for new IDs; an existing ID is an
  // UPDATE, which the existing room security rules reject. Retry unlikely collisions.
  const code=await allocateRoom((id,room)=>c.store.setDoc(roomRef(c,id),room),code4,c.uid,name,setup);
  return loadRoom(code);
}
// Blind, rules-validated claims do not grant nonmembers access to private hands.
// Try empty seat 0 first, then seat 1; legacy 8-digit rooms remain joinable.
export async function joinFirebaseRoom(code,name){
 const c=await connect(),ref=roomRef(c,code),label=String(name||'Partner').trim().slice(0,40)||'Partner';
 try{return await loadRoom(code);}catch(e){if(e?.code!=='permission-denied'&&!/another browser|Room not found/.test(e?.message||''))throw e;}
 for(const [uidField,nameField] of [['hostUid','hostName'],['guestUid','guestName']]){
  try{await c.store.updateDoc(ref,{[uidField]:c.uid,[nameField]:label,updatedAt:Date.now(),version:c.store.increment(1)});return loadRoom(code);}
  catch(e){if(e?.code!=='permission-denied')throw e;}
 }
 throw Error('Room is full, ended, or the invitation code is invalid.');
}
export async function loadRoom(code){const c=await connect(),snap=await c.store.getDoc(roomRef(c,code));if(!snap.exists())throw Error('Room not found or expired');const raw=fromFirestore(snap.data());Object.defineProperty(raw,'__localUid',{value:c.uid,configurable:true});remember(code,raw);return roomView(raw,c.uid);}
export async function firebaseReady(code,ready){return update(code,(room,uid)=>setReady(room,uid,ready),'ready');}
export async function firebaseSetup(code,config){return update(code,(room,uid)=>updateSetup(room,uid,config),'setup');}
export async function firebaseStart(code){return update(code,(room,uid)=>startRoom(room,uid),'start');}
export async function firebaseRestart(code){return update(code,(room,uid)=>restartRoom(room,uid),'restart');}
export async function firebaseLeave(code){const c=await connect(),ref=roomRef(c,code);await c.store.runTransaction(c.db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('Room not found');tx.set(ref,toFirestore(leaveRoom(fromFirestore(snap.data()),c.uid)));});}
export async function firebaseEnd(code){return update(code,(room,uid)=>endRoom(room,uid));}
export async function firebaseAction(code,version,command){return update(code,(room,uid)=>playRoom(room,uid,version,command),'play');}
// Prediction uses only a server-confirmed room snapshot held inside the Firebase
// adapter. The UI receives a seat-filtered view, never the raw game/deck.
export function firebaseActionImmediate(code,command,{onView,onError,beforeCommit}={}){
  const key=String(code).toUpperCase(),raw=roomCache.get(key);
  if(!raw)throw Error('Waiting for multiplayer synchronization.');
  let queue=actionQueues.get(key);
  if(!queue){
    // UID is taken from the authenticated Firebase client during submission;
    // local prediction uses the current room seat from the last view caller.
    queue=createOptimisticQueue({
      latest:()=>roomCache.get(key),
      predict:(room,entry)=>playRoom(room,entry.uid,room.version,entry.command),
      submit:async(entry,expectedGame)=>{
        const c=await connect(),ref=roomRef(c,key);
        try{
          const confirmed=await c.store.runTransaction(c.db,async tx=>{
            const snap=await tx.get(ref);if(!snap.exists())throw Error('Room not found');
            const before=fromFirestore(snap.data());
            if(canonicalGameKey(before)!==expectedGame)throw Error('Game changed on the other device. Actions have been resynchronized.');
            const after=playRoom(before,c.uid,before.version,entry.command);
            tx.set(ref,toFirestore(after));return after;
          });
          remember(key,confirmed);return confirmed;
        }catch(err){throw explainRoomPermissionError(err,'play');}
      },
      present:(room,speculative)=>{if(room)onView?.(roomView(room,callerUid),speculative);},
      failed:err=>onError?.(err)
    });
    actionQueues.set(key,queue);
  }
  const callerUid=roomCache.get(key)?.__localUid;
  if(!callerUid)throw Error('Multiplayer identity is not ready.');
  return queue.enqueue({uid:callerUid,command},beforeCommit);
}
export function clearFirebasePrediction(code){const key=String(code).toUpperCase();actionQueues.get(key)?.reset();actionQueues.delete(key);}

export async function watchFirebaseRoom(code,onUpdate,onError){
  const c=await connect(),ref=roomRef(c,code);
  return c.store.onSnapshot(ref,{includeMetadataChanges:true},snap=>{
    // Local speculative writes are not committed actions. Wait for the server
    // before allowing them into the visible multiplayer animation timeline.
    if(snap.metadata?.hasPendingWrites)return;
    if(!snap.exists())return onError(Error('Room deleted or unavailable'));
    try{const raw=fromFirestore(snap.data());Object.defineProperty(raw,'__localUid',{value:c.uid,configurable:true});remember(code,raw);if(!hasPendingFirebaseActions(code))onUpdate(roomView(raw,c.uid),{fromCache:!!snap.metadata?.fromCache});}catch(err){onError(err);}
  },onError);
}
export async function getFirebaseUid(){return (await connect()).uid;}
export async function testFirebase(){const c=await connect();return {ok:true,uid:c.uid,projectId:config().projectId};}
