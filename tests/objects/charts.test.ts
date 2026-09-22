import { sourceTest } from './source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareChartAssets,parseChartAssetRecipe} from '../../tools/objects/content/charts.js';
const oracles=JSON.parse(await readFile('tests/objects/chart-parity.json','utf8')) as Record<string,Record<string,string>>;
for(const [id,hashes] of Object.entries(oracles))test(`${id} scientific charts and archive photographs match pre-migration bytes`,async()=>{
 const sourceDirectory=`src/objects/${id}/source`,config:unknown=JSON.parse(await readFile(`${sourceDirectory}/content/charts.json`,'utf8'));
 const publicDirectory=await mkdtemp(join(tmpdir(),'chart-parity-'));
 try{const result=await prepareChartAssets({sourceDirectory,publicDirectory,config});assert.equal(result.urls.length,Object.keys(hashes).length);
  for(const [file,expected] of Object.entries(hashes)){const bytes=await readFile(join(publicDirectory,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,file);}
 }finally{await rm(publicDirectory,{recursive:true,force:true});}
});
test('phase source rejects an uncovered angle range',()=>{
 assert.throws(()=>parseChartAssetRecipe({schema:'cssearth-chart-assets@1',publicBase:'/scenes/open-body/',charts:[{kind:'phase',id:'phase',title:'Phase',description:'Observed model',output:'phase.svg',metadata:{},sampleCount:181,maximumAngleDegrees:180,segments:[{kind:'polynomialMagnitude',maximumAngleDegrees:90,coefficients:[1,2]}]}]}),/cover/);
});
