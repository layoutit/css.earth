#!/usr/bin/env node
// Bounded mutation proof against the current shared TypeScript renderer.
// Each baseline must pass; a mutation must produce a named independent
// lighting/orbit measurement failure. Compile, serving and process failure
// are not accepted as evidence that the oracle detected the mutation.
import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir,rm,access } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const backup=resolve(root,'node_modules/.cache/shared-geometry-mutations');
const options=process.argv.slice(2);
const argument=(name,fallback)=>{const index=options.indexOf(name);return index<0?fallback:options[index+1];};
const port=Number(argument('--port','4269'));
if(!Number.isInteger(port)||port<1024||port>65535)throw new TypeError('Mutation server port is invalid.');
const mutations=[
 {id:'light-roll-180',file:'src/renderers/css/rendering/prepared-material.ts',
  find:'const base=rotation.reference==="initial"?Math.atan2(reference[1],reference[0])*180/Math.PI:rotation.baseDegrees;',
  replace:'const base=(rotation.reference==="initial"?Math.atan2(reference[1],reference[0])*180/Math.PI:rotation.baseDegrees)+180; /*! mutation:light-roll-180 */',
  suite:'lighting-geometry-browser.mjs',suiteName:'mercury-lighting-geometry',expected:/lit-direction-matches-oracle|lit-side-faces-sun-sprite|terminator/},
 {id:'system-orbit-scale',file:'src/renderers/css/solar-system/heliocentric-view.ts',
  find:'orbitSegments: systemOrbits ? projectRing(body.orbit.vertices, trailWeights?.[body.id] ?? body.orbit.trail) : Object.freeze([]),',
  replace:'orbitSegments: systemOrbits ? projectRing(body.orbit.vertices.map(vertex => vertex.map(component => component * 1.15) as [number,number,number]), trailWeights?.[body.id] ?? body.orbit.trail) : Object.freeze([]), /*! mutation:system-orbit-scale */',
  suite:'planetary-system-browser.mjs',suiteName:'mercury-planetary-system',expected:/orbit-(shape|ratio|axis-backprojected)|marker-on-orbit/},
];
const selectedIds=argument('--only',mutations.map(mutation=>mutation.id).join(',')).split(',');
if(selectedIds.some(id=>!mutations.some(mutation=>mutation.id===id)))throw new TypeError('Unknown mutation selection.');
const selected=mutations.filter(mutation=>selectedIds.includes(mutation.id));
const report={schema:'cssearth-independent-mutation-proof@1',baseline:[],mutations:[]};
const reportPath=resolve(root,argument('--report','.local/full-json-migration/browser-mutation-proof.json'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
let activeChild=null,server=null;
function command(binary,args,timeout=300000){return new Promise((done,reject)=>{
 const child=spawn(binary,args,{cwd:root,stdio:['ignore','pipe','pipe']});activeChild=child;let output='';
 child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
 const heartbeat=setInterval(()=>console.log(`Mutation gate: ${args[0]??binary} is running (${Math.round(output.length/1024)} KiB captured).`),30000);
 const timer=setTimeout(()=>child.kill('SIGTERM'),timeout);
 child.once('error',error=>{clearTimeout(timer);clearInterval(heartbeat);reject(error);});
 child.once('close',(code,signal)=>{clearTimeout(timer);clearInterval(heartbeat);activeChild=null;done({code,signal,output});});
});}
async function compile(){const result=await command('pnpm',['build:renderer']);if(result.code!==0)throw new Error(`Renderer compilation failed:\n${result.output.slice(-6000)}`);const bytes=await readFile(resolve(root,'src/renderers/css/dist/index.js'));if(!bytes.length)throw new Error('Renderer build produced no bytes.');}
async function restore(){const manifestPath=resolve(backup,'manifest.json');if(!await exists(manifestPath))return;const files=JSON.parse(await readFile(manifestPath,'utf8'));for(const [index,file] of files.entries())await writeFile(resolve(root,file),await readFile(resolve(backup,`${index}.source`)));await compile();await rm(backup,{recursive:true,force:true});}
if(options.includes('--restore')){await restore();console.log('Restored shared renderer mutation backup.');process.exit(0);}
if(await exists(resolve(backup,'manifest.json')))throw new Error('An interrupted mutation backup exists; run with --restore first.');
async function pause(milliseconds){await new Promise(done=>setTimeout(done,milliseconds));}
async function servedRenderer(){const response=await fetch(`http://127.0.0.1:${port}/src/renderers/css/dist/index.js`,{cache:'no-store'});if(!response.ok)throw new Error(`Renderer serving failed ${response.status}.`);return response.text();}
async function suite(mutation){const result=await command(process.execPath,[resolve(dirname(fileURLToPath(import.meta.url)),mutation.suite),`http://127.0.0.1:${port}`],600000);
 const lines=result.output.trim().split('\n');let evidence;
 for(const line of lines.reverse()){try{const parsed=JSON.parse(line);if(parsed.suite===mutation.suiteName){evidence=parsed;break;}}catch{}}
 if(!evidence||!Array.isArray(evidence.failed)||!Array.isArray(evidence.checks)||!evidence.checks.length)throw new Error(`Suite produced no measurement evidence:\n${result.output.slice(-5000)}`);
 return {exitCode:result.code,evidence};
}
const signal=()=>{activeChild?.kill('SIGTERM');server?.kill('SIGTERM');process.exitCode=130;};
process.on('SIGINT',signal);process.on('SIGTERM',signal);
try{
 await new Promise((done,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(done));});
 await mkdir(backup,{recursive:true});const files=[...new Set(selected.map(mutation=>mutation.file))];
 for(const [index,file] of files.entries())await writeFile(resolve(backup,`${index}.source`),await readFile(resolve(root,file)));
 await writeFile(resolve(backup,'manifest.json'),JSON.stringify(files));await compile();
 server=spawn('pnpm',['exec','astro','dev','--ignore-lock','--host','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,ASTRO_DEV_BACKGROUND:'1'},stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',data=>serverLog+=data);server.stderr.on('data',data=>serverLog+=data);
 await pause(750);
 let ready=false;for(let attempt=0;attempt<120;attempt++){if(server.exitCode!==null)throw new Error(`Mutation server exited: ${serverLog.slice(-4000)}`);try{const response=await fetch(`http://127.0.0.1:${port}/mercury/`);if(response.ok){ready=true;break;}}catch{}await pause(500);}if(!ready)throw new Error(`Mutation server did not become ready: ${serverLog.slice(-4000)}`);
 for(const mutation of selected){
  if(!report.baseline.some(item=>item.suite===mutation.suiteName)){console.log(`Baseline: ${mutation.suiteName}`);const baseline=await suite(mutation);if(baseline.exitCode!==0||baseline.evidence.failed.length)throw new Error(`Baseline ${mutation.suiteName} failed: ${baseline.evidence.failed.join(', ')}.`);report.baseline.push({suite:mutation.suiteName,checks:baseline.evidence.checks.length});}
  const path=resolve(root,mutation.file),original=await readFile(path,'utf8');if(original.split(mutation.find).length!==2)throw new Error(`Mutation ${mutation.id} target is not unique.`);
  const before=digest(await servedRenderer());
  try{await writeFile(path,original.replace(mutation.find,mutation.replace));await compile();const compiled=await readFile(resolve(root,'src/renderers/css/dist/index.js'),'utf8');if(!compiled.includes(`mutation:${mutation.id}`))throw new Error('Mutation marker was absent from compiled renderer.');
   let served='';for(let attempt=0;attempt<40;attempt++){served=await servedRenderer();if(served.includes(`mutation:${mutation.id}`)&&digest(served)!==before)break;await pause(250);}if(!served.includes(`mutation:${mutation.id}`)||digest(served)===before)throw new Error('Mutated renderer was not served.');
   console.log(`Measuring mutation: ${mutation.id}`);const result=await suite(mutation),failures=result.evidence.failed.filter(id=>mutation.expected.test(id));
   if(result.exitCode===0||!failures.length)throw new Error(`Mutation ${mutation.id} survived its independent measurement checks.`);
   report.mutations.push({id:mutation.id,detected:true,servedSha256:digest(served),expectedFailures:failures,checks:result.evidence.checks});
   console.log(`Detected ${mutation.id}: ${failures.join(', ')}`);
  }finally{await writeFile(path,original);await compile();}
 }
}finally{
 activeChild?.kill('SIGTERM');server?.kill('SIGTERM');await restore();await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}
if(report.mutations.length!==selected.length)throw new Error('Mutation proof is incomplete.');
console.log(JSON.stringify({ok:true,mutations:report.mutations.map(item=>item.id),report:reportPath}));
