import { requirePermission } from './auth.js';
export const HISTORY_LIMIT=60;
export const INTERVAL_MS=5000;
const ranges={temperature:{min:20,max:34,drift:.8,jump:3},co2:{min:500,max:1700,drift:80,jump:500},energy:{min:1.5,max:7.5,drift:.35,jump:1.5}};
export function advanceReadings(s,role,{now=Date.now(),rng=Math.random}={}) {
  requirePermission(role,'simulation:control');
  if(!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime()))throw Error('Некорректное время измерения.');
  const random=()=>{const n=rng();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Некорректный источник случайных значений.');return n;};
  // Сначала готовим весь пакет и проверяем генератор случайных чисел, чтобы ошибка не оставила частично обновлённое состояние.
  const updates=s.devices.filter(d=>d.metric&&d.status==='online'&&now>Date.parse(d.updatedAt)).map(d=>{
    const r=ranges[d.metric],drift=(random()-.5)*2*r.drift;
    const jump=random()<.08?(random()<.5?-1:1)*r.jump:0;
    const value=Number(Math.min(r.max,Math.max(r.min,d.value+drift+jump)).toFixed(d.metric==='co2'?0:1));
    return {d,value};
  });
  const at=new Date(now).toISOString();
  for(const {d,value} of updates) {
    d.value=value;d.updatedAt=at;d.history=[...d.history,{at,value}].slice(-HISTORY_LIMIT);
    const room=s.rooms.find(r=>r.id===d.room);room[d.metric]=value;room.updatedAt=at;
    if(d.metric==='temperature')room.history=structuredClone(d.history);
  }
  return updates.length;
}
export function createSimulation({getState,getRole,persist,onChange=()=>{},onError=()=>{},now=Date.now,rng=Math.random,setIntervalFn=setInterval,clearIntervalFn=clearInterval}) {
  let timer=null,steps=0,lastAt=null;
  function step() {
    const at=now(),count=advanceReadings(getState(),getRole(),{now:at,rng});
    if(count){steps++;lastAt=new Date(at).toISOString();persist();}
    onChange();return count;
  }
  function stop() {if(timer!==null)clearIntervalFn(timer);timer=null;onChange();}
  function start() {
    requirePermission(getRole(),'simulation:control');if(timer!==null)return;
    timer=setIntervalFn(()=>{try{step()}catch(error){stop();onError(error.message)}},INTERVAL_MS);onChange();
  }
  function pause() {requirePermission(getRole(),'simulation:control');stop();}
  return {step,start,pause,stop,get running(){return timer!==null},get steps(){return steps},get lastAt(){return lastAt}};
}
