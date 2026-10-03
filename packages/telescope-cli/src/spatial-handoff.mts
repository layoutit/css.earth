/** Export the existing physical point/volume package. This does not infer depth from a spectral cube. */
import { readFile,writeFile,mkdir,mkdtemp,rm,rmdir,rename,realpath } from 'node:fs/promises';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { requireRecord,requireString } from '@cssearth/core';
import { VERSION } from './help.mts';
import { writeProductRecord, WORKSPACE } from '@cssearth/telescope/node';
import type { PreparedCssPointField, PreparedCssVolume, PreparedVolumeDatasets } from '@cssearth/objects';
import type { ProductInput } from '@cssearth/telescope';

export type SpatialKind='points'|'volume'|'volume-dataset-bank';
type SpatialPayload =
  | {kind:'points';payload:PreparedCssPointField}
  | {kind:'volume';payload:PreparedCssVolume}
  | {kind:'volume-dataset-bank';payload:PreparedVolumeDatasets};
const workspaceRoot=WORKSPACE;

async function validateSpatialObject(objectPath:string,expected:SpatialKind|undefined){
  const source=resolve(objectPath),root=dirname(source),bytes=await readFile(source),descriptor=requireRecord(JSON.parse(bytes.toString()));
  if(descriptor.schema!=='cssearth-object@2'||!['point-field','density-volume','volume-dataset-bank'].includes(String(descriptor.type)))throw new Error('Physical handoff requires an existing point-field, density-volume or volume-dataset-bank object.json; a spectral cube does not establish depth');
  const kind:SpatialKind=descriptor.type==='point-field'?'points':descriptor.type==='density-volume'?'volume':'volume-dataset-bank';
  if(expected&&expected!==kind)throw new Error(`${expected} requires a matching prepared physical object package; a spectral cube does not establish depth`);
  const prepared=requireRecord(descriptor.prepared),properties=requireRecord(descriptor.properties),preparation=requireRecord(properties.preparation);
  const checked=new Map<string,{bytes:Buffer;pin:ProductInput}>();
  const rootReal=await realpath(root);
  async function read(path:string){
    const file=resolve(root,path),lexical=relative(root,file);
    if(lexical==='..'||lexical.startsWith('../'))throw new Error('Spatial resource escapes its object package');
    const rel=relative(rootReal,await realpath(file));
    if(isAbsolute(path)||rel==='..'||rel.startsWith('../')||!rel)throw new Error('Spatial resource escapes its object package');
    const bytes=await readFile(file);checked.set(path,{bytes,pin:{role:'physical object input',identity:file,bytes:bytes.length}});return bytes;
  }
  const recipePath=requireString(preparation.source),recipeBytes=await read(recipePath);
  const recipe=requireRecord(JSON.parse(recipeBytes.toString()));
  // Retain the original recipe, credits and licence. Large source datasets are not part of this render handoff.
  for(const key of ['provenance','license'])if(recipe[key]){
    const pin=requireRecord(recipe[key]),path=relative(root,resolve(root,dirname(recipePath),requireString(pin.path)));
    await read(path);
  }
  if(kind==='volume-dataset-bank')for(const path of ['README.md','source/manifest.json','prepared/presentation.json','LICENSE.md','NOTICE.md']){
    try{await read(path);}catch(error){if(!(error instanceof Error&&'code'in error&&(error as NodeJS.ErrnoException).code==='ENOENT'))throw error;}
  }
  const entry=new URL(kind==='points'?'../../../packages/renderer/src/stars/loader.ts':kind==='volume'?'../../../packages/renderer/src/volume/loader.ts':'../../../packages/renderer/src/volume/prepared-volume-datasets.ts',import.meta.url);
  // Use the application's exact loader, including physical-frame and binary-bank validation.
  const compiled=await build({entryPoints:[entry.pathname],bundle:true,write:false,platform:'node',format:'esm',packages:'external',metafile:true});
  await mkdir(resolve(workspaceRoot,'work'),{recursive:true});const scratch=await mkdtemp(resolve(workspaceRoot,'work/telescope-spatial-loader-'));
  const moduleFile=resolve(scratch,'loader.mjs');await writeFile(moduleFile,compiled.outputFiles[0].text);
  try{
    const loader: {loadPreparedCssPointField?:(input: unknown, transport: {read(path: string): Promise<ArrayBuffer>}) => Promise<PreparedCssPointField>;loadPreparedCssVolume?:(input: unknown, transport: {read(path: string): Promise<ArrayBuffer>}) => Promise<PreparedCssVolume>;loadPreparedVolumeDatasets?:(input: unknown, transport: {read(path: string): Promise<ArrayBuffer>}) => Promise<PreparedVolumeDatasets>}=await import(`${pathToFileURL(moduleFile).href}?${randomUUID()}`);
    const transport={read:async(path:string)=>Uint8Array.from(await read(path)).buffer};
    const value:SpatialPayload=kind==='points'?{kind,payload:await loader.loadPreparedCssPointField!(descriptor,transport)}
      :kind==='volume'?{kind,payload:await loader.loadPreparedCssVolume!(descriptor,transport)}
      :{kind,payload:await loader.loadPreparedVolumeDatasets!(descriptor,transport)};
    const manifestPath=requireString(prepared.url);
    const resources=value.kind==='volume-dataset-bank'?value.payload.datasets.flatMap(dataset=>dataset.volume.resources):value.payload.resources;
    for(const resource of resources){const path=relative(root,resolve(root,dirname(manifestPath),resource.path)),content=await read(path);if(content.length!==resource.bytes)throw new Error(`Spatial resource ${resource.path} is ${content.length} bytes; ${manifestPath} lists ${resource.bytes}.`);}
    // A point field publishes its baked provenance beside its manifest (prepared/stars-provenance.json); the others carry it.
    const provenance:unknown=value.kind==='points'?requireRecord(JSON.parse((await read(relative(root,resolve(root,dirname(manifestPath),'stars-provenance.json')))).toString())).provenance:value.payload.provenance;
    return {source,root,bytes,descriptor,checked,compiled,provenance,...value};
  }finally{await rm(scratch,{recursive:true,force:true});}
}

