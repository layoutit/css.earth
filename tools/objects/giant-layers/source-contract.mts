import { readAuthoredSources } from '../authored-sources.ts';
import {parse,object,array,string} from '../material-composition/data-schema.mts';
import assert from 'node:assert/strict';
import{readFile,readdir}from'node:fs/promises';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import{parseAuthoredObjectDescriptor}from'@cssearth/objects';
import{verifySourceManifest,validateSourceManifest}from'../../../src/platform/source-manifest.mts';

export async function assertAuthoredGiantSourceContract(id: string){
 const directory=resolve('src/objects',id),sourceRoot=resolve(directory,'source'),manifest=validateSourceManifest(id,JSON.parse(await readFile(resolve(sourceRoot,'manifest.json'),'utf8')));
 await verifySourceManifest({manifest,objectName:id,sourceRoot});
 const descriptor=parseAuthoredObjectDescriptor(JSON.parse(await readFile(resolve(directory,'object.json'),'utf8')));
 // The reader parses object.json itself; it takes the file's value, not a parsed descriptor.
 await readAuthoredSources(directory);
 async function inspect(path: string):Promise<void>{for(const entry of await readdir(path,{withFileTypes:true})){if(entry.isDirectory())await inspect(resolve(path,entry.name));else assert.doesNotMatch(entry.name,/\.(?:[cm]?js|tsx?|astro|css|sh)$/u,`Object owns no executable preparation/runtime/shell: ${path}/${entry.name}`);}}
 await inspect(directory);
 // Only a download names a source path; a verify-request carries a URL and an expected path instead.
 const acquisition=parse(JSON.parse(await readFile(resolve(sourceRoot,'preparation/acquisition.json'),'utf8')),object({operations:array(object({kind:string}))}),'acquisition recipe');
 const downloads=acquisition.operations.filter(operation=>operation.kind==='download').map(operation=>parse(operation,object({kind:string,path:string}),'download operation'));
 const downloadable=manifest.inputs.filter(input=>/\.(?:png|jpg|jpeg|tif|tiff|fits)$/u.test(input.path));
 for(const input of downloadable)assert.ok(downloads.some(operation=>operation.path===input.path),`Missing ignored source restoration: ${input.path}`);
 return descriptor;
}
