export const escapeHtml = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=(n)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
export const time=(at)=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bishkek'}).format(new Date(at));
const paths={
  campus:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7M3 10h18"/>',
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  rooms:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-6h6v6M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  devices:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
  incidents:'<path d="M12 3 2.5 20h19zM12 9v5m0 3h.01"/>',
  analytics:'<path d="M3 3v18h18M6 16l5-5 4 3 6-8"/>',
  notifications:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  theme:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17-7-2 2M7 17l-2 2m14 0-2-2M7 7 5 5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout:'<path d="M10 17l5-5-5-5m5 5H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  energy:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
};
export const icon=(name)=>`<svg class="sc-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]??paths.campus}</svg>`;
export const brand=()=>`<span class="sc-brand"><span class="sc-brand-mark">${icon('campus')}</span><span><span class="sc-brand-name">smart campus <span class="jade-text">AI</span></span><span class="sc-brand-sub">Infrastructure Intelligence</span></span></span>`;
export const routes={dashboard:'Обзор',rooms:'Помещения',devices:'Устройства',incidents:'Инциденты',analytics:'Аналитика',notifications:'Уведомления',settings:'Настройки'};
export const titles={...routes,dashboard:'Состояние кампуса'};
export function badge(status) {
  const map={normal:['good','Норма'],warning:['warn','Внимание'],critical:['danger','Критично'],online:['good','Online'],offline:['warn','Offline'],open:['warn','Открыт'],in_progress:['info','В работе'],resolved:['good','Закрыт'],high:['danger','Высокий'],medium:['warn','Средний'],low:['info','Низкий']};
  const [tone,label]=map[status]??['info',String(status)];
  return `<span class="sc-pill sc-pill--${tone}"><span class="sc-dot"></span>${escapeHtml(label)}</span>`;
}
export const heading=(route,description,action='')=>`<div class="sc-page-heading"><div><span class="sc-overline">Операционный центр / ${escapeHtml(route==='dashboard'?'Registry':routes[route])}</span><h1 tabindex="-1">${escapeHtml(titles[route])}</h1><p>${escapeHtml(description)}</p></div>${action}</div>`;
export const empty=(text='Измените запрос или сбросьте фильтры.')=>`<div class="sc-empty">${icon('search')}<strong>Ничего не найдено</strong><p>${escapeHtml(text)}</p></div>`;
export const stageNote=(text)=>`<div class="sc-alert">${icon('analytics')}<span><strong>Следующий этап.</strong> ${escapeHtml(text)}</span></div>`;
export const roomLink=(id)=>`<a class="sc-link" href="#rooms/${encodeURIComponent(id)}">${escapeHtml(id)}</a>`;
export function table(headers,rows,caption='Результаты') {
  return `<div class="sc-table-wrap" tabindex="0" role="region" aria-label="${escapeHtml(caption)}"><table class="sc-table"><caption class="sc-visually-hidden">${escapeHtml(caption)}</caption><thead><tr>${headers.map(x=>`<th scope="col">${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
