import { runProcessingWorker } from '@cssearth/nebula-lab/server/worker';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { readFusionRequest, readFusionResult, fusionRecord, fusionHash, type FusionRequest, type FusionResult } from '../../features/evidence-fusion/jobs-model.ts';
import { validateFusionResult } from '../workflows/evidence-fusion/presentation.ts';
import { readGeometryPin } from '../workflows/geometry/registered-source.ts';
async function worker(root: string, request: FusionRequest, signal: AbortSignal, progress: (message: string) => void) {
  return runProcessingWorker({ root, request, signal, name: 'evidence-fusion',
    entry: 'labs/nebula/packages/lab/src/server/workers/evidence-fusion.ts',
    readResult: readFusionResult,
    onProgress(event) { if (typeof event.message === 'string') progress(event.message); },
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
