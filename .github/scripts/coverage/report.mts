/** Explicit scope discovery and a compact source-union report for local use and CI. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkoutRoot = fileURLToPath(new URL('../../../', import.meta.url));
import { parseArgs } from 'node:util';
import { readHitSummary } from './hit-summary.mts';
import { convert, movedPath } from './convert.mts';
import { merge } from './merge.mts';
import type { Summary } from './merge.mts';
import { parseMap as parseMoveMap } from './ratchet.mts';
import { list, repoPath } from './raw.mts';

export function scopeFiles(root:string,scope:string):string[] {
  if(scope!=='root' && scope!=='site') return list(JSON.parse(readFileSync(resolve(root,scope),'utf8'))).map(repoPath);
  return execFileSync('git',['ls-files','site'],{cwd:root,encoding:'utf8'}).split('\n').filter(f=>/\.(mts|ts)$/u.test(f) && !/\.d\.m?ts$/u.test(f) && !/\.test\./u.test(f) && !f.includes('/evidence/') && (scope==='site' || f.split('/').length===2)).sort();
}
export function table(summary:Summary):string {
  const row=(name:string,v:Summary['aggregate'])=>`${name.padEnd(22)} ${v.lines.pct.toFixed(2).padStart(7)} ${v.branches.pct.toFixed(2).padStart(8)} ${v.functions.pct.toFixed(2).padStart(9)}`;
  return ['source                 lines% branches% functions%',...Object.entries(summary.sources).map(([name,r])=>row(name,r.aggregate)),row('union',summary.aggregate),`${summary.scope.length} files; ${summary.neverLoaded.length} never loaded; ${summary.targets.below85.length} below 85% lines; ${summary.unmapped.length} mapping diagnostics; targets ${summary.targets.pass?'PASS':'NOT MET'}`].join('\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{scope:{type:'string',default:'root'},root:{type:'string',default:checkoutRoot},out:{type:'string',default:'output/coverage/summary.json'},exemptions:{type:'string'},'move-map':{type:'string'},files:{type:'boolean',default:false},'require-targets':{type:'boolean',default:false}}});
  if(!positionals.length) throw new Error('Supply one or more raw directories');
  const root=resolve(values.root), scope=scopeFiles(root,values.scope);
  const exemptions=values.exemptions?list(JSON.parse(readFileSync(values.exemptions,'utf8'))).map(repoPath):list(JSON.parse(readFileSync(new URL('./build-exemptions.json',import.meta.url),'utf8'))).map(repoPath).filter(f=>scope.includes(f));
  const moves=values['move-map']?parseMoveMap(JSON.parse(readFileSync(values['move-map'],'utf8'))):{};
  for(const file of Object.keys(moves)) movedPath(file,moves);
  const summary=merge(root,scope,positionals.map(dir=>dir.endsWith('.json')?readHitSummary(resolve(root,dir),root,scope):convert(resolve(root,dir),root,moves,scope)),exemptions,values.scope);
  mkdirSync(dirname(resolve(root,values.out)),{recursive:true}); writeFileSync(resolve(root,values.out),JSON.stringify(summary,null,2)+'\n'); console.log(table(summary));
  if(values.files) {console.log('file                                                lines% branches% functions%');for(const f of summary.files) console.log(`${f.file.padEnd(51)} ${f.lines.pct.toFixed(1).padStart(6)} ${f.branches.pct.toFixed(1).padStart(8)} ${f.functions.pct.toFixed(1).padStart(9)}${f.exempt?' exempt':''}${f.loaded?'':' never loaded'}`);}
  if(values['require-targets'] && !summary.targets.pass) process.exitCode=1;
}
