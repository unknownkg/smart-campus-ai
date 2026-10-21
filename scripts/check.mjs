import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const files=[];
function walk(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())walk(path);else files.push(path);}}
walk('assets/js');walk('scripts');walk('tests');
for(const file of files.filter(f=>/\.m?js$/.test(f))) {
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  for(const [,rel] of readFileSync(file,'utf8').matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
    if(!existsSync(resolve(dirname(file),rel)))throw Error(`Missing import: ${file} → ${rel}`);
  }
}
const html=readFileSync('index.html','utf8');
for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(url.startsWith('#'))continue;
  if(url.startsWith('/')||url.includes('://'))throw Error(`Non-relative dependency: ${url}`);
  if(!existsSync(url))throw Error(`Missing asset: ${url}`);
}
for(const file of ['tokens.css','base.css','login.css','registry.css','app.css']) {
  const css=readFileSync(`assets/css/${file}`,'utf8');
  if(/@import|url\(https?:/.test(css))throw Error(`External CSS dependency in ${file}`);
}
if(existsSync('node_modules/chart.js')) {
  const digest=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
  if(digest('assets/vendor/chart.umd.js')!==digest('node_modules/chart.js/dist/chart.umd.js'))throw Error('Vendored Chart.js differs from locked package');
}
console.log('OK: JS syntax, local imports/assets, relative paths, CSS dependencies, Chart.js integrity.');
