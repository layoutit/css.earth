/** Regenerate count fields from the same native catalogues, not interpolation of a saved low-resolution grid. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {correctedPopulationSamples,correctedLightDensity} from '../corrected-population.mts';
import {splitOldDensity} from '../gaia-old-model.mts';
import {loadGaiaSample} from '../gaia-young.mts';
import {densityFromMembers} from '../gaia-density.mts';
import {uniqueHot,YOUNG_SIGMA_KPC,MCPS_SHARE} from '../owner-rounds/young.mts';
import {versionDir} from '../sequence-state.mts';
import {rec,json,array,num,need,type Raster} from '../inputs.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
import {RESOLUTION_DIR} from './resolution-cameras.mts';
import {approvedScene} from './reference.mts';

function integral(r:Raster){return r.values.reduce((s,v)=>s+v,0)*(2*r.half/r.n)**2;}
function preserveBudget(map:Raster,parent:Raster){const factor=integral(parent)/integral(map);need(factor>0&&Number.isFinite(factor),'Invalid refined population budget');for(let i=0;i<map.values.length;i++)map.values[i]*=factor;return factor;}
export async function refineFields(scene:CatalogueScene,n:1024|2048=2048,verification=false){
 need(scene.oldPopulation&&scene.youngDensity,'The approved populations must be present');const directory=RESOLUTION_DIR+(verification?`verify-fields-${n}/`:`fields-${n}/`),half=10;await mkdir(directory,{recursive:true});
 if(n===2048){const pilot=rec(await json(RESOLUTION_DIR+'fields-1024/complete.json'));need(pilot.complete===true&&pilot.n===1024,'Native field refinement needs its smaller complete pilot first');}
 const names=['disc','bar','young'] as const,read=async(name:string):Promise<Raster>=>{const bytes=await readFile(directory+name+'.f32le');need(bytes.length===n*n*4,'Incomplete refined field');const values=new Float32Array(Uint8Array.from(bytes).buffer);need(values.every(v=>Number.isFinite(v)&&v>=0),'Invalid refined density');return{n,half,values,mask:new Uint8Array(n*n).fill(1)};};
 const cached=await json(directory+'complete.json').then(rec).catch(error=>{if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return null;throw error;});let maps:Raster[],summary:Record<string,unknown>;
 if(cached){summary=cached;need(summary.complete===true&&summary.n===n&&summary.halfKpc===half&&summary.youngSigmaPc===45&&summary.oldSigmaPc===100,'Refined field settings differ');maps=await Promise.all(names.map(read));}
 else{
  const started=performance.now(),prior=rec(rec(await json(versionDir(21)+'old-population.json')).completeness);need(typeof prior.allTracers==='boolean','The accepted completeness setting is missing');const sample=await correctedPopulationSamples(scene,prior.allTracers),old=correctedLightDensity(sample.stars,scene.sources,sample.rawWeights,sample.probabilities,n,half),split=splitOldDensity(old),gaia=await loadGaiaSample(false,versionDir(29)),hot=rec(await json(versionDir(29)+'hot-stars.json'));need(hot.pilot===false&&hot.rows===24107002,'The full native MCPS selection is required');
  const extra=uniqueHot(array(hot.stars).map(v=>{const r=rec(v);return{ra:num(r.ra),dec:num(r.dec)};}),gaia.stars),young=densityFromMembers(gaia.stars,scene.sources,n,half,undefined,YOUNG_SIGMA_KPC),mcps=densityFromMembers(extra,scene.sources,n,half,undefined,YOUNG_SIGMA_KPC);
  for(let i=0;i<young.values.length;i++)young.values[i]=(1-MCPS_SHARE)*young.values[i]+MCPS_SHARE*mcps.values[i];maps=[split.disc,split.bar,young];const budgets=[scene.oldPopulation.disc,scene.oldPopulation.bar,scene.youngDensity],factors=maps.map((map,i)=>preserveBudget(map,budgets[i]!));
  need(maps.every(map=>map.mask.every(v=>v===1)),'Fresh and cached population support must agree');
  for(let i=0;i<names.length;i++){const path=directory+names[i]+'.f32le',temporary=path+'.tmp-'+process.pid;await writeFile(temporary,Buffer.from(maps[i]!.values.buffer));await rename(temporary,path);}
  summary={complete:true,n,halfKpc:half,cellPc:2000*half/n,oldSigmaPc:100,youngSigmaPc:45,oldTracers:sample.stars.length,gaiaYoung:gaia.stars.length,mcpsHotUnique:extra.length,populationBudgetFactors:factors,seconds:(performance.now()-started)/1000,method:'Same Gaia/MCPS catalogues, selection, completeness and physical smoothing. Native positions are redeposited on the grid specified by n. Component budgets, warp, dust, objects, stars, heights and grades are unchanged.'};const temporary=directory+'complete.tmp-'+process.pid;await writeFile(temporary,JSON.stringify(summary,null,2)+'\n');await rename(temporary,directory+'complete.json');
 }
 scene.oldPopulation={...scene.oldPopulation,disc:maps[0]!,bar:maps[1]!};scene.youngDensity=maps[2]!;return summary;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const n=Number(process.argv[2]);need(n===1024||n===2048,'Choose the 1024 or 2048 native field rung');const{scene}=await approvedScene(),verify=process.argv.includes('--verify-cache'),result=await refineFields(scene,n,verify);if(verify){for(const name of['disc','bar','young'])need((await readFile(RESOLUTION_DIR+`fields-${n}/`+name+'.f32le')).equals(await readFile(RESOLUTION_DIR+`verify-fields-${n}/`+name+'.f32le')),'Recomputed native density differs from cache');console.log('REFINED_FIELDS_CACHE_BYTE_IDENTICAL');}console.log(JSON.stringify({sentinel:'REFINED_FIELDS_COMPLETE',...result,rssBytes:process.memoryUsage().rss}));}
