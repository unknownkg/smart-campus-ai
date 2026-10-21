import { accounts, authenticate, validSession, roleDescription, requirePermission } from './auth.js';
import { createStore } from './storage.js';
import { notifications, selectRooms, selectDevices, setDeviceStatus, updateSettings } from './model.js';
import { escapeHtml as e, brand, icon, routes, titles, empty } from './ui.js';
import { dashboard } from './pages/dashboard.js';
import { registry, registryResults, roomDetail, deviceDetail } from './pages/registry.js';
import { incidents, notificationView, analytics } from './pages/operations.js';
import { settings } from './pages/settings.js';
import { mountCharts, destroyCharts } from './charts.js';
import { handleIncidentAction, incidentResults } from './pages/incidents.js';
import { createSimulation } from './simulation.js';
import { simulationBar } from './pages/simulation.js';
import { analyticsResults } from './pages/analytics.js';

const root=document.querySelector('#app');
const safeStorage=(name)=>{try{return window[name]}catch{return {getItem(){throw Error('Unavailable')},setItem(){throw Error('Unavailable')},removeItem(){}}}};
const local=safeStorage('localStorage'), sessionStorage=safeStorage('sessionStorage');
const store=createStore(local);
let session=null, theme='dark', sessionWarning='';
try {const saved=JSON.parse(sessionStorage.getItem('smart-campus:session'));if(validSession(saved))session=saved;}catch{sessionWarning='Сеанс не сохраняется в браузере. Вход действует только до перезагрузки страницы.';}
try {theme=local.getItem('smart-campus:theme')==='light'?'light':'dark';}catch{/* При недоступном хранилище сохраняем тёмную тему по умолчанию. */}
document.documentElement.dataset.theme=theme;
let activeRoute='dashboard';
let chartRoom='A-101',pendingRefresh=false;
const simulation=createSimulation({getState:()=>store.state,getRole:()=>session?.role,persist:()=>persist(),onChange:refreshSimulation,onError:message=>toast(message)});
function refreshSimulation() {
  if(!session)return;
  const focused=document.activeElement;
  const identity=focused?{id:focused.id,tag:focused.tagName,action:focused.dataset?.action,target:focused.dataset?.id,href:focused.getAttribute('href')}:null;
  const sameIdentity=el=>el.tagName===identity?.tag&&el.dataset.action===identity?.action&&el.dataset.id===identity?.target&&el.getAttribute('href')===identity?.href;
  const occurrence=identity?[...root.querySelectorAll('button,a,summary')].filter(sameIdentity).indexOf(focused):0;
  const blocked=root.querySelector('dialog[open]')||document.body.classList.contains('sc-menu-open')||focused?.closest('form')||focused?.matches('input,textarea,select');
  pendingRefresh=Boolean(blocked);
  const bar=document.querySelector('#simulation-host');if(bar)bar.innerHTML=simulationBar(simulation,session.role)+(blocked?'<p class="sc-refresh-note" role="status">Данные обновлены в памяти. Содержимое экрана обновится после завершения ввода или закрытия диалога.</p>':'');
  const warning=document.querySelector('.sc-storage-warning');if(warning)warning.textContent=store.warning;
  if(blocked)return;
  const scroll=scrollY;
  render();window.scrollTo(0,scroll);
  let next=identity?.id?document.getElementById(identity.id):[...root.querySelectorAll('button,a,summary')].filter(sameIdentity)[Math.max(0,occurrence)];
  if(!next&&['simulation-start','simulation-pause'].includes(identity?.action))next=root.querySelector('[data-action="simulation-start"],[data-action="simulation-pause"]');
  next?.focus({preventScroll:true});
}
const readRoute=()=>{
  const raw=location.hash.slice(1),[path,query='']=raw.split('?');
  const [route='',id='']=path.split('/');
  let decoded='';try{decoded=decodeURIComponent(id)}catch{/* При ошибке декодирования оставляем идентификатор пустым. */}
  return {route:Object.hasOwn(routes,route)?route:'dashboard',id:decoded,params:new URLSearchParams(query)};
};
function themeToggle() {
  theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;
  try {local.setItem('smart-campus:theme',theme)}catch{toast('Тема изменена, но браузер не разрешил сохранить выбор.')}
  if (session&&activeRoute==='settings')render();
  else if(session)mountCharts(store.state,chartRoom);
}
function loginView() {
  root.innerHTML=`<div class="sc-login-page"><header class="sc-login-header">${brand()}<button class="sc-icon-button" data-action="theme" aria-label="Сменить тему">${icon('theme')}</button></header>
  <main id="content" class="sc-login-main"><section class="sc-monolith" aria-label="Учебная авторизация"><div class="sc-monolith-info"><div class="sc-monolith-seal">${icon('campus')}</div><span class="sc-overline">Smart Campus / Учебная среда</span><h1>Инфраструктура под наблюдением</h1><p>Помещения, инженерные системы и события кампуса — в едином рабочем пространстве.</p><div class="sc-module-list"><span class="sc-module-item">${icon('rooms')}12 помещений · 4 корпуса</span><span class="sc-module-item">${icon('devices')}40 учебных IoT-устройств</span><span class="sc-module-item">${icon('analytics')}Согласованные данные и показатели</span></div></div>
  <form class="sc-monolith-form" id="login-form"><div><span class="sc-overline">The Monolith</span><h2>Вход в систему</h2><p class="sc-muted">Выберите роль учебного пользователя.</p></div><div class="sc-login-fields"><div class="sc-field"><label for="role">Учебная роль</label><select class="sc-select" id="role" name="role">${Object.keys(accounts).map(r=>`<option>${r}</option>`).join('')}</select></div><p class="sc-role-description" id="role-description">${roleDescription.Administrator}</p><div class="sc-field"><label for="email">Email</label><input id="email" class="sc-input" name="email" type="email" autocomplete="username" value="admin@campus.demo" maxlength="100" required></div><div class="sc-field"><label for="password">Пароль</label><input id="password" class="sc-input" name="password" type="password" autocomplete="current-password" maxlength="100" required></div></div><div class="sc-login-account" id="account-hint">Демо-аккаунт: admin@campus.demo<br>Общий пароль: <strong>campus-demo</strong></div><p id="login-error" class="sc-login-msg" role="alert"></p><button class="sc-btn sc-btn--primary sc-btn--full" type="submit">Войти в систему ${icon('arrow')}</button><div class="sc-login-help">Учебная имитация без бэкенда. Открытые демо-данные; не вводите личный пароль.</div></form></section></main>
  <footer class="sc-login-footer"><span>Машуров Артур Геннадьевич · КС-3-24<br>Лабораторная Каныбекова Кареля Каныбековича</span><span>Garnet Ash × Mineral Steel<br>Этап 2 · Учебная лабораторная</span></footer></div>`;
  document.querySelector('#role').addEventListener('change',event=>{
    const role=event.target.value;
    document.querySelector('#email').value=accounts[role];
    document.querySelector('#role-description').textContent=roleDescription[role];
    document.querySelector('#account-hint').innerHTML=`Демо-аккаунт: ${accounts[role]}<br>Общий пароль: <strong>campus-demo</strong>`;
  });
  document.querySelector('#login-form').addEventListener('submit',event=>{
    event.preventDefault();const f=new FormData(event.target);
    const next=authenticate(f.get('email'),f.get('password'),f.get('role'));
    if (!next) {document.querySelector('#login-error').textContent='Неверный email, пароль или роль. Используйте указанный демо-аккаунт.';return;}
    session=next;
    try {sessionStorage.setItem('smart-campus:session',JSON.stringify(session));sessionWarning='';}catch{sessionWarning='Сеанс не сохраняется в браузере. Вход действует только до перезагрузки страницы.';}
    location.hash='dashboard';render();
  });
}
function shell() {
  root.innerHTML=`<div class="sc-mobile-scrim" data-action="menu-close"></div><div class="sc-app"><aside class="sc-sidebar" id="sidebar" aria-label="Основная навигация"><div class="sc-sidebar-top"><button class="sc-icon-button sc-menu-close" data-action="menu-close" aria-label="Закрыть меню">${icon('close')}</button><a href="#dashboard">${brand()}</a></div><div><p class="sc-sidebar-label">Рабочее пространство</p><nav class="sc-nav" aria-label="Разделы приложения">${Object.entries(routes).map(([key,label])=>`<a class="sc-nav-link" href="#${key}" data-route="${key}">${icon(key)}<span>${label}</span></a>`).join('')}</nav></div><div class="sc-sidebar-foot"><div class="sc-sidebar-foot-box"><span class="sc-pill sc-pill--good"><span class="sc-dot"></span> Учебная среда</span><p>Синтетические показания. Реальные датчики не подключены.</p></div><div class="sc-muted">${e(session.role)}<br><small>${e(session.email)}</small></div><button class="sc-btn sc-btn--ghost sc-btn--full" data-action="logout">${icon('logout')} Выйти</button></div></aside>
  <div class="sc-workspace"><header class="sc-topbar"><div class="sc-topbar-right"><button class="sc-icon-button sc-mobile-menu" data-action="menu" aria-label="Открыть меню" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><div class="sc-topbar-heading"><span class="sc-breadcrumb" id="campus-name"></span><strong id="route-title"></strong></div></div><div class="sc-topbar-right"><button class="sc-topbar-search" data-action="search" aria-label="Открыть быстрый поиск">${icon('search')}<span>Помещение или устройство</span><span class="sc-kbd">Ctrl K</span></button><button class="sc-icon-button" data-action="theme" aria-label="Сменить тему">${icon('theme')}</button><a class="sc-icon-button" href="#notifications" aria-label="Уведомления">${icon('notifications')}</a><span class="sc-avatar" title="Учебный профиль">${e(session.role[0])}</span><div class="sc-profile"><strong>${e(session.role)}</strong><span class="sc-faint">Учебный профиль</span></div></div></header><section class="sc-simulation-bar" id="simulation-host" aria-label="Учебная симуляция"></section><main id="content" class="sc-content"></main></div></div>
  <dialog class="sc-modal" id="search-dialog" aria-labelledby="search-title"><div class="sc-modal-head"><h2 id="search-title">Быстрый поиск</h2><button class="sc-icon-button" data-action="dialog-close" aria-label="Закрыть поиск">${icon('close')}</button></div><label class="sc-field" for="quick-query">Помещение, устройство или раздел<input id="quick-query" class="sc-input" type="search" placeholder="A-205, Temperature, настройки" maxlength="100"></label><div id="quick-results" class="sc-dialog-results"></div></dialog>
  <dialog class="sc-modal" id="confirm-dialog" aria-labelledby="confirm-title"><div class="sc-modal-head"><h2 id="confirm-title">Подтвердить действие</h2></div><p id="confirm-text"></p><div class="sc-form-actions"><button class="sc-btn sc-btn--ghost" data-action="dialog-close" autofocus>Отмена</button><button class="sc-btn sc-btn--danger" id="confirm-yes">Подтвердить</button></div></dialog>
  <div id="toast" class="sc-toast" role="status" hidden><span></span><button class="sc-icon-button" data-action="toast-close" aria-label="Закрыть сообщение">${icon('close')}</button></div>`;
}
function render() {
  pendingRefresh=false;
  destroyCharts();
  if (!session) {loginView();return;}
  if (!root.querySelector('.sc-app')) shell();
  const {route,id,params}=readRoute(); activeRoute=route;
  const main=document.querySelector('main');main.dataset.route=route;
  const views={dashboard:()=>dashboard(store.state),rooms:()=>id?roomDetail(store.state,id):registry(store.state,'rooms',params),devices:()=>id?deviceDetail(store.state,id,session.role):registry(store.state,'devices',params),incidents:()=>incidents(store.state,params,session.role),analytics:()=>analytics(store.state,params),notifications:()=>notificationView(store.state,session.email),settings:()=>settings(store.state,session,theme)};
  main.innerHTML=`<div class="sc-notice sc-storage-warning" role="alert">${e(store.warning)}</div>${sessionWarning?`<div class="sc-notice sc-session-warning" role="status">${e(sessionWarning)}</div>`:''}`+views[route]()+`<footer class="sc-content-footer"><span>Smart Campus AI · КС-3-24 · Этап 2</span><span>Учебные данные · Время: Бишкек (UTC+6)</span></footer>`;
  if (route==='rooms'||route==='devices') {
    const form=document.querySelector('#registry-filters');
    if(form) {
      const apply=()=>{
        const q=new URLSearchParams();
        for(const [key,value] of new FormData(form))if(value)q.set(key,value);
        history.replaceState(null,'',`#${route}${q.size?'?'+q.toString():''}`);
        document.querySelector('#registry-results').innerHTML=registryResults(store.state,route,q);
      };
      form.addEventListener('input',apply);
      form.addEventListener('submit',event=>{event.preventDefault();apply()});
    }
  }
  document.querySelector('#settings-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    try {updateSettings(store.state,session.role,Object.fromEntries(new FormData(event.target)));persist();render();toast('Параметры кампуса сохранены.');}
    catch(error){document.querySelector('#settings-error').textContent=error.message;}
  });
  const incidentFilters=document.querySelector('#incident-filters');
  if(incidentFilters) {
    const apply=()=>{
      const q=new URLSearchParams();for(const [key,value] of new FormData(incidentFilters))if(value)q.set(key,value);
      history.replaceState(null,'',`#incidents${q.size?'?'+q.toString():''}`);
      document.querySelector('#incident-results').innerHTML=incidentResults(store.state,q,session.role);
    };
    incidentFilters.addEventListener('input',apply);incidentFilters.addEventListener('submit',event=>{event.preventDefault();apply()});
  }
  const analysisFilters=document.querySelector('#analysis-filters');
  if(analysisFilters) {
    const apply=()=>{
      const q=new URLSearchParams();for(const [key,value] of new FormData(analysisFilters))if(value)q.set(key,value);
      history.replaceState(null,'',`#analytics${q.size?'?'+q.toString():''}`);
      document.querySelector('#analytics-results').innerHTML=analyticsResults(store.state,q);
    };
    analysisFilters.addEventListener('input',apply);analysisFilters.addEventListener('submit',event=>{event.preventDefault();apply()});
  }
  for (const a of root.querySelectorAll('nav a[data-route]')) {
    if(a.dataset.route===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  document.querySelector('#campus-name').textContent=store.state.settings.campusName;
  document.querySelector('#route-title').textContent=routes[route];
  document.title=`${titles[route]} · Smart Campus AI`;
  document.querySelector('#simulation-host').innerHTML=simulationBar(simulation,session.role);
  const chartSelect=document.querySelector('#chart-room');if(chartSelect)chartSelect.value=chartRoom;
  mountCharts(store.state,chartRoom);
  chartSelect?.addEventListener('change',event=>{chartRoom=event.target.value;mountCharts(store.state,chartRoom)});
  closeMenu();
}
function persist() {store.save();}
function confirmAction(text,action) {
  const dialog=document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-text').textContent=text;
  document.querySelector('#confirm-yes').onclick=()=>{
    dialog.close();
    try {action();persist();render();toast('Учебные данные обновлены.');}
    catch(error){toast(error.message);}
  };
  dialog.showModal();
}
function quickResults() {
  const q=document.querySelector('#quick-query').value;
  const items=[
    ...Object.entries(routes).filter(([id,title])=>`${id} ${title}`.toLowerCase().includes(q.trim().toLowerCase())).map(([id,title])=>({title,href:`#${id}`,kind:'Раздел'})),
    ...selectRooms(store.state,{q}).map(r=>({title:r.id,href:`#rooms/${encodeURIComponent(r.id)}`,kind:r.type})),
    ...selectDevices(store.state,{q}).map(d=>({title:d.id,href:`#devices/${encodeURIComponent(d.id)}`,kind:d.type})),
  ];
  document.querySelector('#quick-results').innerHTML=items.slice(0,30).map(i=>`<a class="sc-dialog-result" href="${i.href}"><span>${e(i.title)}<small class="sc-muted sc-search-kind">${e(i.kind)}</small></span>${icon('arrow')}</a>`).join('')||empty();
}
function openSearch() {
  if(!session)return;
  closeMenu();const dialog=document.querySelector('#search-dialog');
  if(dialog.open)return;
  dialog.showModal();const input=document.querySelector('#quick-query');input.value='';input.oninput=quickResults;quickResults();input.focus();
}
function toast(text) {const el=document.querySelector('#toast');if(el){el.firstElementChild.textContent=text;el.hidden=false;}}
function closeMenu() {
  document.body.classList.remove('sc-menu-open');
  const workspace=document.querySelector('.sc-workspace');if(workspace)workspace.inert=false;
  root.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded','false');
}
root.addEventListener('click',event=>{
  if(event.target.closest('a[href^="#"]')) {
    event.target.closest('dialog')?.close();
    if(document.body.classList.contains('sc-menu-open'))closeMenu();
  }
  const el=event.target.closest('[data-action]');
  if(!el)return;
  const action=el.dataset.action;
  if(action.startsWith('simulation-')&&session) {
    try {requirePermission(session.role,'simulation:control');if(action==='simulation-start')simulation.start();else if(action==='simulation-pause')simulation.pause();else if(action==='simulation-step')simulation.step();}
    catch(error){toast(error.message);}
    return;
  }
  if(action.startsWith('incident-')&&session) {
    try {handleIncidentAction(action,Number(el.dataset.id),{s:store.state,role:session.role,onSave:()=>{persist();render();toast('Инцидент сохранен.');},notify:toast,confirm:confirmAction});}
    catch(error){toast(error.message);}
    return;
  }
  if(action==='theme')themeToggle();
  if(action==='search')openSearch();
  if(action==='filter-reset') {history.replaceState(null,'',`#${activeRoute}`);render();document.querySelector('#registry-query')?.focus();}
  if(action==='maintain'&&session)confirmAction('Изменить учебное состояние связи? Сохраненные показания не изменятся.',()=>setDeviceStatus(store.state,session.role,el.dataset.id));
  if(action==='reset-data'&&session)confirmAction('Вернуть исходный учебный набор? Локальные изменения данных и отметки уведомлений будут сброшены.',()=>{simulation.stop();store.reset(session.role)});
  if(action==='notification-read'&&session) {
    try {
      requirePermission(session.role,'notifications:read');
      if(notifications(store.state).some(n=>n.id===el.dataset.id)) {
        const read=store.state.readNotifications[session.email]??[];
        store.state.readNotifications[session.email]=[...new Set([...read,el.dataset.id])];persist();render();
      }
    } catch(error){toast(error.message);}
  }
  if(action==='logout') {simulation.stop();destroyCharts();session=null;try{sessionStorage.removeItem('smart-campus:session')}catch{/* Если хранилище недоступно, сеанс всё равно завершается в памяти. */}closeMenu();loginView();}
  if(action==='dialog-close')el.closest('dialog').close();
  if(action==='toast-close')el.closest('#toast').hidden=true;
  if(action==='menu-close') {closeMenu();root.querySelector('[data-action="menu"]')?.focus();}
  if(action==='menu') {
    document.body.classList.add('sc-menu-open');document.querySelector('.sc-workspace').inert=true;
    el.setAttribute('aria-expanded','true');document.querySelector('.sc-menu-close').focus();
  }
});
root.addEventListener('close',()=>{if(pendingRefresh)queueMicrotask(()=>{if(pendingRefresh)refreshSimulation()})},true);
// Не обновляем DOM на focusout: это событие возникает до нажатия кнопки сохранения или отмены.
root.addEventListener('click',event=>{if(pendingRefresh&&!event.target.closest('form,button,a,input,textarea,select,summary'))queueMicrotask(()=>{if(pendingRefresh)refreshSimulation()})});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k') {event.preventDefault();openSearch();}
  if(event.key==='Escape'&&document.body.classList.contains('sc-menu-open')) {
    closeMenu();root.querySelector('[data-action="menu"]')?.focus();
  }
  if(event.key==='Tab'&&document.body.classList.contains('sc-menu-open')) {
    const items=[...document.querySelector('#sidebar').querySelectorAll('a,button')].filter(el=>el.getClientRects().length);
    if(event.shiftKey&&document.activeElement===items[0]) {event.preventDefault();items.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)) {event.preventDefault();items[0].focus();}
  }
});
document.querySelector('.sc-skip-link').addEventListener('click',event=>{
  event.preventDefault();const main=document.querySelector('main');
  main.tabIndex=-1;main.focus();main.scrollIntoView();
});
window.addEventListener('hashchange',()=>{render();document.querySelector('main h1')?.focus();window.scrollTo(0,0)});
window.addEventListener('resize',()=>{if(innerWidth>720)closeMenu()});
render();
