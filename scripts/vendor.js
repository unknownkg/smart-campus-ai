import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('assets/vendor',{recursive:true});
for(const [source,target] of [
  ['dist/chart.umd.js','chart.umd.js'],
  ['dist/chart.umd.js.map','chart.umd.js.map'],
  ['LICENSE.md','CHART-LICENSE.md'],
]) copyFileSync(`node_modules/chart.js/${source}`,`assets/vendor/${target}`);
console.log('Chart.js 4.5.1 copied with source map and MIT license.');
