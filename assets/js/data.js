// Только синтетические учебные данные; реальные помещения и люди не отслеживаются.
export function createSeed() {
  const now = new Date();
  const updatedAt = now.toISOString();
  const rows = [
    ['A-101','Компьютерный класс',24.3,780,3.6,3,18],
    ['A-102','Лекционная аудитория',23.1,860,2.8,3,24],
    ['A-205','Лаборатория сетей',26.2,1538,4.2,3.5,26],
    ['B-101','Библиотека',22.4,650,2.2,2.5,12],
    ['B-201','Серверная',32.8,510,5.8,5,0],
    ['B-202','Лаборатория электроники',24.5,820,3.1,3,14],
    ['C-101','Администрация',23.4,740,1.8,2,6],
    ['C-202','Лекционная аудитория',23.8,910,2.6,3,22],
    ['C-203','Переговорная',22.6,620,1.2,1.5,4],
    ['D-101','Компьютерный класс',25.1,1050,5.4,3,0],
    ['D-201','Лаборатория робототехники',24.8,890,3.7,3.5,16],
    ['D-202','Учебная аудитория',23.6,760,2.1,2.5,20],
  ];
  const rooms = rows.map(([id,type,temperature,co2,energy,baseline,occupancy])=>({
    id, name:type, building:id[0], floor:Number(id[2]), type,
    temperature, co2, energy, baseline, occupancy, updatedAt,
    history:[-0.8,-0.5,-0.6,-0.3,-0.1,0].map((offset,i)=>({
      at:new Date(now.getTime()-(5-i)*3600000).toISOString(),
      value:Number((temperature+offset).toFixed(1))
    }))
  }));
  const metrics = [
    ['TEMP','Temperature Sensor','temperature','°C'],
    ['CO2','CO₂ Sensor','co2','ppm'],
    ['ENERGY','Energy Meter','energy','кВт·ч'],
  ];
  const devices = rooms.flatMap(r=>metrics.map(([prefix,type,metric,unit])=>({
    id:`${prefix}-${r.id}-01`, room:r.id, type, metric, value:r[metric], unit,
    status: r.id==='C-202'&&metric==='co2'?'offline':'online',
    updatedAt:r.id==='C-202'&&metric==='co2'?new Date(now.getTime()-7200000).toISOString():updatedAt,
  })));
  for(const d of devices) {
    const room=rooms.find(r=>r.id===d.room);
    d.history=d.metric==='temperature'?structuredClone(room.history):[{at:d.updatedAt,value:d.value}];
  }
  for (const building of ['A','B','C','D']) devices.push({
    id:`HVAC-${building}-101-01`,room:`${building}-101`,type:'Ventilation Controller',
    metric:null,value:'Автоматический',unit:'',status:'online',updatedAt,
  });
  return {
    version:2, rooms, devices, incidentNextId:5,
    incidents:[
      {id:1,title:'Высокий уровень CO₂',room:'A-205',priority:'high',status:'open',assignee:'Инженер вентиляции',comment:'Проверить воздухообмен.',createdAt:updatedAt},
      {id:2,title:'Перегрев серверной',room:'B-201',priority:'high',status:'in_progress',assignee:'Дежурный инженер',comment:'Проверка охлаждения.',createdAt:updatedAt},
      {id:3,title:'Нет связи с CO₂-датчиком',room:'C-202',priority:'medium',status:'open',assignee:'Инженер IoT',comment:'Последнее измерение сохранено.',createdAt:updatedAt},
      {id:4,title:'Энергопотребление без присутствия',room:'D-101',priority:'medium',status:'open',assignee:'Энергетик',comment:'Проверить оставленное оборудование.',createdAt:updatedAt},
    ],
    readNotifications:{},settings:{campusName:'Smart Campus'},
  };
}
