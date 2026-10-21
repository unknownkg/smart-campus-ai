import { selectRooms, selectDevices, roomStatus } from '../model.js';
import { can } from '../auth.js';
import { escapeHtml as e, heading, badge, roomLink, table, empty, time, fmt } from '../ui.js';

const filters=p=>({q:p.get('q')??'',building:p.get('building')??'',status:p.get('status')??'',room:p.get('room')??''});
const options=(rows,value)=>rows.map(([v,label])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(label)}</option>`).join('');
function filterForm(kind,p) {
  const f=filters(p);
  return `<form class="sc-filters" id="registry-filters" data-kind="${kind}"><div class="sc-field"><label for="registry-query">Поиск ${kind==='rooms'?'помещений':'устройств'}</label><input class="sc-input" type="search" id="registry-query" name="q" value="${e(f.q)}" placeholder="${kind==='rooms'?'ID, название или корпус':'Sensor ID, тип или помещение'}" maxlength="100"></div><div class="sc-field"><label for="building-filter">Корпус</label><select class="sc-select" id="building-filter" name="building">${options([['','Все корпуса'],...['A','B','C','D'].map(b=>[b,`Корпус ${b}`])],f.building)}</select></div><div class="sc-field"><label for="status-filter">Статус</label><select class="sc-select" id="status-filter" name="status">${options(kind==='rooms'?[['','Все статусы'],['normal','Норма'],['warning','Внимание'],['critical','Критично']]:[['','Все статусы'],['online','Online'],['offline','Offline']],f.status)}</select></div>${f.room?`<input type="hidden" name="room" value="${e(f.room)}">`:''}<button type="button" class="sc-btn sc-btn--ghost" data-action="filter-reset">Сбросить фильтры</button></form>`;
}
export function registryResults(s,kind,p) {
  const rows=kind==='rooms'?selectRooms(s,filters(p)):selectDevices(s,filters(p));
  return `<p class="sc-results-count" role="status">Найдено: ${rows.length}${p.get('room')?` · помещение ${e(p.get('room'))}`:''}</p>`+(rows.length?kind==='rooms'?table(
    ['Помещение / тип','Корпус / этаж','Температура','CO₂','Энергия / час','Занятость','Состояние'],
    rows.map(r=>`<tr><td>${roomLink(r.id)}<span class="sc-sub">${e(r.type)}</span></td><td>${r.building} / ${r.floor}</td><td>${fmt(r.temperature)} °C</td><td>${fmt(r.co2)} ppm</td><td>${fmt(r.energy)} кВт·ч</td><td>${r.occupancy} чел.</td><td>${badge(roomStatus(r))}</td></tr>`),'Помещения кампуса'
  ):table(['Sensor ID / тип','Помещение','Статус','Последнее показание','Обновление · Бишкек'],rows.map(d=>`<tr><td><a class="sc-link" href="#devices/${encodeURIComponent(d.id)}">${e(d.id)}</a><span class="sc-sub">${e(d.type)}</span></td><td>${roomLink(d.room)}</td><td>${badge(d.status)}</td><td>${e(typeof d.value==='number'?fmt(d.value):d.value)} ${e(d.unit)}${d.status==='offline'?'<span class="sc-sub">Последнее сохраненное</span>':''}</td><td>${time(d.updatedAt)}</td></tr>`),'Устройства кампуса'):empty());
}
export function registry(s,kind,p) {
  return heading(kind,kind==='rooms'?'Реестр аудиторий и инженерных помещений. Сохраненные учебные показатели.':'Датчики и исполнительные устройства, связанные с помещениями кампуса.')+
    `<section class="sc-section">${filterForm(kind,p)}<div id="registry-results">${registryResults(s,kind,p)}</div></section><p class="sc-muted">Показания учебные. Энергия — за последний час. При offline соответствующего датчика значение остается последним известным; актуальность смотрите в карточке помещения.</p>`;
}
function metricTile(s,r,key,label,unit) {
  const d=s.devices.find(d=>d.room===r.id&&d.metric===key);
  return `<div><dt>${label}</dt><dd>${fmt(r[key])} ${unit}<small>${d?.status==='offline'?'Последнее сохраненное · Offline':'Учебное измерение'}${d?` · ${time(d.updatedAt)}`:''}</small></dd></div>`;
}
export function roomDetail(s,id) {
  const r=s.rooms.find(r=>r.id===id);
  if(!r)return `<h1 tabindex="-1">Помещение не найдено</h1>${empty('Проверьте ссылку.')}<a class="sc-btn sc-btn--ghost" href="#rooms">К помещениям</a>`;
  const devices=s.devices.filter(d=>d.room===id), incidents=s.incidents.filter(i=>i.room===id);
  return `<a class="sc-link" href="#rooms">← Реестр помещений</a><div class="sc-page-heading"><div><span class="sc-overline">Паспорт помещения</span><h1 tabindex="-1">${e(r.id)}</h1><p>${e(r.type)} · Корпус ${r.building} · Этаж ${r.floor}</p></div>${badge(roomStatus(r))}</div>
  <dl class="sc-detail-grid">${metricTile(s,r,'temperature','Температура','°C')}${metricTile(s,r,'co2','CO₂','ppm')}${metricTile(s,r,'energy','Энергия за час','кВт·ч')}<div><dt>Занятость</dt><dd>${r.occupancy} <small>человек · учебное значение</small></dd></div><div><dt>Базовая линия энергии</dt><dd>${fmt(r.baseline)}<small>кВт·ч за час · пороги +30% / +60%</small></dd></div><div><dt>Связанные устройства</dt><dd>${devices.length}<small>${devices.filter(d=>d.status==='online').length} online</small></dd></div></dl>
  <section class="sc-section"><div class="sc-section-head"><h2>Устройства помещения</h2><a class="sc-link" href="#devices?room=${encodeURIComponent(id)}">Устройства помещения →</a></div>${table(['Sensor ID','Тип','Статус'],devices.map(d=>`<tr><td><a class="sc-link" href="#devices/${encodeURIComponent(d.id)}">${e(d.id)}</a></td><td>${e(d.type)}</td><td>${badge(d.status)}</td></tr>`),'Устройства помещения')}</section>
  <section class="sc-section"><div class="sc-section-head"><h2>Связанные инциденты · ${incidents.length}</h2><a href="#incidents?room=${encodeURIComponent(id)}" class="sc-link">Открыть журнал →</a></div>${incidents.length?table(['Инцидент','Приоритет','Статус'],incidents.map(i=>`<tr><td>${e(i.title)}</td><td>${badge(i.priority)}</td><td>${badge(i.status)}</td></tr>`),'Инциденты помещения'):empty('В помещении нет зарегистрированных инцидентов.')}</section>`;
}
export function deviceDetail(s,id,role) {
  const d=s.devices.find(d=>d.id===id);
  if(!d)return `<h1 tabindex="-1">Устройство не найдено</h1>${empty('Проверьте ссылку.')}<a class="sc-btn sc-btn--ghost" href="#devices">К устройствам</a>`;
  return `<a class="sc-link" href="#devices">← Реестр устройств</a><div class="sc-page-heading"><div><span class="sc-overline">Паспорт устройства</span><h1 tabindex="-1">${e(d.id)}</h1><p>${e(d.type)}</p></div>${badge(d.status)}</div><section class="sc-section"><div class="sc-section-content"><h2>Последнее сохраненное показание</h2><dl class="sc-detail-grid"><div><dt>Значение</dt><dd>${e(typeof d.value==='number'?fmt(d.value):d.value)} ${e(d.unit)}</dd></div><div><dt>Помещение</dt><dd>${roomLink(d.room)}</dd></div><div><dt>Обновление · Бишкек</dt><dd>${time(d.updatedAt)}</dd></div></dl><p>${d.status==='offline'?'Связь отсутствует или устройство выведено на обслуживание. Показание может быть устаревшим.':'Сохраненное синтетическое измерение. Подключения к реальному устройству нет.'}</p></div></section><section class="sc-section"><div class="sc-section-content"><h2>Учебное обслуживание</h2><p>Изменение online/offline обновляет реестр, KPI и уведомления. Значения и время измерений не изменяются.</p>${can(role,'device:maintain')?`<div><button class="sc-btn sc-btn--ghost" data-action="maintain" data-id="${e(id)}">${d.status==='online'?'Вывести на обслуживание':'Вернуть в сеть'}</button></div>`:'<p>Доступно Administrator и Engineer. Для Operator включен просмотр.</p>'}</div></section>`;
}
