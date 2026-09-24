import { sourceTest } from './source-test.mts';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const test = sourceTest();

const json=async(path:string)=>JSON.parse(await readFile(resolve(path),'utf8'));
const temporary=async(work:(root:string)=>Promise<void>)=>{
 const root=await mkdtemp(join(tmpdir(),'terrestrial-request-acquisition-'));
 try{await work(root);}finally{await rm(root,{recursive:true,force:true});}
};
