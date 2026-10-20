import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,joinRoom,updateSetup,setReady,startRoom,hostSeat} from '../engine/firebase-protocol.js';
import {explainRoomPermissionError} from '../public/firebase-permissions.js';

const diffKeys=(before,after)=>Object.keys(after).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));

test('All tested expansion selections and start writes match the locked-down Firestore changed-field policies',()=>{
  const combinations=[[],['glyphs'],['book','crossroads','mirrors'],['towers','dreamcatchers','premonitions','oniverse','sphinx'],['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']];
  for(const expansions of combinations){
    let room=makeRoom('ABCD','host','Host',{expansions:[]},1000);
    room=joinRoom(room,'guest','Guest',2000);
    const configured=updateSetup(room,'host',{expansions},3000);
    assert.deepEqual(configured.ready,[false,false]);
    assert.ok(diffKeys(room,configured).every(key=>['config','ready','updatedAt','version'].includes(key)),JSON.stringify(expansions));
    room=setReady(configured,'guest',true,4000);
    const started=startRoom(room,'host',5000);
    assert.equal(started.game.mode,'coop');
    assert.ok(Array.isArray(started.replay));
    assert.ok(diffKeys(room,started).every(key=>['game','replay','updatedAt','version'].includes(key)),JSON.stringify(expansions));
  }
});

test('Host transfer and older rooms with missing hostSeat follow the same default for start checks',()=>{
  const rules=readFileSync('firestore.rules','utf8');
  assert.match(rules,/function hostSeat\(\) \{ return resource\.data\.get\('hostSeat', 0\); \}/);
  assert.match(rules,/resource\.data\.ready\[1-hostSeat\(\)\] == true/);
  assert.doesNotMatch(rules,/resource\.data\.ready\[1-resource\.data\.hostSeat\]/);
  const room=makeRoom('ABCD','host','Host',{expansions:[]});
  assert.equal(hostSeat({...room,hostSeat:undefined}),0);
});

test('Firebase project has an explicit rules deployment configuration (not just GitHub Pages)',()=>{
  assert.deepEqual(JSON.parse(readFileSync('firebase.json','utf8')),{firestore:{rules:'firestore.rules'}});
  const workflow=readFileSync('.github/workflows/pages.yml','utf8');
  assert.ok(workflow.includes('build:pages'));
  assert.ok(!workflow.includes('firebase deploy')); // the installer must deploy to the authenticated Firebase account
});

test('Denials give actionable rules/deployment diagnostics without hiding other failures',()=>{
  const denied=Object.assign(new Error('Missing or insufficient permissions'),{code:'permission-denied'});
  for(const [op,phrase] of [['setup','changing expansions'],['start','starting the game'],['ready','changing readiness']]){
    const failure=explainRoomPermissionError(denied,op);
    assert.match(failure.message,new RegExp(phrase));
    assert.match(failure.message,/firestore\.rules/);
    assert.match(failure.message,/onirama-5124e/);
    assert.equal(failure.code,'permission-denied');
    assert.equal(failure.cause,denied);
  }
  const network=Object.assign(new Error('Offline'),{code:'unavailable'});
  assert.equal(explainRoomPermissionError(network,'start'),network);
});
