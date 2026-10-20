import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOrderedMotionQueue,createTabletopAnimator} from '../public/tabletop/animation.js';
import {viewportRefitPlan} from '../public/tabletop/viewport-refit.js';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=src('public/app.js');
const frame=(width,height,visualWidth=width,visualHeight=height)=>({width,height,visualWidth,visualHeight});

// This is presentation geometry, NOT browser zoom. An unchanged viewport
// scroll must not repeatedly size the tabletop or interrupt an active flight.
test('Safari visualViewport scroll changes no board dimensions and schedules no refit',()=>{
 const before=frame(844,390);
 assert.deepEqual(viewportRefitPlan(before,frame(844,390),{type:'scroll'}),{fit:false,cancelMotion:false,settle:false});
 assert.deepEqual(viewportRefitPlan(before,frame(844,390),{type:'resize'}),{fit:false,cancelMotion:false,settle:false});
 assert.deepEqual(viewportRefitPlan(before,frame(844,390,830,390),{type:'scroll'}),{fit:true,cancelMotion:false,settle:false});
});

test('rotation and significant layout changes invalidate both live and replay flight coordinates',()=>{
 const rotate=viewportRefitPlan(frame(390,844),frame(844,390),{type:'orientationchange'});
 assert.deepEqual(rotate,{fit:true,cancelMotion:true,settle:true});
 const tablet=viewportRefitPlan(frame(768,1024),frame(1024,768),{type:'resize'});
 assert.deepEqual(tablet,{fit:true,cancelMotion:true,settle:true});
 const toolbar=viewportRefitPlan(frame(844,390),frame(844,360),{type:'resize'});
 assert.deepEqual(toolbar,{fit:true,cancelMotion:false,settle:false});
 const force=viewportRefitPlan(frame(390,844),frame(390,844),{type:'pageshow'});
 assert.deepEqual(force,{fit:true,cancelMotion:true,settle:true});
 assert.match(app,/tabletopAnimator\?\.viewportChanged\?\.\(\);\s*replayAnimator\?\.viewportChanged\?\.\(\)/);
});

test('refit coalescing preserves iOS multi-stage rotation settlement but avoids expensive scroll loops',()=>{
 assert.match(app,/if\(!plan\.fit\)return;/);
 assert.match(app,/const passes=plan\.settle\?\[80,200,400,750,1200\]:\[120\]/);
 assert.match(app,/window\.visualViewport\?\.addEventListener\?\.\('scroll',fitAfterViewportSettles\)/);
 assert.doesNotMatch(app,/maximum-scale=/);
});

test('animation cleanup is applied to replay and live game when tab is backgrounded',()=>{
 assert.match(app,/document\.hidden\)\{[^}]*tabletopAnimator\?\.viewportChanged\?\.\(\);\s*replayAnimator\?\.viewportChanged\?\.\(\)/);
 assert.match(app,/addEventListener\?\.\('pagehide',/);
 const animator=createTabletopAnimator({root:{}});
 assert.doesNotThrow(()=>animator.viewportChanged());
});

test('a canceled queued job cannot schedule a stale completion after it cancels itself',()=>{
 let clock=0;const callbacks=new Map();const log=[];
 const schedule=(callback,ms)=>{const id=++clock;callbacks.set(id,callback);return id;};
 const cancel=id=>callbacks.delete(id);
 const queue=createOrderedMotionQueue({schedule,cancel,onFinish:()=>log.push('finish')});
 queue.enqueue(()=>{log.push('A');queue.clear();queue.enqueue(()=>log.push('B'),10);},100);
 assert.deepEqual(log,['A','finish','B']);
 assert.equal(callbacks.size,1);
 [...callbacks.values()][0]();
 assert.deepEqual(log,['A','finish','B','finish']);
 assert.equal(callbacks.size,1); // fake callback did not delete itself
 assert.equal(queue.length,0);
});

test('reconnect reset cancels callbacks already dispatched by the scheduler',()=>{
 const callbacks=[];let fired=0;
 const queue=createOrderedMotionQueue({schedule:cb=>{callbacks.push(cb);return callbacks.length;},cancel:()=>{},onFinish:()=>{}});
 queue.enqueue(()=>fired++,100);
 queue.clear();
 callbacks[0]();
 assert.equal(fired,1);
 assert.equal(queue.length,0);
 queue.enqueue(()=>fired++,100);
 assert.equal(fired,2);
 callbacks[1]();
 assert.equal(queue.length,0);
});
