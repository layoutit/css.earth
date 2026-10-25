/** Fixed-l12 counterfactuals isolate the diffuse layer from all other model changes. */
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {LOCAL,json,rec,array,num,need} from './inputs.mts';
import {oldPopulationMap,loadFrozenL12} from './frozen-l12.mts';
import {projectCatalogue,catalogueBasis,type CatalogueProjection} from './catalogue-render.mts';
import {gradedPrediction,readGrade} from './grade.mts';
import {normalized} from './grade-report.mts';
import {metrics,targetOf,type Observation} from './report.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
import type {Camera} from './render.mts';
import {earthCamera} from './render.mts';
import {loadObservation} from './observation.mts';
import {L13} from './gaia-young.mts';
export async function outerLightControl(scene:CatalogueScene,gaia:CatalogueProjection,camera:Camera,o:Observation,step:number,tiny:boolean){
 const dir=LOCAL+'versions/l12/'+(tiny?'tiny/':''),saved=rec(await json(dir+'result.json')),grade=readGrade(saved.grade),owners=array(await json(dir+'object-brightness.json')).map(rec);need(owners.length===scene.owners.length,'l12 amplitude count changed');
 const amplitudes=Float64Array.from(owners.map((r,i)=>{need(r.id===scene.owners[i].id||r.kind==='population','l12 catalogue order changed');return num(r.amplitude);})),population=scene.owners.findIndex(o=>o.kind==='population');need(population>=0,'Diffuse population missing');
 const onlyOld=projectCatalogue({...scene,objects:[],youngDensity:await oldPopulationMap()},camera,step),old={...gaia,objects:gaia.objects.map(v=>v.owner===population?onlyOld.objects[population]:v)},measure=(p:CatalogueProjection,a:Float64Array)=>metrics(normalized(gradedPrediction(catalogueBasis(p,scene,a),grade),o),targetOf(o),o),baseline=measure(old,amplitudes),expected=rec(saved.residuals);
 need(Math.abs(baseline.totalLightDifferencePercent-num(expected.totalLightDifferencePercent))<1e-6&&Math.abs(baseline.trainRelativeRms-num(expected.trainRelativeRms))<1e-8,'Frozen l12 replay disagrees with its saved result');const noPopulation=amplitudes.slice();noPopulation[population]=0;
 const result={rung:tiny?'tiny':'small',controls:'All l12 catalogue gains, RGB grades and tone settings frozen. Only the diffuse-population density is replaced or disabled.',l12Reproduced:baseline,withoutDiffuse:measure(gaia,noPopulation),gaiaAtL12Settings:measure(gaia,amplitudes)};await writeFile(L13+`outer-control-${tiny?'tiny':'small'}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sentinel:'L13_OUTER_LIGHT_CONTROL',rung:result.rung,l12Outer:baseline.annularDifferencePercent[3],withoutDiffuseOuter:result.withoutDiffuse.annularDifferencePercent[3],gaiaOuter:result.gaiaAtL12Settings.annularDifferencePercent[3]}));return result;
}
export async function verifyFrozenTiny(){const scene=await loadFrozenL12();scene.youngDensity=await oldPopulationMap();const o=await loadObservation(1),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),p=projectCatalogue(scene,camera,.12),saved=rec(await json(LOCAL+'versions/l12/tiny/result.json')),grade=readGrade(saved.grade),amplitudes=Float64Array.from(array(await json(LOCAL+'versions/l12/tiny/object-brightness.json')).map(v=>num(rec(v).amplitude))),result=metrics(normalized(gradedPrediction(catalogueBasis(p,scene,amplitudes),grade),o),targetOf(o),o),expected=rec(saved.residuals);need(Math.abs(result.trainRelativeRms-num(expected.trainRelativeRms))<1e-8,'Frozen tiny replay changed l12');await writeFile(L13+'frozen-tiny-check.json',JSON.stringify({model:'l12, unchanged; no Gaia data substituted',result},null,2)+'\n');console.log(JSON.stringify({sentinel:'L12_FROZEN_TINY_REPRODUCED',residuals:result}));}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await verifyFrozenTiny();
