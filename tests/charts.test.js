import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../assets/js/data.js';
import { chartData } from '../assets/js/charts.js';
import { setDeviceStatus } from '../assets/js/model.js';
import { escapeHtml } from '../assets/js/ui.js';
test('energy chart aggregates the same hourly values as rooms, by building',()=>{
  const s=createSeed(),d=chartData(s,'A-101');
  assert.deepEqual(d.energy.labels,['A','B','C','D']);
  for(let i=0;i<4;i++)assert.equal(d.energy.values[i],Number(s.rooms.filter(r=>r.building===d.energy.labels[i]).reduce((n,r)=>n+r.energy,0).toFixed(1)));
});
test('temperature chart uses selected room historical timestamps and values',()=>{
  const s=createSeed(),d=chartData(s,'B-201');
  assert.deepEqual(d.temperature.values,s.rooms.find(r=>r.id==='B-201').history.map(h=>h.value));
  assert.equal(d.temperature.labels.length,6);
  assert.equal(d.temperature.values.at(-1),32.8);
  assert.equal(chartData(s,'missing').temperature.room,'A-101');
});
test('device chart changes with maintenance, without inventing observations',()=>{
  const s=createSeed();assert.deepEqual(chartData(s).devices.values,[39,1]);
  setDeviceStatus(s,'Engineer',s.devices[0].id);
  assert.deepEqual(chartData(s).devices.values,[38,2]);
});
test('UI escapes user controlled strings for text and attribute contexts',()=>{
  assert.equal(escapeHtml('<script>"&\'</script>'),'&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
});
