import { summary, roomStatus, notifications } from '../model.js';
import { heading, fmt, icon, escapeHtml as e, badge, roomLink, time } from '../ui.js';

export function dashboard(s) {
  const k=summary(s);
  const cards=[
    ['Помещения',k.rooms,'rooms','rooms','Четыре учебных корпуса'],
    ['Устройства в сети',k.online,'devices?status=online','devices',`Из ${s.devices.length} устройств`],
    ['Устройства offline',k.offline,'devices?status=offline','devices','Проверьте связь и обслуживание'],
    ['Активные инциденты',k.incidents,'incidents','incidents','Открыты и находятся в работе'],
    ['Энергия за час',`${fmt(k.energy)} <small>кВт·ч</small>`,'analytics','energy','Сумма последнего учебного часа'],
    ['Предупреждения',k.alerts,'notifications','notifications','По порогам и доступности устройств'],
  ];
  return heading('dashboard','Обзор помещений, инженерных систем и зарегистрированных событий.',`<span class="sc-pill">Демонстрационные данные</span>`)+
  `<section class="sc-kpi-grid" aria-label="Ключевые показатели">${cards.map(([label,value,href,i,detail])=>`<a class="sc-kpi" href="#${href}"><div class="sc-kpi-top">${label}${icon(i)}</div><div class="sc-kpi-value sc-number">${value}</div><div class="sc-kpi-detail">${detail}</div></a>`).join('')}</section>
  <div class="sc-main-grid"><div class="sc-main-column"><section class="sc-section"><div class="sc-section-head"><div><h2>Реестр корпусов</h2><p>Выберите корпус для перехода к помещениям</p></div><span class="sc-pill">4 корпуса</span></div><div class="sc-campus-cells">${['A','B','C','D'].map(b=>{
    const rooms=s.rooms.filter(r=>r.building===b),bad=rooms.filter(r=>roomStatus(r)!=='normal').length;
    return `<a class="sc-campus-cell" href="#rooms?building=${b}"><div class="sc-campus-cell-top"><span class="sc-campus-letter">${b}</span>${icon('rooms')}</div><span class="sc-campus-meta">Корпус ${b} · ${rooms.length} помещения</span><div class="sc-campus-foot"><strong>${bad?`${bad} с отклонениями`:'Параметры в норме'}</strong>${icon('arrow')}</div></a>`;
  }).join('')}</div></section><section class="sc-section"><div class="sc-section-head"><div><h2>Энергия по корпусам</h2><p>Последний час · последние известные показания</p></div><a href="#analytics" class="sc-link">Аналитика →</a></div><div class="sc-section-content"><div class="sc-chart" id="dashboard-energy"></div></div><p class="sc-chart-description">Суммарно ${fmt(k.energy)} кВт·ч. Не показания реального кампуса.</p></section></div>
  <div class="sc-side-column"><section class="sc-section"><div class="sc-section-head"><div><h2>Последние инциденты</h2><p>Учебный журнал инфраструктуры</p></div><a class="sc-link" href="#incidents">Все →</a></div><div class="sc-list">${s.incidents.slice(0,3).map(i=>`<div class="sc-list-item"><div><h3>${e(i.title)}</h3><p>${roomLink(i.room)} · ${e(i.assignee)}</p></div>${badge(i.status)}</div>`).join('')}</div></section><section class="sc-section"><div class="sc-section-head"><h2>Требует внимания</h2><a href="#notifications" class="sc-link">Все →</a></div><div class="sc-list">${notifications(s).slice(0,3).map(n=>`<div class="sc-list-item"><div><h3>${e(n.title)}</h3><p>${roomLink(n.room)} · ${e(n.value)}</p><p class="sc-meta">${time(n.at)} · Бишкек</p></div>${badge(n.level)}</div>`).join('')}</div></section></div></div>
  <div class="sc-notice">Последнее обновление учебного состояния: ${time(s.rooms[0].updatedAt)} (Бишкек). Управление обновлением — в панели симуляции. При offline показания сохраняются как последние известные.</div>`;
}
