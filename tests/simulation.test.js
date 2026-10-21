import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/data.js';
import { validState } from '../assets/js/storage.js';
import { advanceReadings, createSimulation, HISTORY_LIMIT, INTERVAL_MS } from '../assets/js/simulation.js';
const nextTime=s=>Math.max(...s.devices.map(d=>Date.parse(d.updatedAt)))+5000;
test('manual step changes online readings, timestamps and linked room histories coherently',()=>{
 const s=createSeed(),at=nextTime(s),offline=structuredClone(s.devices.find(d=>d.status==='offline'));
 const changed=advanceReadings(s,'Engineer',{now:at,rng:()=>0.8});assert.equal(changed,35);
 for(const d of s.devices.filter(d=>d.metric&&d.status==='online')){
  assert.equal(d.updatedAt,new Date(at).toISOString());assert.equal(d.history.at(-1).value,d.value);
  assert.equal(s.rooms.find(r=>r.id===d.room)[d.metric],d.value);
  if(d.metric==='temperature')assert.deepEqual(s.rooms.find(r=>r.id===d.room).history,d.history);
 }
 assert.deepEqual(s.devices.find(d=>d.id===offline.id),offline);assert.ok(validState(s));
});
test('history remains bounded across many steps and generated values stay in teaching ranges',()=>{
 const s=createSeed();let now=nextTime(s);
 for(let i=0;i<100;i++,now+=5000)advanceReadings(s,'Administrator',{now,rng:()=>0.99});
 const ranges={temperature:[20,34],co2:[500,1700],energy:[1.5,7.5]};
 for(const d of s.devices.filter(d=>d.metric&&d.status==='online')){
  assert.equal(d.history.length,HISTORY_LIMIT);assert.ok(d.value>=ranges[d.metric][0]&&d.value<=ranges[d.metric][1]);
 }
 assert.ok(validState(s));
});
test('invalid roles, clocks and RNG values do not partially mutate state',()=>{
 const s=createSeed(),before=JSON.stringify(s),now=nextTime(s);
 assert.throws(()=>advanceReadings(s,'Operator',{now}),/прав/);
 assert.throws(()=>advanceReadings(s,'Engineer',{now:NaN}));
 assert.throws(()=>advanceReadings(s,'Engineer',{now,rng:()=>Infinity}));
 assert.equal(JSON.stringify(s),before);
 assert.equal(advanceReadings(s,'Engineer',{now:0}),0);
 assert.equal(JSON.stringify(s),before);
});
test('controller starts once, pauses, steps, and is independent of navigation/render callbacks',()=>{
 const s=createSeed(),timers=new Map();let seq=0,commits=0,renders=0,now=nextTime(s),role='Engineer';
 const sim=createSimulation({getState:()=>s,getRole:()=>role,persist:()=>commits++,onChange:()=>renders++,now:()=>now,rng:()=>0.75,setIntervalFn:(f,ms)=>{assert.equal(ms,INTERVAL_MS);timers.set(++seq,f);return seq;},clearIntervalFn:id=>timers.delete(id)});
 assert.equal(sim.running,false);sim.start();sim.start();assert.equal(timers.size,1);
 timers.values().next().value();assert.equal(commits,1);assert.ok(renders>=1);
 sim.pause();sim.pause();assert.equal(timers.size,0);
 now+=5000;sim.step();assert.equal(commits,2);assert.equal(timers.size,0);
 sim.start();role='Operator';timers.values().next().value();assert.equal(timers.size,0);assert.equal(commits,2);
 for(const action of [()=>sim.start(),()=>sim.step(),()=>sim.pause()])assert.throws(action,/прав/);
 role='Administrator';sim.start();sim.stop();assert.equal(timers.size,0);assert.equal(sim.running,false);
});
