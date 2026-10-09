// BibleGuessr-style Firestore multiplayer: anonymous auth, transactions, onSnapshot.
// No separate Node server is required. These client-side cooperative rooms assume trusted players.
import {ROOM_COLLECTION,makeRoom,allocateRoom,joinRoom,setReady,startRoom,playRoom,roomView,seatFor} from './engine/firebase-protocol.js';
let clientPromise;
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
function code8(){const a=new Uint8Array(4);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
async function update(code,transition){const c=await connect();const ref=roomRef(c,code);
  await c.store.runTransaction(c.db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('Room not found');const previous=snap.data(),next=transition(previous,c.uid);if(next!==previous)tx.set(ref,next);});
  return loadRoom(code);
}
export async function createFirebaseRoom(name,setup){
  const c=await connect();
  // A transaction cannot read a non-existent code under the published room get rules.
  // A direct set is a rules-protected CREATE for new IDs; an existing ID is an
  // UPDATE, which the existing room security rules reject. Retry unlikely collisions.
  const code=await allocateRoom((id,room)=>c.store.setDoc(roomRef(c,id),room),code8,c.uid,name,setup);
  return loadRoom(code);
}
export async function joinFirebaseRoom(code,name){return update(code,(old,uid)=>joinRoom(old,uid,name));}
export async function loadRoom(code){const c=await connect(),snap=await c.store.getDoc(roomRef(c,code));if(!snap.exists())throw Error('Room not found or expired');return roomView(snap.data(),c.uid);}
export async function firebaseReady(code,ready){return update(code,(room,uid)=>setReady(room,uid,ready));}
export async function firebaseStart(code){return update(code,(room,uid)=>startRoom(room,uid));}
export async function firebaseAction(code,version,command){return update(code,(room,uid)=>playRoom(room,uid,version,command));}
export async function watchFirebaseRoom(code,onUpdate,onError){
  const c=await connect(),ref=roomRef(c,code);
  return c.store.onSnapshot(ref,snap=>{
    if(!snap.exists())return onError(Error('Room deleted or unavailable'));
    try{onUpdate(roomView(snap.data(),c.uid));}catch(err){onError(err);}
  },onError);
}
export async function getFirebaseUid(){return (await connect()).uid;}
export async function testFirebase(){const c=await connect();return {ok:true,uid:c.uid,projectId:config().projectId};}
