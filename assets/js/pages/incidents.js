import { can, requirePermission } from '../auth.js';
import { createIncident, editIncident, deleteIncident, selectIncidents } from '../incidents.js';
import { heading, escapeHtml as e, table, badge, roomLink, time, empty } from '../ui.js';
const option=(v,label,selected)=>`<option value="${e(v)}" ${v===selected?'selected':''}>${e(label)}</option>`;
const statuses=[['open','Открыт'],['in_progress','В работе'],['resolved','Закрыт']];
const priorities=[['high','Высокий'],['medium','Средний'],['low','Низкий']];
export function incidentResults(s,p,role) {
  const items=selectIncidents(s,Object.fromEntries(p));
  return `<p class="sc-results-count" role="status">Найдено: ${items.length}</p>`+(items.length?table(['№ / Инцидент','Помещение','Приоритет','Статус','Ответственный / комментарий','Действия'],items.map(i=>`<tr><td><strong>#${i.id} · ${e(i.title)}</strong><span class="sc-sub">${time(i.createdAt)} · Бишкек</span></td><td>${roomLink(i.room)}</td><td>${badge(i.priority)}</td><td>${badge(i.status)}</td><td>${e(i.assignee)}<span class="sc-sub">${e(i.comment)}</span></td><td><div class="sc-form-actions">${can(role,'incident:edit')?`<button class="sc-btn sc-btn--ghost sc-btn--small" data-action="incident-edit" data-id="${i.id}">Редактировать</button>`:''}${can(role,'incident:delete')?`<button class="sc-btn sc-btn--danger sc-btn--small" data-action="incident-delete" data-id="${i.id}">Удалить</button>`:''}${!can(role,'incident:edit')?'Только просмотр':''}</div></td></tr>`),'Журнал инцидентов'):empty('Измените фильтры или создайте инцидент, если ваша роль это разрешает.'));
}
export function incidentView(s,p,role) {
  return heading('incidents','Журнал проблем кампуса: помещение, приоритет, статус и ответственный.',can(role,'incident:create')?'<button class="sc-btn sc-btn--primary" data-action="incident-new">Добавить инцидент</button>':'<span class="sc-pill">Только просмотр</span>')+
  `<section class="sc-section"><form class="sc-filters" id="incident-filters"><div class="sc-field"><label for="incident-query">Поиск инцидентов</label><input class="sc-input" id="incident-query" type="search" name="q" value="${e(p.get('q')??'')}" maxlength="200"></div><div class="sc-field"><label for="incident-room-filter">Фильтр помещения инцидентов</label><select class="sc-select" name="room" id="incident-room-filter">${option('','Все помещения',p.get('room'))}${s.rooms.map(r=>option(r.id,r.id,p.get('room'))).join('')}</select></div><div class="sc-field"><label for="incident-status-filter">Фильтр статуса инцидентов</label><select class="sc-select" name="status" id="incident-status-filter">${option('','Все статусы',p.get('status'))}${statuses.map(([v,l])=>option(v,l,p.get('status'))).join('')}</select></div><div class="sc-field"><label for="incident-priority-filter">Фильтр приоритета инцидентов</label><select class="sc-select" name="priority" id="incident-priority-filter">${option('','Все приоритеты',p.get('priority'))}${priorities.map(([v,l])=>option(v,l,p.get('priority'))).join('')}</select></div></form><div id="incident-results">${incidentResults(s,p,role)}</div></section>`;
}
export function handleIncidentAction(action,id,{s,role,onSave,notify,confirm}) {
  if(action==='incident-delete') {
    requirePermission(role,'incident:delete');
    const item=s.incidents.find(i=>i.id===id);if(!item)throw Error('Инцидент не найден.');
    confirm(`Удалить инцидент #${id} «${item.title}»?`,()=>deleteIncident(s,role,id));return;
  }
  const editing=action==='incident-edit';requirePermission(role,editing?'incident:edit':'incident:create');
  const item=editing?s.incidents.find(i=>i.id===id):{title:'',room:s.rooms[0].id,priority:'medium',status:'open',assignee:'',comment:''};
  if(!item)throw Error('Инцидент не найден.');
  const dialog=document.createElement('dialog');dialog.className='sc-modal';dialog.id='incident-dialog';dialog.setAttribute('aria-labelledby','incident-form-title');
  dialog.innerHTML=`<div class="sc-modal-head"><h2 id="incident-form-title">${editing?`Редактирование #${id}`:'Новый инцидент'}</h2></div><form id="incident-form" class="sc-form"><div class="sc-field"><label for="incident-title">Описание проблемы</label><textarea class="sc-input" id="incident-title" name="title" maxlength="200" rows="2" required>${e(item.title)}</textarea></div><div class="sc-field"><label for="incident-room">Помещение инцидента</label><select class="sc-select" id="incident-room" name="room">${s.rooms.map(r=>option(r.id,r.id,item.room)).join('')}</select></div><div class="sc-form-columns"><div class="sc-field"><label for="incident-priority">Приоритет инцидента</label><select class="sc-select" id="incident-priority" name="priority">${priorities.map(([v,l])=>option(v,l,item.priority)).join('')}</select></div><div class="sc-field"><label for="incident-status">Статус инцидента</label><select class="sc-select" id="incident-status" name="status">${statuses.map(([v,l])=>option(v,l,item.status)).join('')}</select></div></div><div class="sc-field"><label for="incident-assignee">Ответственный</label><input class="sc-input" id="incident-assignee" name="assignee" value="${e(item.assignee)}" maxlength="200" required></div><div class="sc-field"><label for="incident-comment">Комментарий</label><textarea class="sc-input" id="incident-comment" name="comment" maxlength="2000" rows="3">${e(item.comment)}</textarea></div><p class="sc-field-error" id="incident-error" role="alert"></p><div class="sc-form-actions"><button class="sc-btn sc-btn--primary" type="submit">Сохранить инцидент</button><button class="sc-btn sc-btn--ghost" type="button" data-action="dialog-close">Отмена</button></div></form>`;
  document.querySelector('#app').append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(!document.activeElement||document.activeElement===document.body)document.querySelector('main h1')?.focus();});
  dialog.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
    try {if(editing)editIncident(s,role,id,values);else createIncident(s,role,values);dialog.close();onSave();}
    catch(error){dialog.querySelector('#incident-error').textContent=error.message;notify(error.message);}
  });
  dialog.showModal();dialog.querySelector('textarea').focus();
}
