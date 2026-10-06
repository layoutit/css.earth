/** `telescope new-object`: the object generator and the bake it hands its objects to, run as the workspace's own process.
 * The telescope parses and checks the command line, then runs this with the parsed options as one JSON argument; the result
 * text and exit code, or the failure, go back over the IPC channel, and everything printed here is the telescope's stderr. */
import { projectRoot as checkoutProjectRoot, answerParent } from '@cssearth/core/node';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { prepareObjects } from '@cssearth/bake/prepare-object';
import { liveArchive } from './archives/archives.mts';
import { writeDrafts } from './drafts.mts';
import { formatNewObject, runNewObject } from './generate.mts';
import { refreshSpec } from './refresh.mts';
import { loadSolarEpoch } from './solar-epoch.mts';

export interface NewObjectOptions {readonly spec?:string;readonly ids?:readonly string[];readonly from?:string;readonly names?:readonly string[];readonly out?:string;readonly check:boolean;readonly bake:boolean;readonly refresh:boolean;readonly skipExisting:boolean;readonly json:boolean}

/** The options the telescope parsed, read back from its JSON argument. */
export function parseNewObjectOptions(value:unknown):NewObjectOptions{
  const record=requireRecord(value,'new-object options'),flag=(name:string)=>{const found=record[name];if(typeof found!=='boolean')throw new TypeError(`new-object option ${name} must be a boolean.`);return found;};
  const strings=(name:string)=>record[name]===undefined?{}:{[name]:requireArray(record[name],`new-object ${name}`).map(entry=>requireString(entry,`new-object ${name}`))};
  const string=(name:string)=>record[name]===undefined?{}:{[name]:requireString(record[name],`new-object ${name}`)};
  return {...string('spec'),...strings('ids'),...string('from'),...strings('names'),...string('out'),check:flag('check'),bake:flag('bake'),refresh:flag('refresh'),skipExisting:flag('skipExisting'),json:flag('json')};
}

const holds=async(spec:string,key:'pictures'|'coronae'|'magneticMaps')=>{const {readFile}=await import('node:fs/promises'),value:unknown=JSON.parse(await readFile(spec,'utf8'));return typeof value==='object'&&value!==null&&key in value;};

/** The result text and exit code for one parsed `new-object` command. */
export async function newObjectCommand(options:NewObjectOptions,root:string,stderr:(text:string)=>void):Promise<{readonly text:string;readonly code:number}>{
  let text:string,code:number;
  const progress=(line:string)=>stderr(`${line}\n`);
  if(options.ids&&options.refresh){
    const {mkdir,writeFile}=await import('node:fs/promises'),path=resolve(root,'output/new-object/refresh.json');
    await mkdir(resolve(root,'output/new-object'),{recursive:true});await writeFile(path,`${JSON.stringify(await refreshSpec(root,options.ids),null,2)}\n`);
    const results=await runNewObject(path,{root,progress,refresh:true,solarEpoch:await loadSolarEpoch(root)}),good=results.filter(result=>!result.failed).map(result=>result.id);
    const baked=(options.check||options.bake)&&good.length?await prepareObjects(good,{root,progress,...(options.bake?{}:{to:'page'})}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatNewObject(results);code=baked&&!results.some(result=>result.failed)?0:1;
  }else if(options.ids){
    const baked=await prepareObjects(options.ids,{root,progress});
    text=options.json?`${JSON.stringify({baked:baked?options.ids:[]})}\n`:baked?`${options.ids.length} object(s) baked.\n`:'';code=baked?0:1;
  }else if(options.from){
    const result=await writeDrafts(options.from,options.names??[],options.out!,{root,archive:liveArchive,progress:line=>stderr(`${line}\n`)});
    text=options.json?`${JSON.stringify(result)}\n`:`${result.report.join('\n')}\n${result.entries} entries written to ${result.path}\n`;code=result.entries?0:3;
  }else if(await holds(options.spec!,'coronae')){
    // A spec of coronae: each one a volume bank derived from the magnetic maps a star's page shows (corona/corona.mts).
    const {runCoronae,bakeCoronae,formatCoronae}=await import('./corona/corona.mts'),results=await runCoronae(options.spec!,{root,archive:liveArchive,progress}),good=results.filter(result=>!result.failed);
    const baked=options.bake&&good.length?await bakeCoronae(good,{root,progress}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatCoronae(results,options.spec!,baked&&options.bake&&good.length>0);code=baked&&good.length===results.length?0:1;
  }else if(await holds(options.spec!,'magneticMaps')){
    // A spec of magnetic maps this repository reduced from archived spectra: each one a dataset of its star's page (magnetic/maps.mts).
    const {runMagneticMaps,bakeMagneticMaps,formatMagneticMaps}=await import('./magnetic/maps.mts'),results=await runMagneticMaps(options.spec!,{root,progress}),good=results.filter(result=>!result.failed);
    const baked=options.bake&&good.length?await bakeMagneticMaps(good,{root,progress}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatMagneticMaps(results,options.spec!,baked&&options.bake&&good.length>0);code=baked&&good.length===results.length?0:1;
  }else if(await holds(options.spec!,'pictures')){
    // A spec of published pictures: each one a dataset on a page that shows a shaped layer bank (pictures/pictures.mts).
    const {runPictures,bakePictures,formatPictures}=await import('./pictures/pictures.mts'),results=await runPictures(options.spec!,{root,archive:liveArchive,progress}),good=results.filter(result=>!result.failed);
    const baked=options.bake&&good.length?await bakePictures(good,{root,progress}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatPictures(results,options.spec!,baked&&options.bake&&good.length>0);code=baked&&good.length===results.length?0:1;
  }else{
    const results=await runNewObject(options.spec!,{root,progress:line=>stderr(`${line}\n`),skipExisting:options.skipExisting,solarEpoch:await loadSolarEpoch(root)});
    const good=results.filter(result=>!result.failed).map(result=>result.id),baked=(options.check||options.bake)&&good.length?await prepareObjects(good,{root,progress,...(options.bake?{}:{to:'page'})}):true;
    text=options.json?`${JSON.stringify(results)}\n`:formatNewObject(results)+(results.length&&baked&&options.bake?`${results.length} objects baked.\n`:results.length&&baked&&options.check?`${results.length} objects passed the bake's first steps.\n`:'');code=baked&&!results.some(result=>result.failed)?0:1;
  }
  return {text,code};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await answerParent(()=>newObjectCommand(parseNewObjectOptions(JSON.parse(process.argv[2]??'null')),checkoutProjectRoot(import.meta.url),line=>{process.stderr.write(line);}));
}
