import { can } from '../auth.js';
import { time } from '../ui.js';
export function simulationBar(sim,role) {
  return `<div class="sc-simulation-meta"><strong id="simulation-status">${sim.running?'Симуляция запущена':'Пауза симуляции'}</strong><span>Учебных шагов: <b id="simulation-step-count">${sim.steps}</b>${sim.lastAt?` · ${time(sim.lastAt)} (Бишкек)`:''}</span><small>Интервал 5 с · Только синтетические показания</small></div><div class="sc-form-actions">${can(role,'simulation:control')?`<button class="sc-btn sc-btn--small sc-btn--${sim.running?'ghost':'primary'}" data-action="${sim.running?'simulation-pause':'simulation-start'}">${sim.running?'Пауза симуляции':'Запустить симуляцию'}</button><button class="sc-btn sc-btn--small sc-btn--ghost" data-action="simulation-step">Ручной шаг</button>`:'<span class="sc-pill">Управление: Engineer / Administrator</span>'}</div>`;
}
