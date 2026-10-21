import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/data.js';
import { createIncident, editIncident, deleteIncident, selectIncidents } from '../assets/js/incidents.js';
import { createStore, validState, upgradeState } from '../assets/js/storage.js';
const fields={title:'Не работает вентиляция',room:'A-101',priority:'high',status:'open',assignee:'Инженер',comment:'Проверить питание'};
test('CRUD adds, edits without duplication, deletes the selected ID and never reuses IDs',()=>{
 const s=createSeed(),a=createIncident(s,'Administrator',fields);
 assert.equal(a.id,5);assert.equal(s.incidents.length,5);
 editIncident(s,'Engineer',a.id,{...fields,status:'in_progress',assignee:'Дежурный'});
 assert.equal(s.incidents.length,5);assert.equal(s.incidents.at(-1).assignee,'Дежурный');
 deleteIncident(s,'Administrator',a.id);assert.equal(s.incidents.length,4);
 assert.equal(createIncident(s,'Engineer',fields).id,6);assert.equal(s.incidents[0].id,1);
 assert.ok(validState(s));
});
test('incident role checks run before mutation even when called directly',()=>{
 const s=createSeed(),before=JSON.stringify(s);
 for(const role of ['Operator','unknown'])for(const fn of [()=>createIncident(s,role,fields),()=>editIncident(s,role,1,fields),()=>deleteIncident(s,role,1)])assert.throws(fn,/прав/);
 assert.throws(()=>deleteIncident(s,'Engineer',1),/прав/);assert.equal(JSON.stringify(s),before);
});
test('invalid incident fields and IDs fail atomically',()=>{
 for(const patch of [{title:' '},{title:'x'.repeat(201)},{room:'Z-999'},{priority:'urgent'},{status:'anything'},{assignee:''},{comment:'x'.repeat(2001)},{title:'\ud800'},{assignee:[]},{comment:null}]){
  const s=createSeed(),before=JSON.stringify(s);
  assert.throws(()=>createIncident(s,'Administrator',{...fields,...patch}));
  assert.throws(()=>editIncident(s,'Administrator',1,{...fields,...patch}));
  assert.equal(JSON.stringify(s),before);
 }
 const s=createSeed();assert.throws(()=>editIncident(s,'Engineer',999,fields),/найден/);
 assert.throws(()=>deleteIncident(s,'Administrator',NaN),/найден/);
});
test('HTML input remains data; filters and empty results reflect edited incident fields',()=>{
 const s=createSeed(),i=createIncident(s,'Engineer',{...fields,title:'<img src=x onerror=alert(1)>'});
 assert.equal(i.title,'<img src=x onerror=alert(1)>');
 assert.equal(selectIncidents(s,{q:'img',room:'A-101',status:'open',priority:'high'}).length,1);
 assert.equal(selectIncidents(s,{q:'not-found'}).length,0);
});
test('incident changes, sequence and deletion persist through store reload',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const a=createStore(storage);createIncident(a.state,'Engineer',fields);deleteIncident(a.state,'Administrator',5);a.save();
 const b=createStore(storage);assert.equal(b.state.incidents.length,4);assert.equal(createIncident(b.state,'Administrator',fields).id,6);
});
test('v1 migration preserves user data, readings and per-account read marks without fabricating histories',()=>{
 const old=createSeed();old.version=1;delete old.incidentNextId;
 for(const d of old.devices)delete d.history;
 old.settings.campusName='Пользовательский кампус';old.readNotifications['operator@campus.demo']=['co2:A-205'];
 old.incidents[0].comment='Из первого этапа';const before=JSON.stringify(old);
 const upgraded=upgradeState(old);
 assert.equal(JSON.stringify(old),before);assert.equal(upgraded.version,2);assert.equal(upgraded.incidentNextId,5);
 assert.equal(upgraded.settings.campusName,old.settings.campusName);assert.deepEqual(upgraded.readNotifications,old.readNotifications);
 assert.equal(upgraded.incidents[0].comment,'Из первого этапа');
 const co2=upgraded.devices.find(d=>d.metric==='co2');assert.equal(co2.history.length,1);assert.equal(co2.history[0].value,co2.value);
 assert.ok(validState(upgraded));
 const saved=JSON.stringify(old),storage={getItem:()=>saved,setItem(){throw Error('read only')}};
 const store=createStore(storage);assert.equal(store.state.version,2);assert.equal(store.state.settings.campusName,old.settings.campusName);
});
test('validator rejects duplicate incidents and sequence values that would collide',()=>{
 const s=createSeed();s.incidents.push({...s.incidents[0]});assert.equal(validState(s),false);
 const t=createSeed();t.incidentNextId=1;assert.equal(validState(t),false);
});
test('v2 storage rejects temperature chart history inconsistent with its sensor',()=>{
 const s=createSeed();s.rooms[0].history.at(-1).value=999;assert.equal(validState(s),false);
});
test('legacy offline temperatures predating the available room history migrate without losing user data',()=>{
 const s=createSeed();s.version=1;delete s.incidentNextId;s.settings.campusName='Не потерять';
 for(const d of s.devices)delete d.history;
 const d=s.devices[0];d.status='offline';d.updatedAt=new Date(Date.parse(s.rooms[0].history[0].at)-1000).toISOString();
 const migrated=upgradeState(s);assert.ok(migrated);assert.equal(migrated.settings.campusName,'Не потерять');
 assert.deepEqual(migrated.devices[0].history,[{at:d.updatedAt,value:d.value}]);assert.ok(validState(migrated));
});
