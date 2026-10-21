import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/data.js';
import { statistics, analyzeDevices, recommendations, STALE_MS, Z_THRESHOLD } from '../assets/js/analysis.js';
import { notifications } from '../assets/js/model.js';
const history=[22,23,22.5,23,22.8,23.1];
test('z-score matches method population deviation and separates normal from anomalous values',()=>{
 const normal=statistics(history,22.8),bad=statistics(history,31);
 assert.ok(Math.abs(normal.mean-22.7333333333)<1e-8);
 const sd=Math.sqrt(history.reduce((n,x)=>n+(x-normal.mean)**2,0)/history.length);
 assert.ok(Math.abs(bad.sd-sd)<1e-12);assert.equal(bad.z,Math.abs((31-normal.mean)/sd));
 assert.equal(normal.anomaly,false);assert.equal(bad.anomaly,true);assert.equal(Z_THRESHOLD,2);
});
test('small, missing, constant and invalid histories produce explicit statuses, no NaN or Infinity',()=>{
 assert.equal(statistics([1,2,3,4],8).status,'insufficient');
 assert.equal(statistics([1,1,1,1,1],8).z,0);
 assert.equal(statistics([1,1,1,1,1],8).status,'constant');
 assert.equal(statistics(null,8).status,'insufficient');
 for(const value of [NaN,Infinity,-Infinity,null,undefined,'31'])assert.equal(statistics(history,value).status,'invalid');
 const filtered=statistics([1,2,NaN,3,4,5,Infinity,null],3);
 assert.equal(filtered.n,5);assert.equal(filtered.status,'normal');
});
function anomalySeed() {
 const s=createSeed(),d=s.devices[0],now=Date.now();
 d.value=31;d.updatedAt=new Date(now).toISOString();s.rooms[0].temperature=31;
 d.history=[...history,31].map((value,i)=>({at:new Date(now-(6-i)*5000).toISOString(),value}));
 s.rooms[0].history=structuredClone(d.history);return {s,d,now};
}
test('device analysis excludes current sample, explains calculation and skips offline/stale/future data',()=>{
 const {s,d,now}=anomalySeed();const a=analyzeDevices(s,now).find(x=>x.device===d.id);
 assert.equal(a.n,6);assert.equal(a.current,31);assert.equal(a.anomaly,true);assert.equal(a.at,d.updatedAt);
 d.status='offline';assert.equal(analyzeDevices(s,now).find(x=>x.device===d.id).status,'offline');
 d.status='online';assert.equal(analyzeDevices(s,now+STALE_MS+1).find(x=>x.device===d.id).status,'stale');
 assert.equal(analyzeDevices(s,now-1).find(x=>x.device===d.id).status,'future');
 d.history=[{at:d.updatedAt,value:d.value}];assert.equal(analyzeDevices(s,now).find(x=>x.device===d.id).status,'insufficient');
});
test('current may be statistically anomalous without breaking physical thresholds',()=>{
 const {s,d,now}=anomalySeed();d.value=24.5;s.rooms[0].temperature=24.5;d.history.at(-1).value=24.5;
 const a=analyzeDevices(s,now).find(x=>x.device===d.id);assert.equal(a.anomaly,true);
 const n=notifications(s,now);assert.ok(n.some(x=>x.id===`zscore:${d.id}`));
 assert.ok(!n.some(x=>x.id==='temperature:A-101'));
});
test('recommendations provide numeric evidence, priority, action and linked target',()=>{
 const {s,now}=anomalySeed(),list=recommendations(s,now);
 for(const r of list){assert.ok(r.reason);assert.ok(r.action);assert.ok(r.priority);assert.ok(r.href.startsWith('#'));assert.ok(s.rooms.some(x=>x.id===r.room));}
 assert.ok(list.some(x=>x.kind==='zscore'&&x.reason.includes('z=')));
 assert.ok(list.some(x=>x.kind==='co2'&&x.reason.includes('1538')));
 assert.ok(list.some(x=>x.kind==='offline'&&x.action.includes('питание')));
 assert.ok(list.some(x=>x.kind==='unoccupied'&&x.room==='D-101'));
});
test('notifications are bounded, deduplicated, linked, stable and disappear when their cause resolves',()=>{
 const {s,d,now}=anomalySeed();const a=notifications(s,now),b=notifications(s,now);
 assert.deepEqual(a,b);assert.equal(new Set(a.map(n=>n.id)).size,a.length);
 const n=a.find(x=>x.id===`zscore:${d.id}`);assert.ok(n.href.includes('devices/'));assert.equal(n.priority,'high');
 s.readNotifications['operator@campus.demo']=[n.id];
 d.history=[...history,22.8].map((value,i)=>({at:new Date(now-(6-i)*5000).toISOString(),value}));d.value=22.8;s.rooms[0].temperature=22.8;
 assert.ok(!notifications(s,now).some(x=>x.id===n.id));assert.deepEqual(s.readNotifications['operator@campus.demo'],[n.id]);
});
test('offline threshold warnings carry their actual saved timestamp and stale label',()=>{
 const s=createSeed(),d=s.devices.find(x=>x.id==='CO2-A-205-01');d.status='offline';
 d.updatedAt=new Date(Date.now()-3600000).toISOString();d.history.at(-1).at=d.updatedAt;
 const n=notifications(s).find(x=>x.id==='co2:A-205');assert.equal(n.at,d.updatedAt);assert.equal(n.stale,true);
 assert.ok(!analyzeDevices(s).some(x=>x.device===d.id&&x.anomaly));
});
