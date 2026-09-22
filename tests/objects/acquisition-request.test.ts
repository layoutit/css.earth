import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {executeAcquisition,parseAcquisitionPlan} from '../../tools/objects/dist/operations.js';
import {execFileSync} from 'node:child_process';
import type {SourceManifest} from '../../tools/objects/dist/operations.js';

const json=async(path:string)=>JSON.parse(await readFile(resolve(path),'utf8'));
const temporary=async(work:(root:string)=>Promise<void>)=>{
 const root=await mkdtemp(join(tmpdir(),'terrestrial-request-acquisition-'));
 try{await work(root);}finally{await rm(root,{recursive:true,force:true});}
};
