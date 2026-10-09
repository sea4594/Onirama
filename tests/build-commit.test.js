import {renderCard,renderDoors} from '../public/tabletop/cards.js';
import {applyTabletopMetrics} from '../public/tabletop/layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import * as guest from '../public/guest-data.js';

const sha='e'.repeat(40);
test('Pages embeds the exact commit of the deployed checkout',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-commit-'));
 try{
  execFileSync(process.execPath,['scripts/build-pages.js',dir],{env:{...process.env,GITHUB_SHA:sha}});
  const js=readFileSync(join(dir,'build-info.js'),'utf8');
  const ctx=vm.createContext({window:{}});vm.runInContext(js,ctx);
  assert.equal(ctx.window.ONIRAMA_BUILD_COMMIT,sha);
  assert.match(readFileSync(join(dir,'index.html'),'utf8'),/src="\.\/build-info\.js"/);
  assert.ok(readFileSync(join(dir,'runtime-config.js'),'utf8').includes('onirama-5124e'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Invalid checkout identifiers never appear as fake commits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-commit-'));
 try{
  execFileSync(process.execPath,['scripts/build-pages.js',dir],{env:{...process.env,GITHUB_SHA:'invalid-value'}});
  const ctx=vm.createContext({window:{}});vm.runInContext(readFileSync(join(dir,'build-info.js'),'utf8'),ctx);
  assert.equal(ctx.window.ONIRAMA_BUILD_COMMIT,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Settings shows the exact commit and an official GitHub link; local fallback is labeled',()=>{
 const source=readFileSync('public/app.js','utf8').replace(/^import [^\n]+$/gm,'');
 const ui=commit=>{
  const app={innerHTML:'',addEventListener(){}},storage=new Map();
  const ctx=vm.createContext({window:{ONIRAMA_BUILD_COMMIT:commit},document:{documentElement:{dataset:{}},querySelector:id=>id==='#app'?app:null},localStorage:{getItem:key=>storage.get(key)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{origin:'https://sea4594.github.io',hostname:'sea4594.github.io',hash:'#/settings'},addEventListener(){},navigator:{},console,renderCard,renderDoors,applyTabletopMetrics,...guest,firebase:{firebaseConfigured:()=>false}});
  vm.runInContext(source,ctx);return app.innerHTML;
 };
 const deployed=ui(sha);assert.match(deployed,/Current commit:/);assert.ok(deployed.includes(sha));assert.ok(deployed.includes(`https://github.com/sea4594/Onirama/commit/${sha}`));
 const local=ui(null);assert.match(local,/Unavailable \(local development\)/);assert.ok(!local.includes('github.com/sea4594/Onirama/commit/'));
});
