import {parse,object,array,string} from '../material-composition/data-schema.mts';
import assert from 'node:assert/strict';
import{readFile,readdir}from'node:fs/promises';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import{parseAuthoredObjectDescriptor}from'@cssearth/objects';
import{verifySourceManifest,validateSourceManifest}from'../../../src/platform/source-manifest.mts';

export async function assertAuthoredGiantSourceContract(id: string){
 const directory=resolve('src/planets',id),sourceRoot=resolve(directory,'source'),manifest=validateSourceManifest(id,JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')));
 await verifySourceManifest({manifest,planetName:id,sourceRoot});
 const descriptor=parseAuthoredObjectDescriptor(JSON.parse(await readFile(resolve(directory,'object.json'),'utf8')));
 for(const source of descriptor.recipe.sources){const bytes=await readFile(resolve(directory,source.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256,source.path);}
 async function inspect(path: string):Promise<void>{for(const entry of await readdir(path,{withFileTypes:true})){if(entry.isDirectory())await inspect(resolve(path,entry.name));else assert.doesNotMatch(entry.name,/\.(?:[cm]?js|tsx?|astro|css|sh)$/u,`Object owns no executable preparation/runtime/shell: ${path}/${entry.name}`);}}
 await inspect(directory);
 const acquisition=parse(JSON.parse(await readFile(resolve(sourceRoot,'preparation/acquisition.json'),'utf8')),object({operations:array(object({kind:string,path:string}))}),'acquisition recipe');
 const downloadable=manifest.inputs.filter(input=>/\.(?:png|jpg|jpeg|tif|tiff|fits)$/u.test(input.path));
 for(const input of downloadable)assert.ok(acquisition.operations.some(operation=>operation.kind==='download'&&operation.path===input.path),`Missing ignored source restoration: ${input.path}`);
 return descriptor;
}
