import { analyticsView } from './analytics.js';
import { notifications } from '../model.js';
import { heading, stageNote, table, badge, roomLink, escapeHtml as e, time, empty } from '../ui.js';
import { incidentView } from './incidents.js';

export function incidents(s,p,role) { return incidentView(s,p,role); }
export function notificationView(s,email) {
  const list=notifications(s),read=s.readNotifications[email]??[];
  return heading('notifications','Предупреждения по порогам методички и состоянию связи с устройствами.')+
  `<div class="sc-notice">Отметка «Прочитано» сохраняется отдельно для текущего учебного аккаунта. Она не устраняет причину предупреждения и не закрывает инцидент.</div><section class="sc-section"><div class="sc-section-head"><h2>Журнал предупреждений</h2><span class="sc-pill">${list.filter(n=>!read.includes(n.id)).length} непрочитанных</span></div><div class="sc-list">${list.map(n=>`<article class="sc-list-item ${read.includes(n.id)?'sc-read':''}"><div><h2>${e(n.title)} ${badge(n.level)}</h2><p>${roomLink(n.room)} · <span>${e(n.value)}</span></p><p class="sc-meta">${time(n.at)} · Бишкек · ${n.kind==='offline'?'Последняя связь':n.kind==='zscore'?'Статистическое отклонение':'Пороговое предупреждение'}${n.stale?' · Последнее сохраненное, актуальность не подтверждена':''}</p><p class="sc-meta">Приоритет: ${n.priority==='high'?'Высокий':'Средний'}</p><a class="sc-link" href="${e(n.href)}">Открыть объект</a></div>${read.includes(n.id)?'<span class="sc-pill">Прочитано</span>':`<button class="sc-btn sc-btn--ghost sc-btn--small" data-action="notification-read" data-id="${e(n.id)}">Отметить прочитанным</button>`}</article>`).join('')||empty('Предупреждений нет.')}</div></section>`;
}
export function analytics(s,p) { return analyticsView(s,p); }
