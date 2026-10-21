export const accounts = Object.freeze({
  Administrator:'admin@campus.demo',Engineer:'engineer@campus.demo',Operator:'operator@campus.demo'
});
export const roleDescription = {
  Administrator:'Все разделы, полный CRUD инцидентов, симуляция, обслуживание устройств, параметры и сброс.',
  Engineer:'Все разделы, создание и редактирование инцидентов, симуляция и обслуживание устройств.',
  Operator:'Просмотр инфраструктуры, поиск и отметка прочитанных уведомлений.'
};
export function authenticate(email,password,role) {
  return Object.hasOwn(accounts,role)&&email.trim().toLowerCase()===accounts[role]&&password==='campus-demo'
    ? {email:accounts[role],role} : null;
}
export function validSession(s) {
  return Boolean(s&&Object.hasOwn(accounts,s.role)&&accounts[s.role]===s.email);
}
export function can(role,action) {
  if (!Object.hasOwn(accounts,role)) return false;
  if (action==='notifications:read') return true;
  if (action==='device:maintain') return role!=='Operator';
  if (['incident:create','incident:edit','simulation:control'].includes(action)) return role!=='Operator';
  if (action==='incident:delete') return role==='Administrator';
  if (action==='settings:write'||action==='data:reset') return role==='Administrator';
  return false;
}
export function requirePermission(role,action) {
  if (!can(role,action)) throw new Error('Недостаточно прав для этого действия.');
}
