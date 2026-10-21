import { requirePermission } from './auth.js';
const priorities=['high','medium','low'],statuses=['open','in_progress','resolved'];
function validate(s,fields) {
  const text=(value,max,required=true)=>typeof value==='string'&&value.isWellFormed()&&value.length<=max&&(!required||Boolean(value.trim()));
  if(!fields||!text(fields.title,200)||!text(fields.assignee,200)||!text(fields.comment,2000,false))throw Error('Заполните описание и ответственного. Описание/ответственный — до 200, комментарий — до 2000 символов.');
  if(!s.rooms.some(r=>r.id===fields.room))throw Error('Выберите существующее помещение.');
  if(!priorities.includes(fields.priority)||!statuses.includes(fields.status))throw Error('Выберите допустимый приоритет и статус.');
  return {title:fields.title.trim(),room:fields.room,priority:fields.priority,status:fields.status,assignee:fields.assignee.trim(),comment:fields.comment.trim()};
}
export function createIncident(s,role,fields) {
  requirePermission(role,'incident:create');const values=validate(s,fields);
  if(!Number.isSafeInteger(s.incidentNextId)||s.incidentNextId>=Number.MAX_SAFE_INTEGER||s.incidents.length>=5000)throw Error('Достигнут предел учебного журнала.');
  const item={...values,id:s.incidentNextId,createdAt:new Date().toISOString()};
  s.incidents.push(item);s.incidentNextId++;return item;
}
export function editIncident(s,role,id,fields) {
  requirePermission(role,'incident:edit');
  const item=s.incidents.find(i=>i.id===id);if(!item)throw Error('Инцидент не найден.');
  const values=validate(s,fields);Object.assign(item,values,{updatedAt:new Date().toISOString()});return item;
}
export function deleteIncident(s,role,id) {
  requirePermission(role,'incident:delete');const index=s.incidents.findIndex(i=>i.id===id);
  if(index<0)throw Error('Инцидент не найден.');s.incidents.splice(index,1);
}
export function selectIncidents(s,{q='',room='',status='',priority=''}={}) {
  const query=q.trim().toLocaleLowerCase('ru');
  return s.incidents.filter(i=>(!room||i.room===room)&&(!status||i.status===status)&&(!priority||i.priority===priority)&&`${i.id} ${i.title} ${i.assignee} ${i.comment} ${i.room}`.toLocaleLowerCase('ru').includes(query));
}
