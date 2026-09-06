import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

export const projectDirectory=resolve(import.meta.dirname,'../../../..');
export function operationArguments(args=process.argv.slice(2)) {
  const selections=args.filter(arg=>arg.startsWith('--object='));
  if(selections.length!==1||!/^--object=[a-z][a-z0-9-]*$/.test(selections[0]))throw new TypeError('Select one geographic object with --object=<id>.');
  return {objectId:selections[0].slice('--object='.length),args:args.filter(arg=>arg!==selections[0])};
}

/** Operational paths are selected explicitly; all scientific scene state remains prepared JSON. */
export function createOperationContext({objectId,projectRoot=projectDirectory}={}) {
  if(typeof objectId!=='string'||! /^[a-z][a-z0-9-]*$/.test(objectId))throw new TypeError('A geographic object id is required.');
  const root=resolve(projectRoot),objectRoot=resolve(root,'src/planets',objectId),sourceRoot=resolve(objectRoot,'source'),preparedRoot=resolve(objectRoot,'prepared');
  const contained=(base,path)=>{if(typeof path!=='string'||path.includes('\\')||isAbsolute(path)||path.split('/').includes('..'))throw new TypeError('Invalid operation-relative path.');return resolve(base,path);};
  const url=(base,path)=>pathToFileURL(contained(base,path)+(!path||path.endsWith('/')?'/':''));
  return Object.freeze({objectId,projectRoot:root,objectRoot,sourceRoot,preparedRoot,assetPath:`/scenes/${objectId}/`,
    projectUrl:path=>url(root,path),objectUrl:path=>url(objectRoot,path),sourceUrl:path=>url(sourceRoot,path),preparedUrl:path=>url(preparedRoot,path),
    projectPath:path=>contained(root,path),sourcePath:path=>contained(sourceRoot,path),preparedPath:path=>contained(preparedRoot,path),
    readPrepared:async name=>JSON.parse(await readFile(contained(preparedRoot,name+'.json'),'utf8')),
    readSource:async path=>JSON.parse(await readFile(contained(sourceRoot,path),'utf8')),
    async writePrepared(name,value){const path=contained(preparedRoot,name+'.json'),temporary=path+`.partial-${process.pid}-${randomUUID()}`;await mkdir(dirname(path),{recursive:true});try{await writeFile(temporary,JSON.stringify(value)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}},
    relativeProject:path=>relative(root,path).replaceAll('\\','/'),
  });
}

export function commandContext(args=process.argv.slice(2)) {const parsed=operationArguments(args);return {...createOperationContext(parsed),args:parsed.args};}
