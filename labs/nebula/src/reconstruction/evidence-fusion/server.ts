import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../../utils/processing-jobs';
import { readFusionRequest, readFusionResult, fusionRecord, fusionHash, type FusionRequest, type FusionResult } from './jobs-model';
import { validateFusionResult } from './presentation';
import { readGeometryPin } from '../geometry/registered-source';
async function worker(root:string,request:FusionRequest,signal:AbortSignal,progress:(message:string)=>void) {
  signal.throwIfAborted();
  const require=createRequire(resolve(root,'packages/engine/package.json'));
  const {build}=createRequire(require.resolve('tsup'))('esbuild');
  const outfile=resolve(root,'.local/nebula-lab/compiled/evidence-fusion-worker.mjs');
  await build({entryPoints:[resolve(root,'labs/nebula/src/reconstruction/evidence-fusion/worker.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external'});
  signal.throwIfAborted();
  return new Promise<FusionResult>((done,reject)=>{
    const child=spawn(process.execPath,[outfile],{cwd:root,stdio:['pipe','pipe','pipe']});
    let buffered='',errors='',completed:FusionResult|undefined;
    const abort=()=>child.kill('SIGKILL');signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    child.stdout.on('data',(bytes:Buffer)=>{
      buffered+=bytes.toString();const lines=buffered.split('\n');buffered=lines.pop()!;
      for(const line of lines) try { const v:unknown=JSON.parse(line);if(!fusionRecord(v))continue;
        if(v.type==='complete')completed=readFusionResult(v.result);if(v.type==='progress'&&typeof v.message==='string')progress(v.message);
      }catch{/* Missing valid completion is failure. */}
    });
    child.stderr.on('data',(bytes:Buffer)=>{errors=(errors+bytes.toString()).slice(-4096);});
    child.once('error',error=>{signal.removeEventListener('abort',abort);reject(error);});
    child.once('close',code=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(new DOMException('Evidence cancelled.','AbortError'));else if(code!==0||!completed)reject(new Error(errors||'Evidence worker produced no completion.'));else done(completed);});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));
  });
}
export function evidenceFusionPlugin(root:string):Plugin {
  return {name:'nebula-evidence-fusion',configureServer(server){
    let queue=Promise.resolve();
    const jobs=createStarRemovalJobs<FusionRequest>(root,{namespace:'evidence-fusion',label:'Combined evidence',parseRequest:readFusionRequest,
      history:{maxRecords:128,retainPerImage:4,preferred:()=>true},
      sample(request,signal,progress){const task=queue.then(()=>worker(root,request,signal,message=>progress({stage:'fusion',message,current:1,total:1})));queue=task.then(()=>{},()=>{});return task;},
      validateResult:async value=>{await validateFusionResult(root,value);} });
    const handler=starRemovalJobsHandler(jobs,'/__nebula/evidence-jobs');
    server.middlewares.use('/__nebula/evidence-jobs',(request,response)=>{void handler(request,response);});
    server.middlewares.use('/__nebula/evidence-sample',(request,response)=>{void(async()=>{
      response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
      try{
        if(request.method!=='GET')throw new TypeError('Use GET for prepared samples.');
        const url=new URL(request.url??'', 'http://localhost'),id=url.searchParams.get('id'),x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y'));
        if(!fusionHash(id)||!Number.isInteger(x)||!Number.isInteger(y))throw new TypeError('Invalid sample coordinate.');
        const result=readFusionResult(JSON.parse(await readFile(resolve(root,`.local/nebula-lab/evidence-fusion/results/${id}/result.json`),'utf8')));
        if(x<0||y<0||x>=result.width||y>=result.height)throw new TypeError('Sample is outside the field.');
        const bytes=await readGeometryPin(root,result.samples),stride=result.sources.length*2+2;
        if(bytes.length!==result.width*result.height*stride)throw new TypeError('Sample grid changed.');
        const offset=(y*result.width+x)*stride;
        response.end(JSON.stringify({x,y,sources:result.sources.map((s,i)=>({id:s.id,value:bytes[offset+i*2]?bytes[offset+i*2+1]!/255:null}))}));
      }catch(error){response.statusCode=400;response.end(JSON.stringify({error:error instanceof Error?error.message:'Sample unavailable.'}));}
    })();});
    server.httpServer?.once('close',()=>{void jobs.shutdown();});
  }};
}
