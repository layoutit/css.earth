import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import{readFile,mkdtemp,rm}from'node:fs/promises';
import{tmpdir}from'node:os';
import{resolve,join}from'node:path';
import {prepareChartAssets} from '../content/charts';
for(const id of['jupiter','uranus','neptune'])test(`${id} authored chart parameters reproduce all accepted source-driven SVG bytes`,async()=>{
 const sourceDirectory=resolve('src/objects',id,'source'),config=JSON.parse(await readFile(resolve(sourceDirectory,'content/charts.json'),'utf8')),publicDirectory=await mkdtemp(join(tmpdir(),'giant-chart-parity-'));
 try{await prepareChartAssets({sourceDirectory,publicDirectory,config});for(const chart of config.charts)assert.ok((await readFile(resolve(publicDirectory,chart.output))).equals(await readFile(resolve('public/scenes',id,chart.output))),`${chart.output} exact payload`);}finally{await rm(publicDirectory,{recursive:true,force:true});}
});
