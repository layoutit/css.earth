/** l18 only: published population colors, masked bar ratios, frozen l17 geometry. */
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {ROOT,json,rec,num,need} from './inputs.mts';
import {loadParent,parentRung,versionDir,saveConfiguration,sceneControls,type Configuration} from './sequence-state.mts';
import {makeBarPopulation} from './bar-population.mts';
import {catalogueRows} from './catalogue-data.mts';
import {barAperture,photoRgb,ratios,displayRgb,fitBarRatios,BAR_COLOR_TOLERANCE,MAX_RMS_REGRESSION} from './bar-ratios.mts';
import {projectCatalogue,catalogueBasis} from './catalogue-render.mts';
import {gradedPrediction,readGrade,sourceTarget} from './grade.mts';
import {loadObservation} from './observation.mts';
import {earthCamera,outsideCamera} from './render.mts';
import {targetOf,metrics} from './report.mts';
import {normalized,saveGradedSheet} from './grade-report.mts';
import {finishSheet} from './catalogue-run.mts';
const dir=versionDir(18),write=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
await mkdir(dir,{recursive:true});
const {scene,cfg:before}=await loadParent(17),oldColors=structuredClone(scene.colors),oldInner=scene.innerDiscColor??oldColors[0],{rows}=await catalogueRows();need(scene.barGeometry,'Retained bar geometry missing');
const barPopulation=await makeBarPopulation(scene),innerPopulation=await makeBarPopulation(scene,'innerDisc');
const includeInner=process.argv.includes('--include-inner-disc');scene.colors[1]=barPopulation.color;scene.innerDiscColor=includeInner?innerPopulation.color:oldInner;
const cfg:Configuration={...before,version:18,parent:17,densityVersion:18,colors:scene.colors.map(v=>[...v]),innerDiscColor:scene.innerDiscColor,change:includeInner?'Bar and old inner-disc population color only; three global bar RGB coefficients match the catalogue-masked photo ratios.':'Bar population color only; three global bar RGB coefficients match the catalogue-masked photo ratios. The inner-disc update failed the pilot and is excluded.',details:{barPopulation:barPopulation.metadata,innerPopulation:{...innerPopulation.metadata,applied:includeInner,decision:includeInner?'Experimental coupled color trial':'The coupled color trials exceeded the fixed one-percent RMS regression limit. Preserve the parent inner-disc color.'},acceptance:{colorToleranceRelative:BAR_COLOR_TOLERANCE,maximumWholeImageRmsRegressionRelative:MAX_RMS_REGRESSION,ratios:'Ratio of summed displayed sRGB channels, using identical masks and the fixed inherited sky. This measures publisher appearance, not physical band photometry.'},mask:'Fixed projected two-sigma ellipsoid; catalogue gas, cluster and association ellipses excluded. Supershell rims excluded. Ellipses are padded by 1.5 registered source pixels. No RGB threshold selects the mask.',hzCheck:'Harris & Zaritsky 2009 remains a check, not an averaged prior: ancient bar ages use HST constraints and exact released age-bin edges are unqualified.'}};
await saveConfiguration(cfg,before.densityVersion);await write(dir+'population.json',{bar:barPopulation,innerDisc:innerPopulation});await write(dir+'protocol.json',cfg.details);
await write(dir+'structure.json',{objects:scene.objects,dust:scene.dust,owners:scene.owners,barGeometry:scene.barGeometry,colors:scene.colors,innerDiscColor:scene.innerDiscColor,metadata:scene.metadata});
const frozen=JSON.stringify([scene.objects,scene.dust,scene.barGeometry,scene.youngDensity]),runs=[];
for(const tiny of [true,false]){
 const started=performance.now(),size=tiny?64:512,step=tiny?.12:.06,out=tiny?dir+'tiny/':dir;await mkdir(out,{recursive:true});
 const o=await loadObservation(tiny?1:8),aperture=barAperture(o,scene.barGeometry,rows),photo=ratios(photoRgb(o),aperture.mask),previous=await parentRung(17,tiny,scene),initial=readGrade(previous.result.grade),amplitudes=previous.amplitudes,target=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor),sky=o.metadata.sky.rgbLinearDisplay;
 const maskImage=Buffer.from(aperture.mask.map(v=>v*255));await sharp(maskImage,{raw:{width:o.width,height:o.height,channels:1}}).png().toFile(out+'bar-mask.png');
 console.log(JSON.stringify({sentinel:'L18_MASK_READY',rung:tiny?'tiny':'small',photo,barPixels:aperture.barPixels}));
 const camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),projection=projectCatalogue(scene,camera,step),parentPlanes=projection.smooth.planes.map((p,k)=>k===0||k===1?Float64Array.from(p,(v,i)=>v*(k===0?oldInner[i%3]/scene.innerDiscColor![i%3]:oldColors[1][i%3]/barPopulation.color[i%3])):p),parentProjection={...projection,smooth:{...projection.smooth,planes:parentPlanes}},parentPrediction=gradedPrediction(catalogueBasis(parentProjection,scene,amplitudes),initial),replay=metrics(normalized(parentPrediction,o),targetOf(o),o),expected=rec(previous.result.residuals);
 need(Math.abs(replay.trainRelativeRms-num(expected.trainRelativeRms))<1e-8&&Math.abs(replay.heldoutRelativeRms-num(expected.heldoutRelativeRms))<1e-8,'Frozen l17 replay failed');
 const fit=fitBarRatios(catalogueBasis(projection,scene,amplitudes),initial,target,aperture,photo,sky,parentPrediction),grade=fit.grade,prediction=fit.prediction,residuals=metrics(normalized(prediction,o),targetOf(o),o),views=[];
 console.log(JSON.stringify({sentinel:'L18_EARTH_READY',rung:tiny?'tiny':'small',residuals,barColor:fit.diagnostics}));
 for(const angle of [0,45,90]){views.push(gradedPrediction(catalogueBasis(projectCatalogue(scene,outsideCamera(angle,size),step),scene,amplitudes),grade));console.log(JSON.stringify({sentinel:'L18_VIEW_READY',size,angle}));}
 need(JSON.stringify([scene.objects,scene.dust,scene.barGeometry,scene.youngDensity])===frozen,'l18 changed a frozen physical field');
 await saveGradedSheet(out,18,o,prediction,views,grade,includeInner?'Bar and inner-disc population color only; masked bar calibration.':'Bar population color only; catalogue-masked bar color calibration.');
 if(!tiny)await finishSheet(out,18,['Only the bar population color changes.','VMC age and metallicity mixture.','Inner-disc trial failed its RMS guard.','Three global bar RGB coefficients.','Fixed two-sigma bar aperture.','Gas and stellar objects are masked.','R/G and B/G tolerance: 2 percent.','RGB RMS regression limit: 1 percent.','Geometry, dust and Gaia stay at l17.','Inner disc and outskirts stay at l17.','Same grade in every view.','No local photo color transfer.']);
 const result={rung:tiny?'tiny':'small',size,seconds:(performance.now()-started)/1000,parent:17,grade,residuals,sceneControls:sceneControls(scene),change:cfg.change,barColor:fit.diagnostics,parentReplay:replay};await write(out+'result.json',result);await write(out+'object-brightness.json',scene.owners.map((v,i)=>({...v,amplitude:amplitudes[i]})));runs.push(result);await write(dir+'rungs.json',runs);console.log(JSON.stringify({sentinel:'L18_RUNG_COMPLETE',rung:result.rung,seconds:result.seconds,colorPassed:fit.diagnostics.colorPassed,rmsPassed:fit.diagnostics.rmsPassed}));
 if(process.argv.includes('--tiny-only'))break;need(fit.diagnostics.colorPassed&&fit.diagnostics.rmsPassed,'The rung failed the declared l18 acceptance test');
}
if(runs.length===2){
 const source=ROOT+'src/objects/lmc-volume/source/preparation/l18/',parent=ROOT+'src/objects/lmc-volume/source/preparation/l17/';await mkdir(source,{recursive:true});await copyFile(parent+'frame.json',source+'frame.json');
 await write(source+'recipe.json',{generator:'packages/bake/authoring/lmc-volume/bar-ratio-run.mts',configuration:cfg,acceptance:cfg.details.acceptance});await write(source+'fit.json',{...runs[1],geometryParametersFitted:0,pixelParameters:0});await write(source+'field.json',{...scene.metadata,configuration:cfg});await write(source+'lineage.json',{...rec(await json(parent+'lineage.json')),parentModel:'src/objects/lmc-volume/source/preparation/l17/',stageChange:cfg.change,stageEvidence:cfg.details,barPopulationInputs:[{path:'src/objects/lmc-volume/.local/archive/dataset-model/stars/regions.json',product:'VMC Mazzi 2021, CDS J/MNRAS/508/245'},{path:'src/objects/lmc-volume/.local/archive/dataset-model/world-field/metallicity/bc03-native-Z-optical.json',product:'Qualified BC03 native-metallicity Johnson BVR integration'}]});await write(source+'provenance.json',{rungs:runs,slabs:false,fullFit:false});
 await sharp({create:{width:3072,height:1668,channels:3,background:'#101216'}}).composite([{input:await readFile(versionDir(17)+'sheet.png'),left:0,top:0},{input:await readFile(dir+'sheet.png'),left:1536,top:0}]).png().toFile(dir+'l17-l18-side-by-side.png');
}
console.log(JSON.stringify({sentinel:'L18_ALL_REQUESTED_RUNGS_COMPLETE'}));
