import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compare } from './compare.mts';
import { ORACLE_ROOT } from '../fixture.mts';

const result=await compare(), directory=resolve(ORACLE_ROOT,'output/oracles/sbmt');
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'comparison.json'),JSON.stringify(result,null,2)+'\n');
for(const c of result.cases){
  console.log(`${c.id}: ${c.status.toUpperCase()}`);
  for(const s of c.stages)console.log(`  ${s.name}: ${s.status}, n=${s.compared}, max=${s.maximumError}, limit=${s.tolerance}`);
}
console.log(`Report: ${resolve(directory,'comparison.json')}`);
if(result.cases.some(c=>c.status!=='match'))process.exitCode=1;
