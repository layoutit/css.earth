/** The same tiny/small calibration code, followed by fixed-parameter 512 px renders. */
import {mkdir,writeFile,cp,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {pathToFileURL} from 'node:url';
import {LOCAL,ROOT,loadSources,need,json,rec,array,type Sources} from './inputs.mts';
import {loadNative} from './native.mts';
import {addGas} from './gas.mts';
import {createModel,EXTINCTION_RGB,SIGMA_DISC,HEIGHT_DISC,SIGMA_BAR,BAR_RATIO,BAR_VERTICAL_RATIO,BAR_LUMINOSITY,type Model} from './model.mts';
import {DISTANCE,INCLINATION,NODE,DEG,BAR_ANGLE,BAR_OFFSET} from './geometry.mts';
import {project,earthCamera,outsideCamera} from './render.mts';
import {loadObservation} from './observation.mts';
import {targetOf,metrics} from './report.mts';
import {fitGrade,gradedPrediction,appearanceLoss,sourceTarget,familyBasis,componentSettings,type Family,type Grade} from './grade.mts';
import {saveGradedSheet,notes,normalized} from './grade-report.mts';
const OUT=`${LOCAL}versions/`;
const writeJson=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const initial:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[0,0,0]],dustStrength:1,dustTint:[1,1,1],stretch:0,saturation:1,score:Infinity};
async function family(model:Model,scale:1|2){
  const o=await loadObservation(scale),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),values=model.stage>=6?[0,.1,.25,.5,.75,1,1.5,2,3,4]:[0],bases=[];
  for(const t of values){bases.push(project(model,camera,.16,t,[1/EXTINCTION_RGB[0],1/EXTINCTION_RGB[1],1/EXTINCTION_RGB[2]]));console.log(JSON.stringify({sentinel:'DUST_BASIS_COMPLETE',stage:model.stage,size:o.width,strength:t}));}
  return {o,camera,family:{values,bases}};
}
async function rung(model:Model,scale:1|2,previous:Grade){
  const start=performance.now(),{o,camera,family:f}=await family(model,scale),target=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor),grade=fitGrade(f,target,previous,model.stage>=6,model.stage>=7),basis=project(model,camera,.16,model.stage>=6?grade.dustStrength:0,grade.dustTint),earth=gradedPrediction(basis,grade),approx=gradedPrediction(model.stage>=6?familyBasis(f,grade.dustStrength,grade.dustTint):f.bases[0],grade);
  let difference=0,total=0;for(let i=0;i<earth.length;i++){difference+=Math.abs(earth[i]-approx[i]);total+=earth[i];}
  const result={size:o.width,calibrationSeconds:(performance.now()-start)/1000,seconds:0,grade,appearanceTrainRms:appearanceLoss(earth,target),appearanceHeldoutRms:appearanceLoss(earth,target,true),dustFamilyRelativeL1:difference/total,linear:metrics(normalized(earth,o),targetOf(o),o)};
  need(Number.isFinite(result.appearanceHeldoutRms)&&result.dustFamilyRelativeL1<.015,'Calibration family failed its exact-render comparison');
  const dir=`${OUT}l${model.stage}/grade-${scale===1?'tiny':'small'}`;await mkdir(dir,{recursive:true});
  const views=[0,45,90].map(a=>gradedPrediction(project(model,outsideCamera(a,o.width),.16,model.stage>=6?grade.dustStrength:0,grade.dustTint),grade));
  await saveGradedSheet(dir,model.stage,o,earth,views,grade);result.seconds=(performance.now()-start)/1000;await writeJson(`${dir}/result.json`,result);
  need((await sharp(`${dir}/sheet.png`).metadata()).width===o.width*3,'End-to-end pilot sheet missing');
  console.log(JSON.stringify({sentinel:'GRADING_RUNG_COMPLETE',stage:model.stage,...result}));return result;
}
export async function record(stage:number,grade:Grade,rungs:unknown[],sources:{metadata:Record<string,unknown>;nativeStars?:{metadata:Record<string,unknown>}},residuals:unknown){
  const dir=`${ROOT}src/objects/lmc-volume/source/preparation/l${stage}`;
  const lineage=rec(await json(`${dir}/lineage.json`)),references=array(lineage.references).map(v=>rec(v));
  for(const reference of references)if(reference.id==='SMASH')reference.role='Native individual DR2 source astrometry and measured gri photometry, with a global VMC age-derived luminosity budget; no regional position smoothing.';
  if(stage>=7&&!references.some(v=>v.id==='DeMCELS'))references.push({id:'DeMCELS',url:'https://datalab.noirlab.edu/data/demcels',role:'Qualified continuum-subtracted H-alpha cutouts; relative linear morphology, conditional layer depth, incomplete field coverage.'});
  await writeJson(`${dir}/lineage.json`,{...lineage,references});
  // Preserve the accepted research lineage, replacing only this round's method and evidence.
  await writeJson(`${dir}/fit.json`,{schema:'lmc-component-appearance-grade@1',grade,components:componentSettings(grade),residuals});
  await writeJson(`${dir}/recipe.json`,{schema:'lmc-physical-model-pilot@2',version:`l${stage}`,generator:'packages/bake/authoring/lmc-volume/grade-run.mts',acceptedByOwner:false,
    command:'node packages/bake/authoring/lmc-volume/grade-run.mts',physicalModel:'Kacharov density shapes; Rathore offset bar; Pietrzynski distance; Choi plane; Oden warp; Nidever outskirts; VMC age budget; native SMASH stars; Bell internal dust; DeMCELS H-alpha.',
    distanceKpc:DISTANCE,geometry:{inclinationDegrees:INCLINATION/DEG,lineOfNodesDegrees:NODE/DEG,sigmaDiscKpc:SIGMA_DISC,sigmaDiscZKpc:HEIGHT_DISC,sigmaBarKpc:SIGMA_BAR,barInPlaneRatio:BAR_RATIO,barVerticalRatio:BAR_VERTICAL_RATIO,barAngleInDiscRadians:BAR_ANGLE,barOffsetKpc:BAR_OFFSET,barLuminosityRelativeToDisc:BAR_LUMINOSITY,dustAndGasSigmaZKpc:HEIGHT_DISC/2},
    modelingChoice:'Kacharov density shapes with Rathore placement and Choi/Oden geometry; the original equilibrium solution is not retained.',
    assumptions:['The bar Fourier center proxies its untabulated ellipse center. Offset direction is digitized from Figure 8 and is approximate at about 0.1 kpc, not the scalar measurement precision.','The warp uses a qualified 64 by 64 TAN cache, not the full native Oden release.','Gaussian heights are conditional widths; Ripepi provides a different-tracer comparison, not their direct measurement.','The outer count-to-light conversion assumes equal mass-to-light ratio.','Dust tint is a global appearance response, not a recovered grain extinction curve.'],
    geometryFitted:false,keptComponents:Array.from({length:stage},(_,i)=>i+1),calibration:{emission:'Four component RGB coefficient triples in [0,100], equivalent to gain plus mean-normalized tint. Outskirts are tied to the old disc.',dust:'Fixed Bell spatial columns; strength in [0.25,2], red/blue attenuation ratios in [0.6,1.5], green fixed to one.',display:'One luminance asinh stretch [0,20] and saturation [0.5,2.5].',independentGlobalControls:stage===5?11:stage===6?14:17,localFreeParameters:0,method:'Bounded global coordinate search with weighted nonnegative least squares, then direct display-curve coordinate polish.',polishObjectiveWeights:{squaredRelativeSrgbRms:1,squaredRelativeLinearRms:.15,squaredGlobalLogFluxRatio:.25},rungs:'64 and 128 pixel fits; 512 pixel renders at fixed fitted settings. No full fit.'},sources:sources.metadata});
  await writeJson(`${dir}/provenance.json`,{status:'Unaccepted research pilot',rungs,artifact:`src/objects/lmc-volume/.local/versions/l${stage}/sheet.png`,fullResolutionFit:false,slabBake:false});
  await writeJson(`${dir}/field.json`,{generator:'packages/bake/authoring/lmc-volume/model.mts',continuous:'Analytic stellar shapes and measured surface rasters, lifted through the declared vertical distributions.',discrete:'Individual SMASH source positions and photometry are emitted separately from the continuous old population, with a shared global young-light normalization.',nativeStars:sources.nativeStars?.metadata,cache:'src/objects/lmc-volume/.local/versions/inputs/native-field/',gas:stage>=7?sources.metadata.gas:null,displayNotBakedIntoPhysicalDensity:true});
}
async function main(){
  await mkdir(`${OUT}round1`,{recursive:true});for(const stage of [5,6,7])if(!await stat(`${OUT}round1/l${stage}/sheet.png`).catch(()=>null))await cp(`${OUT}l${stage}`,`${OUT}round1/l${stage}`,{recursive:true});
  let start=performance.now();const sources=await loadSources(512,20);console.log(JSON.stringify({sentinel:'SOURCE_RASTERS_READY',seconds:(performance.now()-start)/1000}));
  sources.nativeStars=await loadNative(sources);sources.metadata.nativeStars=sources.nativeStars.metadata;await writeJson(`${OUT}inputs/native-summary.json`,sources.nativeStars.metadata);
  const nativeDir=`${OUT}inputs/native-field/`;await mkdir(nativeDir,{recursive:true});
  for(const [name,values]of Object.entries({positions:sources.nativeStars.positions,rgb:sources.nativeStars.rgb,earthTau:sources.nativeStars.earthTau}))await writeFile(`${nativeDir}${name}.bin`,Buffer.from(values.buffer,values.byteOffset,values.byteLength));
  await writeJson(`${nativeDir}layout.json`,{...sources.nativeStars.metadata,positions:'little-endian Float64 xyz in kpc',rgb:'little-endian Float64 normalized linear flux',earthTau:'little-endian Float32 V optical depth',generator:'packages/bake/authoring/lmc-volume/native.mts'});
  console.log(JSON.stringify({sentinel:'NATIVE_FIELD_READY',count:sources.nativeStars.count,seconds:(performance.now()-start)/1000}));
  let grade=structuredClone(initial);
  for(const stage of [5,6,7]){
    if(stage===7){await addGas(sources);await writeJson(`${OUT}inputs/graded-source-summary.json`,sources.metadata);}
    start=performance.now();const model=createModel(stage,Array.from({length:stage},(_,i)=>i+1),sources),tiny=await rung(model,1,grade),small=await rung(model,2,tiny.grade);grade=small.grade;
    const o=await loadObservation(8),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),earth=gradedPrediction(project(model,camera,.1,stage>=6?grade.dustStrength:0,grade.dustTint),grade),views=[];
    console.log(JSON.stringify({sentinel:'FINAL_EARTH_RENDER_COMPLETE',stage}));
    for(const a of [0,45,90]){views.push(gradedPrediction(project(model,outsideCamera(a,512),.1,stage>=6?grade.dustStrength:0,grade.dustTint),grade));console.log(JSON.stringify({sentinel:'FINAL_OUTSIDE_RENDER_COMPLETE',stage,angle:a}));}
    const dir=`${OUT}l${stage}`;await saveGradedSheet(dir,stage,o,earth,views,grade);
    const residuals=await notes(dir,stage,o,earth,grade,[tiny,small],['Native SMASH positions retain catalogue angular resolution; only pixel integration spreads their flux. Bright blue candidates are an incomplete population proxy.',
      'Bell columns are fixed 5-arcminute medians, without the previous extra smoothing. Missing cells are unsupported.',
      'Warp and outskirts are retained from their measured priors; the separate ablation report tests their reach into the renders.',
      ...(stage>=7?['DeMCELS covers the qualified cutouts, not the full LMC. Its continuum-subtracted linear counts are a morphology template; missing BUNIT prevents absolute-flux calibration.']:[]),
      'NGC 4027 comparison: https://www.eso.org/public/images/potw1030a/ . Credit: ESO. Different filters, distances and processing; no geometry is fitted to this image.']);
    await record(stage,grade,[tiny,small],sources,residuals);
    console.log(JSON.stringify({sentinel:'LMC_GRADED_VERSION_COMPLETE',stage,seconds:(performance.now()-start)/1000,residuals}));
    if(process.argv.includes('--pilot-only'))break;
  }
  console.log('LMC_GRADING_RUN_COMPLETE');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
