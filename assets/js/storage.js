import { createSeed } from './data.js';
import { requirePermission } from './auth.js';
const KEY='smart-campus:state:v1';
const text=(v,max=200)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.isWellFormed();
const number=v=>typeof v==='number'&&Number.isFinite(v);
const date=v=>text(v,40)&&Number.isFinite(Date.parse(v));
function validBaseState(s) {
  if (!s||![1,2].includes(s.version)||!Array.isArray(s.rooms)||s.rooms.length<12||s.rooms.length>500||!Array.isArray(s.devices)||s.devices.length<20||s.devices.length>5000) return false;
  if (!s.rooms.every(r=>r&&text(r.id,40)&&text(r.name)&&text(r.type)&&['A','B','C','D'].includes(r.building)&&Number.isInteger(r.floor)&&r.floor>=0&&[r.temperature,r.co2,r.energy,r.baseline,r.occupancy].every(number)&&r.co2>=0&&r.energy>=0&&r.baseline>0&&r.occupancy>=0&&date(r.updatedAt)&&Array.isArray(r.history)&&r.history.length>=(s.version===1?2:1)&&r.history.length<=200&&r.history.every(h=>h&&date(h.at)&&number(h.value)))) return false;
  const rooms=new Set(s.rooms.map(r=>r.id));
  if (rooms.size!==s.rooms.length) return false;
  if (!s.devices.every(d=>d&&text(d.id,80)&&rooms.has(d.room)&&text(d.type)&&['online','offline'].includes(d.status)&&date(d.updatedAt)&&typeof d.unit==='string'&&d.unit.length<=30&&(d.metric===null?text(d.value):['temperature','co2','energy'].includes(d.metric)&&number(d.value)&&d.value===s.rooms.find(r=>r.id===d.room)[d.metric]))) return false;
  if (new Set(s.devices.map(d=>d.id)).size!==s.devices.length) return false;
  if (!Array.isArray(s.incidents)||s.incidents.length>5000||!s.incidents.every(i=>i&&Number.isSafeInteger(i.id)&&i.id>0&&rooms.has(i.room)&&text(i.title)&&text(i.assignee)&&typeof i.comment==='string'&&i.comment.isWellFormed()&&i.comment.length<=2000&&['high','medium','low'].includes(i.priority)&&['open','in_progress','resolved'].includes(i.status)&&date(i.createdAt)&&(!i.updatedAt||date(i.updatedAt)))) return false;
  if(new Set(s.incidents.map(i=>i.id)).size!==s.incidents.length)return false;
  if (!s.settings||!text(s.settings.campusName,80)||!s.settings.campusName.trim()) return false;
  if (!s.readNotifications||typeof s.readNotifications!=='object'||Array.isArray(s.readNotifications)||Object.entries(s.readNotifications).some(([email,ids])=>!text(email,100)||!Array.isArray(ids)||ids.length>5000||ids.some(id=>!text(id,120)))) return false;
  return true;
}
export function validState(s) {
  if(!validBaseState(s)||s.version!==2||!Number.isSafeInteger(s.incidentNextId)||s.incidentNextId<=Math.max(0,...s.incidents.map(i=>i.id)))return false;
  if(!s.devices.filter(d=>d.metric==='temperature').every(d=>{
    const history=s.rooms.find(r=>r.id===d.room).history;
    return Array.isArray(d.history)&&history.length===d.history.length&&history.every((h,i)=>h.at===d.history[i]?.at&&h.value===d.history[i]?.value);
  }))return false;
  return s.devices.filter(d=>d.metric).every(d=>Array.isArray(d.history)&&d.history.length>0&&d.history.length<=60&&d.history.every((h,i)=>h&&date(h.at)&&number(h.value)&&(i===0||Date.parse(h.at)>Date.parse(d.history[i-1].at)))&&d.history.at(-1).value===d.value&&d.history.at(-1).at===d.updatedAt);
}
export function upgradeState(s) {
  if(!validBaseState(s))return null;
  if(s.version===2)return validState(s)?s:null;
  const next=structuredClone(s);next.version=2;
  next.incidentNextId=Math.max(0,...next.incidents.map(i=>i.id))+1;
  for(const d of next.devices.filter(d=>d.metric)) {
    const room=next.rooms.find(r=>r.id===d.room);
    d.history=d.metric==='temperature'?room.history.filter(h=>Date.parse(h.at)<Date.parse(d.updatedAt)).slice(-59):[];
    d.history.push({at:d.updatedAt,value:d.value});
    if(d.metric==='temperature')room.history=structuredClone(d.history);
  }
  return validState(next)?next:null;
}
export function createStore(storage) {
  const store={state:createSeed(),warning:'',save,reset};
  try {
    const raw=storage.getItem(KEY);
    if (raw===null) save();
    if (raw!==null) {
      let parsed;try {parsed=JSON.parse(raw)} catch { /* Ошибка разбора будет обработана ниже как некорректное состояние. */ }
      const upgraded=upgradeState(parsed);
      if (upgraded) store.state=upgraded;
      else store.warning='Сохраненные данные повреждены или устарели. Загружен исходный учебный набор; исходная запись не перезаписана автоматически.';
    }
  } catch { store.warning='Хранилище браузера недоступно. Изменения работают только в этой вкладке до перезагрузки.'; }
  function save() {
    try {storage.setItem(KEY,JSON.stringify(store.state));store.warning='';return true;}
    catch {store.warning='Не удалось сохранить данные в браузере. Изменения остаются в памяти до перезагрузки.';return false;}
  }
  function reset(role) {
    requirePermission(role,'data:reset');store.state=createSeed();store.warning='';save();
  }
  return store;
}
