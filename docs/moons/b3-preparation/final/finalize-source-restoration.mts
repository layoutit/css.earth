import {shape,array,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {hasErrorCode} from '../../../../tools/source-values.mts';
const parseReport=shape({bodies:array(shape({id:text,status:text,sourceRoot:text}))});
interface RestorationRow {id:string;sourceRoot:string;priorReport:string;manifestSha256:string;trackedDocumentRefresh:{path:string;previousSha256:string|null;sha256:string;bytes:number}[];verification?:Awaited<ReturnType<typeof verifySources>>;status?:string;}
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseSourceManifest,verifySources} from '../../../../tools/objects/dist/operations.js';
const ids='callisto hyperion phoebe proteus titania miranda'.split(' '),root=process.cwd();
const first='/tmp/moons-b3-fresh-sources-20260909',uranus='/tmp/moons-b3-fresh-uranus-20260909';
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const tracked=new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0'));
const reports=new Map(await Promise.all([first,uranus].map(async dir=>[dir,parseReport(JSON.parse(await readFile(resolve(dir,'report.json'),'utf8')))] as const)));
const result={schema:'cssearth-b3-final-source-restoration@1',status:'RUNNING',startedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Four original successful network restorations plus two fresh Uranus replacements with exact original GIS files now tracked. Subsequent tracked document changes are listed explicitly; no ignored file is copied from the working checkout.',bodies:[] as RestorationRow[],finishedAt:undefined as string|undefined};
for(const id of ids){
 const base=['titania','miranda'].includes(id)?uranus:first,prior=reports.get(base)?.bodies.find(b=>b.id===id);
 assert.ok(prior,`Missing original source restoration: ${id}`);
 assert.equal(prior.status,'PASS');
 const sourceRoot=resolve(base,prior.sourceRoot),working=resolve(root,'src/planets',id,'source'),bytes=await readFile(resolve(working,'manifest.json'));
 const manifest=parseSourceManifest(JSON.parse(bytes.toString('utf8')),id);
 const row:RestorationRow={id,sourceRoot,priorReport:resolve(base,'report.json'),manifestSha256:hash(bytes),trackedDocumentRefresh:[]};
 for(const collection of (['inputs','generatedIntermediates','documents'] as const))for(const entry of manifest[collection]){
  let existing:Buffer|undefined;try{existing=await readFile(resolve(sourceRoot,entry.path));}catch(e){if(!hasErrorCode(e,'ENOENT'))throw e;}
  if(existing?.length===entry.expectedBytes&&hash(existing)===entry.expectedSha256)continue;
  assert.equal(collection,'documents',`${id}/${entry.path}: source input changed after its fresh restoration`);
  const path=`src/planets/${id}/source/${entry.path}`;assert.ok(tracked.has(path));
  const original=execFileSync('git',['show',`HEAD:${path}`]);assert.equal(hash(original),entry.expectedSha256);assert.equal(original.length,entry.expectedBytes);
  await writeFile(resolve(sourceRoot,entry.path),original);
  row.trackedDocumentRefresh.push({path:entry.path,previousSha256:existing?hash(existing):null,sha256:hash(original),bytes:original.length});
 }
 await writeFile(resolve(sourceRoot,'manifest.json'),bytes);
 row.verification=await verifySources({sourceRoot,manifest});row.status='PASS';result.bodies.push(row);
}
result.status='PASS';result.finishedAt=new Date().toISOString();await writeFile('docs/moons/b3-preparation/final/fresh-source-restoration.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,bodies:result.bodies.map(b=>({id:b.id,verified:b.verification?.verifiedCount,documentRefresh:b.trackedDocumentRefresh.length}))}));
