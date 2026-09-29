/** `telescope new-object`: the object generator and the bake it hands its objects to, run in the telescope's own process.
 * The telescope parses and checks the command line and calls `newObjectCommand` with the parsed options; the result text and
 * exit code come back to it, a failure is raised to it, and everything printed here is its stderr. */
import { resolve } from 'node:path';
import { prepareObjects } from '@cssearth/bake/prepare-object';
import { liveArchive } from './archives.mts';
import { writeDrafts } from './drafts.mts';
import { formatNewObject, runNewObject } from './generate.mts';
import { refreshSpec } from './refresh.mts';
import { loadSolarEpoch } from './solar-epoch.mts';

export interface NewObjectOptions {readonly spec?:string;readonly ids?:readonly string[];readonly from?:string;readonly names?:readonly string[];readonly out?:string;readonly check:boolean;readonly bake:boolean;readonly refresh:boolean;readonly skipExisting:boolean;readonly json:boolean}

/** The result text and exit code for one parsed `new-object` command. */
export async function newObjectCommand(options:NewObjectOptions,root:string,stderr:(text:string)=>void):Promise<{readonly text:string;readonly code:number}>{
  let text:string,code:number;
  const progress=(line:string)=>stderr(`${line}\n`);
  if(options.ids&&options.refresh){
    const {mkdir,writeFile}=await import('node:fs/promises'),path=resolve(root,'output/new-object/refresh.json');
    await mkdir(resolve(root,'output/new-object'),{recursive:true});await writeFile(path,`${JSON.stringify(await refreshSpec(root,options.ids),null,2)}\n`);
    const results=await runNewObject(path,{root,progress,refresh:true,solarEpoch:await loadSolarEpoch(root)}),good=results.filter(result=>!result.failed).map(result=>result.id);
    const baked=(options.check||options.bake)&&good.length?await prepareObjects(good,{progress,...(options.bake?{}:{to:'page'})}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatNewObject(results);code=baked&&!results.some(result=>result.failed)?0:1;
  }else if(options.ids){
    const baked=await prepareObjects(options.ids,{progress});
    text=options.json?`${JSON.stringify({baked:baked?options.ids:[]})}\n`:baked?`${options.ids.length} object(s) baked.\n`:'';code=baked?0:1;
  }else if(options.from){
    const result=await writeDrafts(options.from,options.names??[],options.out!,{root,archive:liveArchive,progress:line=>stderr(`${line}\n`)});
    text=options.json?`${JSON.stringify(result)}\n`:`${result.report.join('\n')}\n${result.entries} entries written to ${result.path}\n`;code=result.entries?0:3;
  }else{
    const results=await runNewObject(options.spec!,{root,progress:line=>stderr(`${line}\n`),skipExisting:options.skipExisting,solarEpoch:await loadSolarEpoch(root)});
    const good=results.filter(result=>!result.failed).map(result=>result.id),baked=(options.check||options.bake)&&good.length?await prepareObjects(good,{progress,...(options.bake?{}:{to:'page'})}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatNewObject(results)+(results.length&&baked&&options.bake?`${results.length} objects baked.\n`:results.length&&baked&&options.check?`${results.length} objects passed the bake's first steps.\n`:'');code=baked&&!results.some(result=>result.failed)?0:1;
  }
  return {text,code};
}
