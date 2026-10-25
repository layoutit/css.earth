/** l9/l10 tiny-to-small runner. l10 freezes l9's fields and display grade. */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import sharp from 'sharp';
import {pathToFileURL} from 'node:url';
import {LOCAL,ROOT,json,rec,array,num,need,loadSources} from './inputs.mts';
import {loadObservation} from './observation.mts';
import {makePhotoSky,INPUT_CURVE} from './photo-convert.mts';
import {makeDepthFields,makeDepthModel,CEPHEID_NORMAL_SECH_SCALE,BAR_SIGMA_Z,ADOPTED_LAYERS,adoptedDepthFields,type DepthFields} from './depth-model.mts';
import {project,earthCamera,outsideCamera} from './render.mts';
import {targetOf,metrics} from './report.mts';
import {sourceTarget,fitGrade,gradedPrediction,appearanceLoss,readGrade,componentSettings,type Grade} from './grade.mts';
import {saveGradedSheet,normalized} from './grade-report.mts';
const version=process.argv.includes('--version=10')?10:9,out=`${LOCAL}versions/l${version}/`,writeJson=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
export async function finishSheet(dir:string,version:9|10=9){
  const labels=Buffer.from(`<svg width="512" height="604" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="#e7e9ed" font-family="Arial" font-size="18"><text x="20" y="35" font-size="24">l${version}: finite volumes</text><text x="20" y="82">Knots: depth equals observed width.</text><text x="20" y="118">Each region is on the warped plane.</text><text x="20" y="168">${version===10?'Adopted Gaussian layer widths:':'Diffuse young: Cepheid sech-squared.'}</text><text x="20" y="204">${version===10?'Young and diffuse gas: 150 pc.':`Normal scale: ${(1000*CEPHEID_NORMAL_SECH_SCALE).toFixed(0)} pc.`}</text><text x="20" y="242">${version===10?'Dust: 250 pc. Old disc: 410 pc.':'Sky-Z scale: 1940 pc (Ripepi 2022).'}</text><text x="20" y="292">Bar: Gaussian ellipsoid.</text><text x="20" y="328">Vertical sigma: ${(1000*BAR_SIGMA_Z).toFixed(0)} pc.</text><text x="20" y="366">qz = 0.35, adopted published limit.</text><text x="20" y="404">No significant global vertical offset.</text><text x="20" y="454">Wide fade into the paper disc.</text><text x="20" y="492">${version===10?'Same knots, bar, frame and grade.':'Same split, warp, dust and grading.'}</text><text x="20" y="548">Depth is conditional, not tomography.</text><text x="20" y="580" font-size="14">NGC 4027: ESO. Different filters and scale.</text></g></svg>`);
  const main=await sharp(dir+'sheet.png').extract({left:0,top:0,width:1536,height:1064}).png().toBuffer();
  await sharp({create:{width:1536,height:1668,channels:3,background:'#101216'}}).composite([{input:main,left:0,top:0},{input:await readFile(dir+'outside-comparison.png'),left:0,top:1064},{input:labels,left:1024,top:1064}]).png().toFile(dir+'sheet.png');
}
async function record(fields:DepthFields,grade:Grade,runs:unknown[]){
  const source=`${ROOT}src/objects/lmc-volume/source/preparation/`,dir=source+`l${version}/`;await mkdir(dir,{recursive:true});
  const recipe=rec(await json(source+`l${version===10?9:8}/recipe.json`)),lineage=rec(await json(source+`l${version===10?9:8}/lineage.json`));
  const references=version===10?array(lineage.references).map(v=>{const r=rec(v);return r.id==='Ripepi2022'?{...r,role:'Historical l9 depth only. l10 uses owner-adopted disc widths.'}:r;}):[...array(lineage.references),{id:'Ripepi2022',url:'https://arxiv.org/html/2203.01780',role:'Observed VMC/OGLE Cepheid ensemble sech-squared sky-Z scale, 1.94 +/- 0.02 kpc. Converted to disc normal, not confused with an exponential or Gaussian scale. Not deconvolved individual newborn-star depths.'},{id:'JacyszynDobrzeniecka2016',url:'https://arxiv.org/html/1602.09141',role:'OGLE Cepheid distance spread about 1.5 kpc includes measurement scatter and extraplanar structure. No significant global bar vertical offset.'},{id:'Subramanian2009',url:'https://doi.org/10.1051/0004-6361/200811029',role:'Disagreeing older red-clump bar LOS one-sigma depth 4.0 +/- 1.4 kpc; not substituted for Kacharov triaxial-bar geometry. Different tracer, population correction and thickness definition.'}];
  await Promise.all([
    writeJson(dir+'recipe.json',{...recipe,schema:'lmc-finite-depth@1',generator:'packages/bake/authoring/lmc-volume/depth-run.mts',generatorArguments:version===10?['--version=10']:[],heightsSigmaKpc:fields.metadata.heightsSigmaKpc,heightCaveat:fields.metadata.thicknessStatus,method:fields.metadata,acceptedByOwner:false,replayStages:['depth-run.mts','record-manifest.mts']}),
    writeJson(dir+'fit.json',{grade,gradeFrozenFrom:version===10?'l9':null,components:componentSettings(grade),globalControlsOnly:true,localFitParameters:0,geometryOptimized:false}),
    writeJson(dir+'lineage.json',{references}),copyFile(source+'l8/frame.json',dir+'frame.json'),
    writeJson(dir+'field.json',{...fields.metadata,workingFields:`src/objects/lmc-volume/.local/versions/l${version}/`,regions:fields.regions,generator:'packages/bake/authoring/lmc-volume/depth-model.mts'}),
    writeJson(dir+'provenance.json',{status:`Unaccepted l${version} physical-depth pilot`,rungs:runs,sheet:`src/objects/lmc-volume/.local/versions/l${version}/sheet.png`,fullFit:false,slabs:false,adoptedLayers:version===10?ADOPTED_LAYERS:null,depthAssumption:'Individual nebular depths are not measured. Width equals depth is the owner-requested isotropy prior. Bar thickness adopts a published upper constraint, not a measured best value.'})]);
}
async function main(){
await mkdir(out,{recursive:true});const began=performance.now(),sources=await loadSources(512,20),native=await loadObservation(8),t=sourceTarget(targetOf(native),native.metadata.normalization.commonFactor),sky=await makePhotoSky(t.data,Uint8Array.from(native.mask.flat(),Number),native.width,native.height);
let previous=readGrade(rec(await json(`${LOCAL}versions/l${version===10?9:8}/result.json`)).grade);const runs=[];
for(const rung of ['tiny','small'] as const){
  const beganRung=performance.now(),tiny=rung==='tiny',size=tiny?64:512,grid=tiny?512:1536,step=tiny?.028:.012,o=tiny?await loadObservation(1):native,baseFields=makeDepthFields(sky,native,sources,grid),fields=version===10?adoptedDepthFields(baseFields):baseFields,model=makeDepthModel(fields,sources,version===10?ADOPTED_LAYERS:undefined),dir=tiny?out+'tiny/':out;await mkdir(dir,{recursive:true});
  console.log(JSON.stringify({sentinel:`L${version}_FIELDS_READY`,rung,regions:fields.regions.length,cloudFractions:fields.metadata.cloudFractions,folds:fields.metadata.foldSuppressedCells,youngDepth:fields.metadata.youngDepth,barDepth:fields.metadata.barDepth}));
  const basis=project(model,earthCamera(o.width,o.height,o.rayAt,o.pixelOf),step,1),target=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor),grade=version===10?structuredClone(previous):fitGrade({values:[1],bases:[basis]},target,previous,false,true),earth=gradedPrediction(basis,grade),stats=metrics(normalized(earth,o),targetOf(o),o),appearance=appearanceLoss(earth,target),views=[];
  console.log(JSON.stringify({sentinel:`L${version}_EARTH_READY`,rung,stats,appearance,grade}));
  need(Number.isFinite(appearance)&&stats.trainRelativeRms<.25,`l${version} failed the tiny/small fidelity guard; do not scale`);
  for(const angle of [0,45,90]){const ds=tiny?step:angle===0?.028:.012;views.push(gradedPrediction(project(model,outsideCamera(angle,size),ds,1),grade));console.log(JSON.stringify({sentinel:`L${version}_OUTSIDE_READY`,rung,angle}));}
  await saveGradedSheet(dir,version,o,earth,views,grade);const result={rung,size,grid,stepKpc:step,seconds:(performance.now()-beganRung)/1000,grade,residuals:stats,appearanceRms:appearance,meaning:'Source-photo round trip with conditional physical depths. Not an independent depth validation.'};
  await writeJson(dir+'result.json',result);runs.push(result);previous=grade;need((await sharp(dir+'sheet.png').metadata()).width===3*size,'End-to-end sheet missing');
  if(!tiny){if(version===10)await verifyUnchangedFields(fields);await finishSheet(dir,version);await writeJson(dir+'field.json',fields.metadata);await writeJson(dir+'regions.json',fields.regions);for(let k=0;k<5;k++)await writeFile(dir+`field-${k}.f32le`,Buffer.from(fields.maps[k].values.buffer));for(let k=0;k<2;k++)for(let c=0;c<3;c++)await writeFile(dir+`cloud-${k}-${c}.f32le`,Buffer.from(fields.clouds[k][c].values.buffer));await record(fields,grade,runs);}
  await writeJson(out+'rungs.json',runs);console.log(JSON.stringify({sentinel:`L${version}_RUNG_COMPLETE`,...result}));if(process.argv.includes('--tiny-only'))break;
}
console.log(JSON.stringify({sentinel:`L${version}_ALL_REQUESTED_RUNGS_COMPLETE`,seconds:(performance.now()-began)/1000}));

}
async function verifyUnchangedFields(fields:DepthFields){
 const prior=`${LOCAL}versions/l9/`;
 for(let k=0;k<5;k++)need((await readFile(prior+`field-${k}.f32le`)).equals(Buffer.from(fields.maps[k].values.buffer)),'l10 changed an l9 on-sky field');
 for(let k=0;k<2;k++)for(let c=0;c<3;c++)need((await readFile(prior+`cloud-${k}-${c}.f32le`)).equals(Buffer.from(fields.clouds[k][c].values.buffer)),'l10 changed an l9 knot field');
 need(JSON.stringify(fields.regions)===JSON.stringify(await json(prior+'regions.json')),'l10 changed l9 region geometry');
 need(fields.barNormalization===num(rec(await json(prior+'field.json')).barNormalization),'l10 changed l9 bar normalization');
 console.log(JSON.stringify({sentinel:'L10_FIELDS_MATCH_L9',fields:11,regions:fields.regions.length,barNormalizationUnchanged:true}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
