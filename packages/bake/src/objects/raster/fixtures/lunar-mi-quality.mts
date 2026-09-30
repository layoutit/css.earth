/** Audit the prepared 2016 Kaguya MI grids: node packages/bake/src/objects/raster/fixtures/lunar-mi-quality.mts <report.json>.
 * Native-byte fidelity is checked separately by isis-geotiff-grid.mts. This checks every compact cell's
 * display validity and calibration, plus independent mineral closure and discrete model classes. */
import {fromFile} from 'geotiff';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadScienceSurface} from '@cssearth/bake/objects/raster';
function record(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Expected record');return v as Record<string,unknown>;}
const root=resolve('src/objects/moon/source/science/usgs');
const names=['fit-quality','iron-oxide','optical-maturity','submicroscopic-iron','plagioclase-grain-size','olivine','orthopyroxene','clinopyroxene','plagioclase'];
const minerals=['olivine','orthopyroxene','clinopyroxene','plagioclase'];
const grids=new Map<string,Float32Array>();
for(const name of names){const path=resolve(root,`${name}.tif`);const file=await fromFile(path);try{const im=await file.getImage();if(im.getWidth()!==2048||im.getHeight()!==1024||im.getGDALNoData()!==-99999)throw new Error('Grid dimensions or missing value changed');const data=await im.readRasters({interleave:true});if(!(data instanceof Float32Array))throw new Error('Expected float32');grids.set(name,data);}finally{await file.close();}}
const recipe=record(JSON.parse(await readFile('src/objects/moon/source/preparation/raster.json','utf8'))),surfaces=recipe.surfaces;
if(!Array.isArray(surfaces))throw new Error('Expected surfaces');
const fit=grids.get('fit-quality')!,checks=[];
for(const name of names.filter(n=>n!=='fit-quality')){
 const plan=surfaces.map(record).find(s=>s.id===name);if(!plan)throw new Error(`Missing surface ${name}`);
 const loaded=await loadScienceSurface(root,record(plan.science).scientific),data=grids.get(name)!;
 let valid=0,maskMismatches=0,valueMismatches=0,physicalRejects=0,zerosWithoutFit=0,aboveStretch=0;
 const classes:Record<string,number>={};
 for(let i=0;i<data.length;i++){
  const raw=data[i]!,f=fit[i]!,hasRaw=Number.isFinite(raw)&&raw!==-99999,hasFit=Number.isFinite(f)&&f>=0;
  const physical=name!=='iron-oxide'||raw>=0&&raw<=100,expected=hasRaw&&hasFit&&physical;
  if(hasRaw&&!physical)physicalRejects++;if(hasRaw&&raw===0&&!hasFit)zerosWithoutFit++;
  if(hasRaw&&name==='optical-maturity'&&raw>0.5)aboveStretch++;
  const actual=loaded.sample((i%2048+.5)*360/2048-180,90-(Math.floor(i/2048)+.5)*180/1024);
  if((actual!==null)!==expected)maskMismatches++;
  if(expected){valid++;if(actual===null||Math.abs(actual-raw*(minerals.includes(name)?100:1))>1e-9)valueMismatches++;
   if(['submicroscopic-iron','plagioclase-grain-size'].includes(name))classes[raw]=(classes[raw]??0)+1;}
 }
 checks.push({name,cells:data.length,valid,missing:data.length-valid,physicalRejects,zerosWithoutFit,aboveStretch,maskMismatches,valueMismatches,...(Object.keys(classes).length?{classes}:{})});
}
let cells=0,maxFractionSumError=0;
for(let i=0;i<fit.length;i++){if(fit[i]!<0||!Number.isFinite(fit[i]))continue;const sum=minerals.reduce((n,k)=>n+grids.get(k)![i]!,0);maxFractionSumError=Math.max(maxFractionSumError,Math.abs(sum-1));cells++;}
const passed=checks.every(c=>c.maskMismatches===0&&c.valueMismatches===0)&&maxFractionSumError<1e-6;
const report={schema:'cssearth-lunar-mi-quality-audit@1',passed,date:new Date().toISOString(),checks,composition:{cells,maxFractionSumError},policy:'All eight views require a finite nonnegative companion fit as a conservative shared coverage gate. FeO also excludes values outside [0,100] weight percent. Raw grids remain unchanged. OMAT values above 0.5 use the capped legend endpoint; no inferred upper quality cutoff.'};
if(!process.argv[2])throw new Error('Provide output report path');await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!passed)process.exitCode=1;