export async function inspectSpatialObject(objectPath:string){
  const value=await validateSpatialObject(objectPath,undefined);
  if(value.kind==='volume-dataset-bank')return {kind:value.kind,target:value.descriptor.id,
    frame:requireRecord(requireRecord(value.descriptor.properties).frame,'physical frame'),provenance:value.provenance,inputs:value.checked.size+1,
    attachedTo:value.payload.attachedTo??null,defaultDataset:value.payload.defaultDataset,datasets:value.payload.datasets.map(dataset=>dataset.id)};
  return {kind:value.kind,target:value.descriptor.id,frame:value.payload.frame,provenance:value.provenance,inputs:value.checked.size+1};
}

export async function exportSpatialObject(objectPath:string,kind:SpatialKind,outputDirectory:string){
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const value=await validateSpatialObject(objectPath,kind);
    const {source,bytes,descriptor,checked,provenance}=value;
    const outputs=[{path:'object.json',file:resolve(staging,'object.json')}];await writeFile(outputs[0].file,bytes);
    for(const [path,item] of checked){const file=resolve(staging,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,item.bytes);outputs.push({path,file});}
    for(const item of checked.values())if((await readFile(item.pin.identity)).length!==item.pin.bytes)throw new Error('Spatial source changed during export');
    if(!(await readFile(source)).equals(bytes))throw new Error(`Spatial descriptor ${source} changed during export`);
    const frame=value.kind==='volume-dataset-bank'?requireRecord(requireRecord(descriptor.properties).frame,'physical frame'):value.payload.frame;
    await writeProductRecord(resolve(staging,'output.product.json'),{telescope:'css.earth physical source package',stage:'telescope-spatial-handoff',inputs:[{role:'physical descriptor',identity:source,bytes:bytes.length},...Array.from(checked.values(),item=>item.pin)],parameters:{kind,target:descriptor.id,frame,provenance,...(value.kind==='volume-dataset-bank'?{attachedTo:value.payload.attachedTo??null,defaultDataset:value.payload.defaultDataset,datasets:value.payload.datasets.map(dataset=>dataset.id)}:{}),interpretation:'Existing prepared physical object; no new depth inference, reconstruction or qualification of an observation.',scope:'Portable renderer resources, source recipe and credits; raw source datasets are referenced, not bundled.'},software:[{name:'css.earth existing physical object loader',version:VERSION}]},outputs);
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,object:resolve(destination,'object.json'),receipt:resolve(destination,'output.product.json'),kind};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
