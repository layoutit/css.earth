/** Run a command with inherited V8 coverage, then preserve every repository script from every process/worker dump. */
import { spawn } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkoutRoot = fileURLToPath(new URL('../../../', import.meta.url));
import { parseArgs } from 'node:util';
import { dedupeNodeScripts } from './node-union.mts';
import { convert } from './convert.mts';
import { scopeFiles } from './report.mts';
import { writeHitSummary } from './hit-summary.mts';
import { object, list, text, number, parseFunctions, writeRaw } from './raw.mts';
import type { RawScript, RawRun } from './raw.mts';

export function normalizeNode(dumpDir: string, out: string, root: string, kind='node', costMs=0): RawRun {
  mkdirSync(out,{recursive:true}); const scripts:RawScript[]=[], issues:string[]=[];
  let dumps=0, ignored=0;
  const sourceNames = new Map<string,string>();
  const captured = new Map<string,string>();
  const captureDir = resolve(out,'captured');
  if (existsSync(captureDir)) for (const name of readdirSync(captureDir).filter(f=>f.endsWith('.json'))) {
    for (const [url, file] of Object.entries(object(JSON.parse(readFileSync(resolve(captureDir,name),'utf8'))))) captured.set(url, readFileSync(resolve(captureDir,text(file)),'utf8'));
  }
  for(const file of readdirSync(dumpDir).filter(f=>f.endsWith('.json'))) {
    const value=object(JSON.parse(readFileSync(resolve(dumpDir,file),'utf8'))); dumps++;
    for(const entry of list(value.result)) {
      const s=object(entry), url=text(s.url), functions=parseFunctions(s.functions);
      if(!url.startsWith('file:')) { ignored++; continue; }
      const absolute=fileURLToPath(url), sourcePath=relative(root,absolute).replaceAll('\\','/');
      if(sourcePath.startsWith('../') || sourcePath.includes('node_modules/') || !existsSync(absolute)) { ignored++; continue; }
      const original=readFileSync(absolute,'utf8'), name=sourceNames.get(sourcePath) ?? `script-${sourceNames.size}.js`;
      if (new URL(url).search) { issues.push(`loader-transformed source needs a map: ${url}`); continue; }
      const source=captured.get(url) ?? (/\.(mts|ts)$/u.test(sourcePath) ? stripTypeScriptTypes(original,{mode:'strip',sourceUrl:url}) : original);
      if (!captured.has(url)) issues.push(`No independently captured Node source: ${sourcePath}`);
      if(functions.some(f=>f.ranges.some(r=>r.endOffset>source.length))) { issues.push(`transformed source needs a map: ${url}`); continue; }
      if (!sourceNames.has(sourcePath)) { writeFileSync(resolve(out,name),source); sourceNames.set(sourcePath,name); }
      else if (readFileSync(resolve(out,name),'utf8') !== source) throw new Error(`Node source changed during collection: ${sourcePath}`);
      scripts.push({url,source:name,sourcePath,functions,context:file});
    }
  }
  if(!dumps || !scripts.length) throw new Error('No repository V8 evidence produced');
  const unique = dedupeNodeScripts(scripts,out);
  writeFileSync(resolve(out,'normalization.json'),JSON.stringify({dumps,scripts:scripts.length,uniqueSources:sourceNames.size,rawScripts:unique.length,ignored},null,2)+'\n');
  const recordedCost=costMs || (existsSync(resolve(out,'status.json')) ? number(object(JSON.parse(readFileSync(resolve(out,'status.json'),'utf8'))).costMs) : 0);
  const run:RawRun={version:1,kind,root,costMs:recordedCost,scripts:unique,issues}; writeRaw(out,run); return run;
}
export async function collectNode(command: string[], out: string, root=checkoutRoot, kind='node', scope='root'): Promise<void> {
  if(!command.length || command.some(c=>!c)) throw new Error('Nonempty command required');
  const dir=resolve(out,'v8'); mkdirSync(dir,{recursive:true});
  if(readdirSync(dir).length) throw new Error('V8 dump directory must be empty (separate runs must not be mixed)');
  const start=performance.now();
  const captureDir=resolve(out,'captured'); mkdirSync(captureDir,{recursive:true});
  const code=await new Promise<number>((accept,reject)=> {
    const child=spawn(command[0]!,command.slice(1),{cwd:root,stdio:'inherit',env:{...process.env,NODE_V8_COVERAGE:dir,COVERAGE_SOURCE_DIR:captureDir,COVERAGE_SOURCE_ROOT:root,NODE_OPTIONS:`${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./node-source.mts',import.meta.url).href}`}});
    child.on('error',reject); child.on('exit',(code,signal)=>signal?reject(new Error(`Command killed: ${signal}`)):accept(code??1));
  });
  normalizeNode(dir,out,root,kind,performance.now()-start);
  writeFileSync(resolve(out,'status.json'),JSON.stringify({exitCode:code,costMs:performance.now()-start})+'\n');
  writeHitSummary(resolve(out,'summary.json'),root,scopeFiles(root,scope),convert(out,root),code===0);
  rmSync(captureDir,{recursive:true,force:true});
  rmSync(dir,{recursive:true,force:true});
  if(code!==0) throw new Error(`Coverage command failed (${code}); evidence retained, run is not qualified`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const split=process.argv.indexOf('--');
  const {values}=parseArgs({args:process.argv.slice(2,split<0?undefined:split),options:{out:{type:'string',default:'output/coverage/node'},root:{type:'string',default:checkoutRoot},kind:{type:'string',default:'node'},scope:{type:'string',default:'root'},normalize:{type:'string'}}});
  if(values.normalize) normalizeNode(resolve(values.root,values.normalize),resolve(values.root,values.out),resolve(values.root),values.kind);
  else await collectNode(split<0?['pnpm','test:run','site/**/!(rendered-page).test.{ts,mts}']:process.argv.slice(split+1),resolve(values.root,values.out),resolve(values.root),values.kind,values.scope);
}
