/** Export the existing physical point/volume package. This does not infer depth from a spectral cube. */
import { readFile,writeFile,mkdir,rm,rmdir,rename,realpath } from 'node:fs/promises';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { requireRecord,requireString } from '../../source-values.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { writeProductRecord,type ProductInput } from '../product-record.mts';

export async function exportSpatialObject(objectPath:string,kind:'points'|'volume',outputDirectory:string){
  const source=resolve(objectPath),root=dirname(source),bytes=await readFile(source),descriptor=requireRecord(JSON.parse(bytes.toString()));
  if(descriptor.schema!=='cssearth-object@1'||descriptor.type!==(kind==='points'?'point-field':'density-volume'))throw new Error(`${kind} requires an existing physical ${kind==='points'?'point-field':'density-volume'} object.json; a spectral cube does not establish depth`);
  const prepared=requireRecord(descriptor.prepared),properties=requireRecord(descriptor.properties),preparation=requireRecord(properties.preparation);
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;
  const checked=new Map<string,{bytes:Buffer;pin:ProductInput}>();
  const rootReal=await realpath(root);
  async function read(path:string){
    const file=resolve(root,path),lexical=relative(root,file);
    if(lexical==='..'||lexical.startsWith('../'))throw new Error('Spatial resource escapes its object package');
    const rel=relative(rootReal,await realpath(file));
    if(isAbsolute(path)||rel==='..'||rel.startsWith('../')||!rel)throw new Error('Spatial resource escapes its object package');
    const bytes=await readFile(file);checked.set(path,{bytes,pin:{role:'physical object input',identity:file,sha256:sha256(bytes),bytes:bytes.length}});return bytes;
  }
  const recipePath=requireString(preparation.source),recipeBytes=await read(recipePath);
  if(sha256(recipeBytes)!==requireString(preparation.sha256))throw new Error('Spatial preparation recipe pin mismatch');
  const recipe=requireRecord(JSON.parse(recipeBytes.toString()));
  // Retain the original recipe, credits and licence. Large source datasets are not part of this render handoff.
  for(const key of ['provenance','license'])if(recipe[key]){
    const pin=requireRecord(recipe[key]),path=relative(root,resolve(root,dirname(recipePath),requireString(pin.path)));
    if(sha256(await read(path))!==requireString(pin.sha256))throw new Error(`Spatial ${key} pin mismatch`);
  }
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    const entry=new URL(kind==='points'?'../../../src/renderers/css/stars/loader.ts':'../../../src/renderers/css/volume/loader.ts',import.meta.url);
    // Use the application's exact loader, including physical-frame and binary-bank validation.
    const compiled=await build({entryPoints:[entry.pathname],bundle:true,write:false,platform:'node',format:'esm',packages:'external',metafile:true});
    const moduleFile=resolve(staging,'loader.mjs');await writeFile(moduleFile,compiled.outputFiles[0].text);
    const loader: {loadPreparedCssPointField?:typeof import('../../../src/renderers/css/stars/loader.ts').loadPreparedCssPointField;loadPreparedCssVolume?:typeof import('../../../src/renderers/css/volume/loader.ts').loadPreparedCssVolume}=await import(pathToFileURL(moduleFile).href);
    const transport={read:async(path:string)=>Uint8Array.from(await read(path)).buffer};
    const payload=kind==='points'?await loader.loadPreparedCssPointField!(descriptor,transport):await loader.loadPreparedCssVolume!(descriptor,transport);
    const manifestPath=requireString(prepared.url);
    for(const resource of payload.resources){
      const path=relative(root,resolve(root,dirname(manifestPath),resource.path)),bytes=await read(path);
      if(bytes.length!==resource.bytes||sha256(bytes)!==resource.sha256)throw new Error(`Spatial resource pin mismatch: ${resource.path}`);
    }
    await rm(moduleFile);
    const outputs=[{path:'object.json',file:resolve(staging,'object.json')}];await writeFile(outputs[0].file,bytes);
    for(const [path,item] of checked){const file=resolve(staging,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,item.bytes);outputs.push({path,file});}
    for(const item of checked.values())if(sha256(await readFile(item.pin.identity))!==item.pin.sha256)throw new Error('Spatial source changed during export');
    if(sha256(await readFile(source))!==sha256(bytes))throw new Error('Spatial descriptor changed during export');
    const implementation=sha256(Buffer.concat([await readFile(new URL('spatial-handoff.mts',import.meta.url)),...await Promise.all(Object.keys(compiled.metafile.inputs).sort().map(file=>readFile(file)))]));
    await writeProductRecord(resolve(staging,'output.product.json'),{telescope:'css.earth physical source package',stage:'telescope-spatial-handoff',inputs:[{role:'physical descriptor',identity:source,sha256:sha256(bytes),bytes:bytes.length},...Array.from(checked.values(),item=>item.pin)],parameters:{kind,target:descriptor.id,frame:payload.frame,provenance:payload.provenance,interpretation:'Existing prepared physical object; no new depth inference, reconstruction or qualification of an observation.',scope:'Portable renderer resources, source recipe and credits; raw source datasets are referenced, not bundled.'},software:[{name:'css.earth existing physical object loader',version:implementation}]},outputs);
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,object:resolve(destination,'object.json'),receipt:resolve(destination,'output.product.json'),kind};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
