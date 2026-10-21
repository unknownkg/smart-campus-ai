// Учебная статистика: стандартное отклонение σ с делением на N и порог |z| > 2 по методическим указаниям.
export const Z_THRESHOLD=2, MIN_SAMPLES=5, BASELINE_WINDOW=20, STALE_MS=15*60*1000;
export const metricLabels={temperature:'Температура',co2:'CO₂',energy:'Энергия за час'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function statistics(history,current) {
  const values=(Array.isArray(history)?history:[]).filter(finite).slice(-BASELINE_WINDOW);
  const base={n:values.length,current,mean:null,sd:null,z:null,anomaly:false};
  if(!finite(current))return {...base,status:'invalid'};
  if(values.length<MIN_SAMPLES)return {...base,status:'insufficient'};
  const mean=values.reduce((n,x)=>n+x,0)/values.length;
  const sd=Math.sqrt(values.reduce((n,x)=>n+(x-mean)**2,0)/values.length);
  if(!finite(mean)||!finite(sd))return {...base,status:'invalid'};
  const z=sd===0?0:Math.abs((current-mean)/sd);
  if(!finite(z))return {...base,mean,sd,status:'invalid'};
  return {...base,mean,sd,z,anomaly:z>Z_THRESHOLD,status:sd===0?'constant':z>Z_THRESHOLD?'anomaly':'normal'};
}
export const analysisReasons={
  offline:'Устройство offline: новые данные не анализируются.',stale:'Измерение старше 15 минут: сначала обновите показание.',
  future:'Время измерения находится в будущем: проверьте часы.',invalid:'Некорректное значение или история измерений.',
  insufficient:'Недостаточно данных: нужны минимум 5 предыдущих конечных значений.',constant:'σ=0: по методичке z=0; статистический вывод ограничен.',
  anomaly:'|z| > 2: отклонение от предыдущих измерений.',normal:'|z| ≤ 2: статистическое отклонение не обнаружено.'
};
export function analyzeDevices(s,now=Date.now()) {
  return s.devices.filter(d=>d.metric).map(d=>{
    const base={device:d.id,room:d.room,metric:d.metric,unit:d.unit,current:d.value,at:d.updatedAt,n:0,mean:null,sd:null,z:null,anomaly:false};
    const at=Date.parse(d.updatedAt);
    let status=null;
    if(d.status==='offline')status='offline';
    else if(!finite(d.value)||!finite(at)||!finite(now))status='invalid';
    else if(at>now)status='future';
    else if(now-at>STALE_MS)status='stale';
    // В расчёт входят только измерения раньше текущей временной метки.
    // Точки с текущей или будущей меткой исключаются даже при некорректных данных в памяти.
    const history=(Array.isArray(d.history)?d.history:[]).filter(h=>h&&finite(Date.parse(h.at))&&Date.parse(h.at)<at).map(h=>h.value);
    const result=status?{...base,status}:{...base,...statistics(history,d.value)};
    return {...result,reason:analysisReasons[result.status]};
  });
}
function priority(level){return level==='critical'?'high':'medium'}
export function activeEvents(s,now=Date.now()) {
  const events=[];
  for(const r of s.rooms)for(const [kind,condition,title,value,critical] of [
    ['co2',r.co2>=1000,'Повышенный CO₂',`${r.co2} ppm`,r.co2>=1500],
    ['temperature',r.temperature>27||r.temperature<18,'Отклонение температуры',`${r.temperature} °C`,r.temperature>=32],
    ['energy',r.energy>=r.baseline*1.3-1e-9,'Перерасход энергии',`${r.energy} кВт·ч · +${Math.round((r.energy/r.baseline-1)*100)}% к базе ${r.baseline}`,r.energy>=r.baseline*1.6-1e-9],
  ]) if(condition) {
    const d=s.devices.find(d=>d.room===r.id&&d.metric===kind),at=d?.updatedAt??r.updatedAt,level=critical?'critical':'warning';
    events.push({id:`${kind}:${r.id}`,kind,room:r.id,device:d?.id,title,value,level,priority:priority(level),at,
      stale:!d||d.status==='offline'||!finite(Date.parse(at))||Date.parse(at)>now||now-Date.parse(at)>STALE_MS,
      href:`#rooms/${encodeURIComponent(r.id)}`});
  }
  for(const d of s.devices.filter(d=>d.status==='offline'))events.push({id:`offline:${d.id}`,kind:'offline',room:d.room,device:d.id,title:'Устройство вне сети',value:d.id,level:'warning',priority:'medium',at:d.updatedAt,stale:true,href:`#devices/${encodeURIComponent(d.id)}`});
  for(const a of analyzeDevices(s,now).filter(a=>a.anomaly)) {
    const level=a.z>3?'critical':'warning';
    events.push({id:`zscore:${a.device}`,kind:'zscore',room:a.room,device:a.device,title:'Статистическая аномалия',value:`${metricLabels[a.metric]} ${a.current} ${a.unit} · z=${a.z.toFixed(2)}`,level,priority:priority(level),at:a.at,stale:false,href:`#devices/${encodeURIComponent(a.device)}`});
  }
  return events;
}
export function recommendations(s,now=Date.now()) {
  const actions={co2:'Проверить вентиляцию и воздухообмен помещения.',temperature:'Проверить охлаждение, отопление и вентиляцию.',energy:'Проверить нагрузку и оставленное включенным оборудование.',offline:'Проверить подключение, питание и последнее измерение.',zscore:'Проверить резкое отклонение и исправность датчика; сопоставить с условиями помещения.'};
  const items=activeEvents(s,now).map(n=>({...n,reason:`${n.stale?'Последнее сохраненное показание. ':''}${n.value}`,action:n.stale&&n.kind!=='offline'?'Сначала проверить связь и получить свежее измерение. '+actions[n.kind]:actions[n.kind]}));
  for(const r of s.rooms.filter(r=>r.occupancy===0&&r.energy>4))items.push({id:`unoccupied:${r.id}`,kind:'unoccupied',room:r.id,title:'Энергия без присутствия',reason:`Занятость 0 человек, энергия ${r.energy} кВт·ч за час (>4).`,action:'Проверить оставленное оборудование; для серверной уточнить допустимость постоянной нагрузки.',priority:'medium',href:`#rooms/${encodeURIComponent(r.id)}`});
  for(const a of analyzeDevices(s,now).filter(a=>a.status==='stale'||a.status==='future'))items.push({id:`freshness:${a.device}`,kind:'freshness',room:a.room,title:'Проверить актуальность измерения',reason:`${a.device}: ${a.reason}`,action:'Проверить часы, подключение и обновить учебное измерение.',priority:'medium',href:`#devices/${encodeURIComponent(a.device)}`});
  return items;
}
