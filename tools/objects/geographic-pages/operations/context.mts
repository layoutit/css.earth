import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

import type { Decoder } from '../source-records.mts';
export type OperationContext = ReturnType<typeof createOperationContext>;
export const projectDirectory=resolve(import.meta.dirname,'../../../..');
export function operationArguments(args=process.argv.slice(2)) {
  const selections=args.filter(arg=>arg.startsWith('--object='));
  if(selections.length!==1||!/^--object=[a-z][a-z0-9-]*$/.test(selections[0]))throw new TypeError('Select one geographic object with --object=<id>.');
  return {objectId:selections[0].slice('--object='.length),args:args.filter(arg=>arg!==selections[0])};
}

/** Operational paths are selected explicitly; all scientific scene state remains prepared JSON. */
export function createOperationContext({objectId,projectRoot=projectDirectory}: { objectId?: string; projectRoot?: string }={}) {
  if(typeof objectId!=='string'||! /^[a-z][a-z0-9-]*$/.test(objectId))throw new TypeError('A geographic object id is required.');
  const root=resolve(projectRoot),objectRoot=resolve(root,'src/planets',objectId),sourceRoot=resolve(objectRoot,'source'),preparedRoot=resolve(objectRoot,'prepared');
  const contained=(base: string,path: string)=>{if(typeof path!=='string'||path.includes('\\')||isAbsolute(path)||path.split('/').includes('..'))throw new TypeError('Invalid operation-relative path.');return resolve(base,path);};
  const url=(base: string,path: string)=>pathToFileURL(contained(base,path)+(!path||path.endsWith('/')?'/':''));
  async function readPrepared(name: string): Promise<unknown>;
  async function readPrepared<T>(name: string, decode: Decoder<T>): Promise<T>;
  async function readPrepared(name: string, decode?: Decoder<unknown>): Promise<unknown> { const value: unknown = JSON.parse(await readFile(contained(preparedRoot,name+'.json'),'utf8')); return decode ? decode(value) : value; }
  async function readSource(path: string): Promise<unknown>;
  async function readSource<T>(path: string, decode: Decoder<T>): Promise<T>;
  async function readSource(path: string, decode?: Decoder<unknown>): Promise<unknown> { const value: unknown = JSON.parse(await readFile(contained(sourceRoot,path),'utf8')); return decode ? decode(value) : value; }
  return Object.freeze({objectId,projectRoot:root,objectRoot,sourceRoot,preparedRoot,assetPath:`/scenes/${objectId}/`,
    projectUrl:(path: string)=>url(root,path),objectUrl:(path: string)=>url(objectRoot,path),sourceUrl:(path: string)=>url(sourceRoot,path),preparedUrl:(path: string)=>url(preparedRoot,path),
    projectPath:(path: string)=>contained(root,path),sourcePath:(path: string)=>contained(sourceRoot,path),preparedPath:(path: string)=>contained(preparedRoot,path),
    readPrepared,
    readSource,
    async writePrepared(name: string,value: unknown){const path=contained(preparedRoot,name+'.json'),temporary=path+`.partial-${process.pid}-${randomUUID()}`;await mkdir(dirname(path),{recursive:true});try{await writeFile(temporary,JSON.stringify(value)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}},
    relativeProject:(path: string)=>relative(root,path).replaceAll('\\','/'),
  });
}

export function commandContext(args=process.argv.slice(2)) {const parsed=operationArguments(args);return {...createOperationContext(parsed),args:parsed.args};}
