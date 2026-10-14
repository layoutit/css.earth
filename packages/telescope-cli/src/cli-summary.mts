/** Stdout summaries are disposable views; saved evidence keeps its original schema. */
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { prepareRunDirectory, inspectionDirectory } from './run-directory.mts';
import { archiveLabel } from './cli-archive.mts';
import type { ExplorationSession } from './session.mts';
import type { InspectedArtifact } from './cli-artifact-types.mts';

export const oneLine = (value:string):string => value.replace(/[\p{Cc}\p{Cf}]+/gu,' ').replace(/\s+/gu,' ').trim();
export function archiveCounts(session:ExplorationSession,human=false):Record<string,number> {
  const counts:Record<string,number>={};
  for(const choice of session.choices){const archive=human?archiveLabel(choice):choice.archiveService??choice.telescope;counts[archive]=(counts[archive]??0)+1;}
  return counts;
}
export function explorationSummary(session:ExplorationSession&{readonly directory:string}) {
  return {schema:'cssearth-telescope-explore-summary@1',outcome:session.answer.outcome,target:session.target,
    targetResolution:session.answer.targetResolution,counts:{observations:session.choices.length,archives:archiveCounts(session),
      unsupported:session.answer.unsupported.length,unresolved:session.answer.unresolved.length,notes:session.answer.issues.length},
    savedPath:resolve(session.directory,'explore.json'),choices:session.choices.map(choice=>({pick:choice.pick,archive:choice.archiveService??choice.telescope,
      telescope:choice.telescope,instrument:choice.display.instrument,mode:choice.mode,kind:choice.display.productKind,date:choice.display.observationTime.startIso?.slice(0,10)??null,
      wavelengthsMicrometres:choice.display.wavelengthsMicrometres,state:choice.state,...(choice.state==='ready'?{}:{reason:oneLine(choice.reason)})}))};
}
export function outputSummary(result:InspectedArtifact,savedPath:string) {
  return {schema:'cssearth-telescope-outputs-summary@1',artifact:result.artifact,target:result.target,source:result.source,savedPath,
    terminal:result.terminal??false,issues:result.issues?.length??0,
    outputs:result.outputs.map(({kind,hdu,structure,available,reason,parameters,shape})=>({kind,hdu,structure,available,reason:oneLine(reason),parameters,shape})),
    familyOperations:result.familyOperations?.map(({id,componentId,available,reason,parameters})=>({id,componentId,available,reason:oneLine(reason),parameters}))??[]};
}
export async function saveStdoutRecord(command:string,result:unknown,outDirectory?:string):Promise<string> {
  const directory=await prepareRunDirectory(command,outDirectory),path=resolve(directory,`${command}.json`);
  await mkdir(directory,{recursive:true});
  await writeFile(path,`${JSON.stringify(result,null,2)}\n`,{flag:'wx'});return path;
}
export async function saveInspection(result:unknown,artifact:string,explicit?:string):Promise<string> {
  const directory=await inspectionDirectory(artifact,explicit),path=resolve(directory,'outputs.json'),temporary=`${path}.${randomUUID()}.partial`;
  try { await writeFile(temporary,`${JSON.stringify(result,null,2)}\n`,{flag:'wx'}); await rename(temporary,path); }
  finally { await rm(temporary,{force:true}); }
  return path;
}
/** Only persisted results get a bounded preview; unsaved lookups print their full JSON. */
export async function lookupJson(command:string,result:unknown,output?:{readonly savedPath:string}):Promise<string> {
  const full=JSON.stringify(result);
  if(output===undefined||full.length<=8000)return `${full}\n`;
  const savedPath=resolve(output.savedPath),summary:Record<string,unknown>={schema:`cssearth-telescope-${command}-summary@1`,savedPath};
  if(result&&typeof result==='object'&&!Array.isArray(result))for(const [key,value] of Object.entries(result)){
    if(Array.isArray(value)){summary[`${key}Count`]=value.length;summary[key]=value.slice(0,10).map(item=>{
      if(!item||typeof item!=='object'||Array.isArray(item))return item;
      return Object.fromEntries(Object.entries(item).filter(([field,entry])=>['id','rank','name','title','year','doi','pick','state','status','target','license','url'].includes(field)&&(!entry||typeof entry!=='object')));
    });}else if(value===null||typeof value!=='object')summary[key]=value;
  }else if(Array.isArray(result))summary.count=result.length;
  // The compact schema belongs to this view, never the underlying record.
  summary.schema=`cssearth-telescope-${command}-summary@1`;
  return `${JSON.stringify(summary)}\n`;
}
