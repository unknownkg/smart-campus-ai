export function chartData(s,roomId) {
  const room=s.rooms.find(r=>r.id===roomId)??s.rooms[0];
  const labels=['A','B','C','D'];
  const online=s.devices.filter(d=>d.status==='online').length;
  return {
    energy:{labels,values:labels.map(b=>Number(s.rooms.filter(r=>r.building===b).reduce((n,r)=>n+r.energy,0).toFixed(1)))},
    devices:{labels:['Online','Offline'],values:[online,s.devices.length-online]},
    temperature:{room:room.id,labels:room.history.map(h=>new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Bishkek'}).format(new Date(h.at))),values:room.history.map(h=>h.value)},
  };
}
let instances=[];
export function destroyCharts() {
  for(const chart of instances)chart.destroy();
  instances=[];
}
export function mountCharts(s,roomId='A-101') {
  destroyCharts();
  const data=chartData(s,roomId);
  const css=getComputedStyle(document.documentElement);
  const color=name=>css.getPropertyValue(`--sc-${name}`).trim();
  function draw(id,type,labels,values,label) {
    const host=document.getElementById(id);
    if(!host)return;
    host.replaceChildren();
    const canvas=document.createElement('canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',`${label}: ${labels.map((x,i)=>`${x}: ${values[i]}`).join('; ')}`);
    host.append(canvas);
    if(!globalThis.Chart) {host.textContent='Chart.js недоступен. Проверьте локальный файл assets/vendor/chart.umd.js.';return;}
    const round=type==='doughnut';
    instances.push(new globalThis.Chart(canvas,{
      type,
      data:{labels,datasets:[{label,data:values,borderWidth:type==='line'?2:0,
        borderColor:color('jade'),backgroundColor:round?[color('jade'),color('warning')]:type==='bar'?[color('garnet-active'),color('jade'),color('info'),color('warning')]:color('jade-wash'),pointBackgroundColor:color('jade'),fill:type==='line',tension:.2,borderRadius:type==='bar'?5:0}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,
        plugins:{legend:{display:round,position:'bottom',labels:{color:color('ink-2'),boxWidth:12}},tooltip:{enabled:true}},
        ...(round?{cutout:'72%'}:{scales:{x:{ticks:{color:color('ink-3'),maxRotation:0},grid:{display:false}},y:{beginAtZero:type==='bar',ticks:{color:color('ink-3')},grid:{color:color('line')}}}})
      }
    }));
  }
  draw('dashboard-energy','bar',data.energy.labels,data.energy.values,'Энергия за час, кВт·ч');
  draw('analytics-energy','bar',data.energy.labels,data.energy.values,'Энергия за час, кВт·ч');
  draw('analytics-devices','doughnut',data.devices.labels,data.devices.values,'Устройства');
  draw('analytics-temperature','line',data.temperature.labels,data.temperature.values,`${data.temperature.room} · Температура, °C · Бишкек`);
}
