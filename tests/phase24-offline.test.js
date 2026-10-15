import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

function build(){const dir=mkdtempSync(join(tmpdir(),'onirama-offline-'));execFileSync(process.execPath,['scripts/build-pages.js',dir],{stdio:'pipe'});return dir;}
const text=path=>readFileSync(path,'utf8');

test('built PWA precaches every local asset, including lazy rules engine and card illustrations',()=>{
 const dir=build();try{
  const worker=text(join(dir,'service-worker.js'));
  const list=JSON.parse(worker.match(/^const FILES=(.*);$/m)?.[1]||'null');
  assert(list.length>60,'expected complete build asset inventory');
  for(const path of ['index.html','app.js','runtime-config.js','onirama-styles.css','site.webmanifest','rules-guide.js','engine/game.js','engine/config.js','icons.js','icons/icon-192.png','icons/icon-512.png','apple-touch-icon.png'])assert(list.includes(path),path);
  assert.equal(new Set(list).size,list.length);
  assert(!list.some(path=>path.startsWith('api/')||path.includes('firebasejs')));
  assert.match(worker,/const VERSION="[a-f0-9]{16}";/);
  assert.match(worker,/const CACHE=`onirama-offline-\$\{VERSION\}`/);
  assert.match(text(join(dir,'runtime-config.js')),/window\.ONIRAMA_STATIC_BUILD = true;/);
  assert.match(text('public/app.js'),/serviceWorker\.register\('\.\/service-worker\.js'/);
  assert.match(text('public/app.js'),/ONIRAMA_STATIC_BUILD===true/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('service worker handles disconnected PWA launch, caches only app assets, and removes old revisions',async()=>{
 const dir=build();try{
  const listeners={},stores=new Map();const base='https://example.test/Onirama/';
  const fakeCaches={
   async open(key){if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);return {async addAll(urls){for(const url of urls)store.set(url,{source:'precache',url});},async match(url){return store.get(url)||null;}};},
   async keys(){return [...stores.keys()];},async delete(key){return stores.delete(key);},
   async match(url,{cacheName}={}){return stores.get(cacheName)?.get(url)||null;}
  };
  let wentOffline=false,claimed=false,skipped=false;
  const self={location:{origin:'https://example.test'},registration:{scope:base},clients:{claim:async()=>{claimed=true;}},skipWaiting:async()=>{skipped=true;},addEventListener:(type,cb)=>{listeners[type]=cb;}};
  const scope={self,caches:fakeCaches,URL,fetch:async()=>{if(wentOffline)throw Error('Network unavailable');return {source:'network'};}};
  vm.runInNewContext(text(join(dir,'service-worker.js')),scope);
  const lifecycle=async(type)=>{let promise;listeners[type]({waitUntil(p){promise=p;}});await promise;};
  await lifecycle('install');assert(skipped);
  const [newCache]=await fakeCaches.keys();assert.match(newCache,/^onirama-offline-/);
  stores.set('onirama-offline-stale',new Map());
  await lifecycle('activate');assert(claimed);assert.deepEqual(await fakeCaches.keys(),[newCache]);
  wentOffline=true;
  async function request(url,mode='same-origin',method='GET'){
   let response;listeners.fetch({request:{url,mode,method},respondWith(p){response=p;}});
   return response?await response:null;
  }
  assert.equal((await request(base,'navigate')).source,'precache');
  assert.equal((await request(base+'#/game','navigate')).url,base+'index.html');
  assert.equal((await request(base+'engine/game.js')).url,base+'engine/game.js');
  assert.equal((await request(base+'icons/icon-192.png?from=pwa')).url,base+'icons/icon-192.png');
  assert.equal(await request(base+'api/rooms/state'),null,'never cache or intercept multiplayer requests');
  assert.equal(await request('https://www.gstatic.com/firebasejs/firebase-auth.js'),null,'never cache or intercept Firebase');
  assert.equal(await request(base+'private-user-file'),null,'unknown assets must not enter app cache');
  assert.equal(await request(base+'engine/game.js','same-origin','POST'),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('solo and co-op draw pile counts have separate digit-aware sizing without truncating the card',()=>{
 for(const file of ['public/tabletop/solo-board.js','public/tabletop/coop-board.js'])assert.match(text(file),/data-count-digits="\$\{String\(m\.deckCount\)\.length\}"/);
 const css=text('public/tabletop/card-system.css');
 assert.match(css,/container-type:inline-size/);assert.match(css,/data-count-digits="3"/);assert.match(css,/data-count-digits="4"/);
 assert.match(css,/max-width:100%;min-width:0/);
});

test('offline multiplayer displays unavailability but retains hot-seat and solo routes',()=>{
 const app=text('public/app.js');
 assert.match(app,/offline=navigator\.onLine===false/);
 assert.match(app,/Offline: solo and hot seat still work/);
 assert.match(app,/playerDisplayName\.trim\(\)&&!offline/);
 assert.match(app,/partnerDisplayName\.trim\(\)&&!offline/);
 assert.match(app,/if\(STATIC_SITE&&mode==='solo'\)/);
 assert.match(app,/if\(actionName==='startHotseat'\)/);
});
