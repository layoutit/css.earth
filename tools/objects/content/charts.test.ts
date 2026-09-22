import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareChartAssets,parseChartAssetRecipe} from './charts';
import {renderLightCurveChart,renderReflectanceChart,renderTemperaturePressureChart} from './chart-svg';
test('chart source-derived axis rounding is optional and preserves metadata defaults',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cssearth-chart-test-'));
 try{
  await writeFile(join(directory,'spectrum.txt'),'0.35 0.12\n0.60 0.33\n1.0 0.21\n');
  await writeFile(join(directory,'pressure.cfg'),'<ATMOSPHERE-LAYER-1>100,219\n<ATMOSPHERE-LAYER-2>0.001,51\n');
  const identity={id:'unregistered',title:'Observed model',description:'Pinned test observation',metadata:{authority:'test source'}};
  const spectrum={...identity,kind:'spectrum',source:'spectrum.txt',format:'numeric-lines',pointCount:3,maximum:0.5,output:'spectrum.svg'};
  const pressure={...identity,kind:'pressure',source:'pressure.cfg',layerCount:2,temperatureMinimum:20,temperatureMaximum:300,pressureTicks:[{pressure:1,label:'1'}],output:'pressure.svg'};
  const config={schema:'cssearth-chart-assets@1',publicBase:'/test/',charts:[spectrum,pressure]};
  await prepareChartAssets({sourceDirectory:directory,publicDirectory:directory,config});
  const points=[{wavelength:0.35,total:0.12},{wavelength:0.6,total:0.33},{wavelength:1,total:0.21}],layers=[{index:1,pressure:100,temperature:219},{index:2,pressure:0.001,temperature:51}];
  assert.equal(await readFile(join(directory,'spectrum.svg'),'utf8'),renderReflectanceChart({...identity,points,maximum:0.5}));
  assert.equal(await readFile(join(directory,'pressure.svg'),'utf8'),renderTemperaturePressureChart({...identity,metadata:{...identity.metadata,pressureRangeBar:[0.001,100]},layers,pressureMinimum:0.001,pressureMaximum:100,temperatureMinimum:20,temperatureMaximum:300,pressureTicks:pressure.pressureTicks}));
  await prepareChartAssets({sourceDirectory:directory,publicDirectory:directory,config:{...config,charts:[{...spectrum,maximumRoundingScale:20},{...pressure,temperatureRoundingStep:20,includePressureRangeMetadata:false}]}});
  assert.equal(await readFile(join(directory,'spectrum.svg'),'utf8'),renderReflectanceChart({...identity,points,maximum:0.35}));
  assert.equal(await readFile(join(directory,'pressure.svg'),'utf8'),renderTemperaturePressureChart({...identity,layers,pressureMinimum:0.001,pressureMaximum:100,temperatureMinimum:40,temperatureMaximum:220,pressureTicks:pressure.pressureTicks}));
  for(const chart of[{...spectrum,maximumRoundingScale:0},{...spectrum,maximumRoundingScale:Infinity},{...pressure,temperatureRoundingStep:-1},{...pressure,includePressureRangeMetadata:'false'}])assert.throws(()=>parseChartAssetRecipe({...config,charts:[chart]}));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('a light curve drops masked samples, averages bins from the first sample and shows the change from the median in ppm',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cssearth-chart-test-'));
 try{
  // Four 10-minute bins of two samples each; the masked 0.5 would otherwise pull the third bin down.
  const rows=[[0,1.001,0],[0.003,1.001,0],[0.007,1.000,0],[0.010,1.000,0],[0.014,0.998,0],[0.0141,0.5,1],[0.017,0.998,0],[0.021,1.002,0],[0.024,1.002,0]];
  await writeFile(join(directory,'curve.csv'),'time,flux,mask\n'+rows.map(row=>row.join(',')).join('\n')+'\n');
  const identity={id:'unregistered',title:'Observed curve',description:'Pinned test observation',metadata:{authority:'test source'}};
  const chart={...identity,kind:'light-curve',source:'curve.csv',timeField:'time',fluxField:'flux',maskField:'mask',binMinutes:10,axisLabel:'hours',events:[{time:0.014,label:'x'}],output:'curve.svg'};
  await prepareChartAssets({sourceDirectory:directory,publicDirectory:directory,config:{schema:'cssearth-chart-assets@1',publicBase:'/test/',charts:[chart]}});
  const hours=[0,1.5/6,2.5/6,3.5/6],fluxes=[1.001,1.000,0.998,1.002],median=1.001;
  // The median of four bins is the upper middle value, 1.001.
  const expected=renderLightCurveChart({...identity,metadata:{...identity.metadata,samples:8,binMinutes:10},axisLabel:'hours',
   points:hours.map((h,i)=>({hours:h,flux:(fluxes[i]!/median-1)*1e6})),events:[{hours:0.014*24,label:'x'}]});
  assert.equal(await readFile(join(directory,'curve.svg'),'utf8'),expected);
  assert.throws(()=>parseChartAssetRecipe({schema:'cssearth-chart-assets@1',publicBase:'/test/',charts:[{...chart,binMinutes:0}]}));
 }finally{await rm(directory,{recursive:true,force:true});}
});
