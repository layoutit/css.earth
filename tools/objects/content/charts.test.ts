import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareChartAssets,parseChartAssetRecipe} from './charts';
import {renderReflectanceChart,renderTemperaturePressureChart} from './chart-svg';
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
