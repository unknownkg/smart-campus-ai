import { requirePermission } from './auth.js';
import { activeEvents } from './analysis.js';

export function roomStatus(r) {
  if (r.temperature>=32||r.co2>=1500||r.energy>=r.baseline*1.6-1e-9) return 'critical';
  if (r.temperature>27||r.temperature<18||r.co2>=1000||r.energy>=r.baseline*1.3-1e-9) return 'warning';
  return 'normal';
}
const matches=(values,q='')=>values.join(' ').toLocaleLowerCase('ru').includes(q.trim().toLocaleLowerCase('ru'));
export function selectRooms(s,{q='',building='',status=''}={}) {
  return s.rooms.filter(r=>(!building||r.building===building)&&(!status||roomStatus(r)===status)&&matches([r.id,r.name,r.type,`Корпус ${r.building}`],q));
}
export function selectDevices(s,{q='',building='',status='',room=''}={}) {
  return s.devices.filter(d=>(!building||s.rooms.find(r=>r.id===d.room)?.building===building)&&(!status||d.status===status)&&(!room||d.room===room)&&matches([d.id,d.room,d.type],q));
}
export function summary(s) {
  const online=s.devices.filter(d=>d.status==='online').length;
  return {rooms:s.rooms.length,online,offline:s.devices.length-online,
    energy:Number(s.rooms.reduce((n,r)=>n+r.energy,0).toFixed(1)),
    incidents:s.incidents.filter(i=>i.status!=='resolved').length,
    critical:s.rooms.filter(r=>roomStatus(r)==='critical').length,
    alerts:notifications(s).length};
}
export function notifications(s,now=Date.now()) { return activeEvents(s,now); }
export function setDeviceStatus(s,role,id) {
  requirePermission(role,'device:maintain');
  const d=s.devices.find(d=>d.id===id);
  if (!d) throw new Error('Устройство не найдено.');
  d.status=d.status==='online'?'offline':'online';
  // Обслуживание меняет только состояние связи; новое измерение при этом не создаётся.
  return d;
}
export function updateSettings(s,role,{campusName}) {
  requirePermission(role,'settings:write');
  if (typeof campusName!=='string'||!campusName.trim()||campusName.trim().length>80) throw new Error('Укажите название от 1 до 80 символов.');
  s.settings.campusName=campusName.trim();
}
