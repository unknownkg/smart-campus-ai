import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/data.js';
import { roomStatus, selectRooms, selectDevices, summary, notifications, setDeviceStatus, updateSettings } from '../assets/js/model.js';
import { createStore, validState } from '../assets/js/storage.js';
import { authenticate, can, validSession } from '../assets/js/auth.js';

test('seed has 12 rooms, 40 unique linked devices and matching sensor readings', () => {
  const s = createSeed();
  assert.equal(s.rooms.length, 12); assert.equal(s.devices.length, 40);
  assert.equal(new Set(s.devices.map(d => d.id)).size, 40);
  for (const d of s.devices) {
    const r = s.rooms.find(r => r.id === d.room); assert.ok(r);
    if (d.metric) assert.equal(d.value, r[d.metric]);
    assert.ok(Number.isFinite(Date.parse(d.updatedAt)));
  }
  for (const i of s.incidents) assert.ok(s.rooms.some(r => r.id === i.room));
  assert.equal(validState(s), true);
});
test('threshold boundaries follow the method and energy baseline', () => {
  const r = { temperature: 27, co2: 999, energy: 3, baseline: 3 };
  assert.equal(roomStatus(r), 'normal');
  for (const temperature of [27.1, 28, 31.9]) assert.equal(roomStatus({...r,temperature}), 'warning');
  assert.equal(roomStatus({...r,temperature:32}), 'critical');
  assert.equal(roomStatus({...r,co2:1000}), 'warning');
  assert.equal(roomStatus({...r,co2:1500}), 'critical');
  assert.equal(roomStatus({...r,energy:3.9}), 'warning');
  assert.equal(roomStatus({...r,energy:4.8}), 'critical');
  assert.equal(roomStatus({...r,temperature:17}), 'warning');
});
test('room/device search combines text, building, status and related room', () => {
  const s = createSeed();
  assert.equal(selectRooms(s, {q:' a-205 '})[0].id,'A-205');
  assert.equal(selectRooms(s, {building:'B'}).length,3);
  assert.equal(selectRooms(s, {q:'несуществующий'}).length,0);
  const c = selectRooms(s, {building:'A',status:'critical'});
  assert.ok(c.length); assert.ok(c.every(r=>r.building==='A'&&roomStatus(r)==='critical'));
  assert.ok(selectDevices(s, {room:'A-205'}).every(d=>d.room==='A-205'));
  assert.equal(selectDevices(s, {status:'offline'}).length,1);
  assert.ok(selectDevices(s, {q:'temperature',building:'B'}).every(d=>d.type==='Temperature Sensor'&&d.room.startsWith('B-')));
});
test('summary and warnings agree with device availability and measured totals', () => {
  const s=createSeed(), k=summary(s);
  assert.equal(k.rooms,12); assert.equal(k.online,39); assert.equal(k.offline,1);
  assert.equal(k.energy, Number(s.rooms.reduce((n,r)=>n+r.energy,0).toFixed(1)));
  assert.ok(notifications(s).some(n=>n.kind==='offline'));
  assert.ok(notifications(s).some(n=>n.room==='A-205'&&n.kind==='co2'));
  assert.ok(notifications(s).some(n=>n.kind==='energy'));
});
test('each warning severity reflects its own metric rather than another metric in the room',()=>{
  const s=createSeed(),r=s.rooms.find(r=>r.id==='D-101');
  assert.equal(roomStatus(r),'critical');
  assert.equal(notifications(s).find(n=>n.id==='co2:D-101').level,'warning');
  assert.equal(notifications(s).find(n=>n.id==='energy:D-101').level,'critical');
});
test('demo credentials validate role, email and password without accepting arbitrary roles', () => {
  assert.equal(authenticate('admin@campus.demo','campus-demo','Administrator').role,'Administrator');
  assert.equal(authenticate('engineer@campus.demo','campus-demo','Engineer').role,'Engineer');
  assert.equal(authenticate('operator@campus.demo','campus-demo','Operator').role,'Operator');
  assert.equal(authenticate('admin@campus.demo','wrong','Administrator'),null);
  assert.equal(authenticate('admin@campus.demo','campus-demo','Operator'),null);
  assert.equal(authenticate('x','x','owner'),null);
  assert.equal(validSession({role:'owner',email:'x'}),false);
  assert.equal(validSession({role:'Administrator',email:'operator@campus.demo'}),false);
});
test('permissions apply inside actions, maintenance state leaves last readings intact', () => {
  const s=createSeed(), d=s.devices[0];
  assert.equal(can('Operator','device:maintain'),false);
  assert.equal(can('Engineer','settings:write'),false);
  assert.equal(can('owner','settings:write'),false);
  assert.throws(()=>setDeviceStatus(s,'Operator',d.id),/прав/);
  setDeviceStatus(s,'Engineer',d.id); assert.equal(d.status,'offline');
  assert.equal(d.value,s.rooms[0].temperature);
  assert.ok(notifications(s).some(n=>n.id===`offline:${d.id}`));
  setDeviceStatus(s,'Administrator',d.id);assert.equal(d.status,'online');
  assert.throws(()=>setDeviceStatus(s,'Engineer','unknown'),/найдено/);
  assert.throws(()=>updateSettings(s,'Engineer',{campusName:'Other'}),/прав/);
  updateSettings(s,'Administrator',{campusName:'Учебный кампус'});
  assert.equal(s.settings.campusName,'Учебный кампус');
  assert.throws(()=>updateSettings(s,'Administrator',{campusName:'   '}),/название/);
});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('first initialization persists the exact seed and a successful explicit save clears recovery warnings',()=>{
  const m=memory(),a=createStore(m);
  assert.deepEqual(JSON.parse(m.getItem('smart-campus:state:v1')),a.state);
  m.setItem('smart-campus:state:v1','{broken');
  const b=createStore(m);assert.ok(b.warning);b.save();assert.equal(b.warning,'');
});
test('store persists, reloads and resets only its own state with administrator rights', () => {
  const m=memory(); m.setItem('other-project','preserve');
  const a=createStore(m);a.state.settings.campusName='Новый кампус';assert.equal(a.save(),true);
  const b=createStore(m);assert.equal(b.state.settings.campusName,'Новый кампус');
  assert.throws(()=>b.reset('Operator'),/прав/);
  b.reset('Administrator');assert.equal(b.state.settings.campusName,'Smart Campus');
  assert.equal(m.getItem('other-project'),'preserve');
});
test('corrupt, old and invalid storage recover with a visible diagnostic', () => {
  for (const raw of ['{broken','null',JSON.stringify({version:0}),JSON.stringify({...createSeed(),devices:[{id:'x',room:'missing'}]})]) {
    const m=memory();m.setItem('smart-campus:state:v1',raw);
    const store=createStore(m);assert.equal(store.state.rooms.length,12);assert.ok(store.warning);
  }
  const s=createSeed(); s.rooms[0].temperature='not a number';assert.equal(validState(s),false);
  const d=createSeed();d.rooms[1].id=d.rooms[0].id;assert.equal(validState(d),false);
});
test('malformed Unicode identifiers are rejected before URL generation',()=>{
  const s=createSeed(),original=s.rooms[0].id;s.rooms[0].id='A-\ud800';
  for(const d of s.devices.filter(d=>d.room===original))d.room=s.rooms[0].id;
  assert.equal(validState(s),false);
});
test('storage permission and quota failures retain usable in-memory data with a warning', () => {
  const store=createStore({getItem(){throw Error('denied')},setItem(){throw Error('quota')}});
  store.state.settings.campusName='В памяти';assert.equal(store.save(),false);
  assert.equal(store.state.settings.campusName,'В памяти');assert.ok(store.warning);
});
