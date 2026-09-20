#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
/** Repeatable local-observation survey through the public saved-query/delivery API. No claim of fresh archive discovery. */
import { readFile, writeFile, mkdir, access, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '../../source-values.mts';
import { loadSourceProducts, type LoadedSourceProduct } from './source-products.mts';
import { loadQualifiedObservations } from './qualified-observations.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { saveSession, getSession, type SessionServices } from './session.mts';
import { requestFromArguments, type QueryInputs } from './query.mts';
import { assessRequest } from './request-satisfaction.mts';
export function shuffled<T>(items:readonly T[],seed:string):T[]{
  let state=createHash('sha256').update(seed).digest().readUInt32LE();const result=[...items];
  for(let i=result.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=Math.floor(state/4294967296*(i+1));[result[i],result[j]]=[result[j]!,result[i]!];}
  return result;
}
/** Uniform body sampling from the recorded, locally available numeric-product pool. No success filter. */
export async function localTargetPool(root:string,maxBytes=256_000_000):Promise<string[]>{
 const pool:string[]=[];
 for(const target of (await readdir(resolve(root,'src/objects'))).sort()){
  const dir=resolve(root,'src/objects',target,'source');
  const manifest=await readFile(resolve(dir,'manifest.json'),'utf8').then(t=>requireRecord(JSON.parse(t)),()=>undefined);if(!manifest)continue;
  const entries=[...Array.isArray(manifest.inputs)?manifest.inputs:[],...Array.isArray(manifest.generatedIntermediates)?manifest.generatedIntermediates:[]];
  for(const raw of entries){const entry=requireRecord(raw),path=requireString(entry.path);
   if(!/\.(fits?|img|cub|qub)$/iu.test(path)||path.split('/').includes('..'))continue;
   const info=await stat(resolve(dir,path)).catch(()=>undefined);
   if(info?.isFile()&&info.size>0&&info.size<=maxBytes){pool.push(target);break;}
  }
 }
 return pool;
}
export async function surveyDeliveries(root:string,targets:readonly string[],output:string,maxBytes=256_000_000,seed=randomBytes(16).toString('hex'),targetPool:readonly string[]=targets,requestedCount=targets.length){
  await mkdir(output,{recursive:true});const results:Record<string,unknown>[]=[];
  for(const target of targets){
    if(!/^[a-z0-9][a-z0-9-]*$/u.test(target))throw new Error('Invalid survey target');
    let selected:LoadedSourceProduct|undefined,requestArgs:string[]|undefined;
    try{
      const descriptor=requireRecord(JSON.parse(await readFile(resolve(root,'src/objects',target,'object.json'),'utf8'))),catalog=requireRecord(requireRecord(descriptor.properties).catalog);
      const catalogue=[{id:requireString(descriptor.id),name:requireString(catalog.name),aliases:[]}];
      const sources=await loadSourceProducts(root,target);
      for(const source of shuffled(sources.filter(s=>s.kind==='cube'||s.kind==='image').sort((a,b)=>a.id.localeCompare(b.id)),`${seed}:${target}`)){
        if(source.files.reduce((s,f)=>s+f.bytes,0)>maxBytes)continue;
        if((await Promise.all(source.files.map(f=>access(resolve(root,f.path)).then(()=>true,()=>false)))).every(Boolean)){selected=source;break;}
      }
      if(!selected){results.push({target,state:'blocked',reason:'No locally available supported source product within the explicit size budget.',discoveredSources:sources.length});continue;}
      const product=selected;
      const load=async():Promise<QueryInputs>=>({ledgers:[],capabilities:[],targetAssociations:[],bodyMaps:[],targetCatalogue:catalogue,sourceProducts:await loadSourceProducts(root,target),qualifiedProducts:await loadQualifiedObservations(root,target)});
      const api:SessionServices={load,qualify:async(_root,request)=>{
        if(request.configuration.kind!=='source-product'||request.configuration.id!==product.id)throw new Error('Survey selected another route');
        const {qualified,receipt,receiptProblem,facts,...source}=product;return qualifySourceProduct(root,source);
      }};
      const band=product.wavelengthIntervalsMicrometres?.[0]??(product.centralWavelengthMicrometres?[product.centralWavelengthMicrometres*.99,product.centralWavelengthMicrometres*1.01]:product.kind==='cube'?[1,5]:[.4,.9]);
      const dir=resolve(output,target),args=['--target',target,'--wavelength',band.join(','),'--kind',product.kind,'--any-time','--min-arcsec','1','--result','telescope-product'];
      requestArgs=args;
      const session=await saveSession(root,args,dir,api),choice=session.choices.find(c=>c.observation===product.id);
      if(!choice)throw new Error('Indexed source has no saved-query choice');
      const result=await getSession(root,dir,choice.pick,()=>{},api);
      if(result.context.kind!=='scientific-request')throw new Error('Saved scientific query returned an exploration context');
      const delivery=requireRecord(JSON.parse(await readFile(result.resultPath,'utf8'))),facts=requireRecord(delivery.facts);
      results.push({target,state:'delivered',product:product.id,decoder:product.decoder,result:result.resultPath,satisfaction:result.context.assessment,metadata:facts.nativeMetadata,calibrationDependencies:facts.calibrationDependencies});
    }catch(error){
      // A newly established contradiction is a scientific refusal, not a decoder crash.
      const product=selected&&requestArgs?(await loadSourceProducts(root,target).catch(()=>[])).find(p=>p.id===selected!.id):undefined;
      const satisfaction=product?.facts&&requestArgs?assessRequest(requestFromArguments(requestArgs),product.facts):undefined;
      results.push({target,state:satisfaction?.status==='refused'?'refused':'failed',product:selected?.id,error:String(error),...(satisfaction?{satisfaction}:{})});
    }
    finally{await writeFile(resolve(output,'survey.json'),JSON.stringify({seed,targetPool,targets,requestedCount,scope:'existing local observations; public query -> qualification -> saved delivery; no new archive discovery',maxInputBytes:maxBytes,results},null,2));process.stderr.write(`${target}: ${results.at(-1)?.state}\n`);}
  }
  return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [out,...args]=process.argv.slice(2);if(!out||!args.length)throw new Error('Usage: survey-delivery.mts OUTPUT_DIRECTORY --random COUNT [SEED] | TARGET ...');
  const seed=args[0]==='--random'?(args[2]??randomBytes(16).toString('hex')):randomBytes(16).toString('hex');
  const pool=args[0]==='--random'?await localTargetPool(process.cwd()):args;
  const count=args[0]==='--random'?Number(args[1]):pool.length;if(!Number.isSafeInteger(count)||count<1)throw new Error('Count must be a positive integer');
  const targets=args[0]==='--random'?shuffled(pool,seed).slice(0,count):args;
  process.stderr.write(`seed=${seed}; requested=${count}; available=${pool.length}; targets=${targets.join(',')}\n`);
  console.log(JSON.stringify((await surveyDeliveries(process.cwd(),targets,resolve(out),256_000_000,seed,pool,count)).map(r=>({target:r.target,state:r.state,error:r.error})),null,2));
}
