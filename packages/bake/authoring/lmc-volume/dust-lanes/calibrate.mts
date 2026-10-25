/** One global dense-lane foreground scale, evaluated with the accepted volume renderer. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';import sharp from 'sharp';
import {loadParent,parentRung} from '../sequence-state.mts';
import {photoRgb,displayRgb} from '../bar-ratios.mts';
import {readGrade,gradedPrediction} from '../grade.mts';
import {earthCamera} from '../render.mts';
import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';
import {normalized} from '../grade-report.mts';import {imageBytes} from '../report.mts';
import {need} from '../inputs.mts';
import {L26,laneContext,measure,match,TOLERANCE} from './measure.mts';
import {dustControl,applySelection,reddeningCheck} from './geometry.mts';
const pilot=process.argv.includes('--pilot'),small=process.argv.includes('--small'),scales=pilot?[.2]:small?[.05,.1,.2]:[1,.7,.5,.35,.2,.1,.05];
await mkdir(L26+'calibration/',{recursive:true});const {scene}=await loadParent(25),parent=await parentRung(25,false,scene),control=await dustControl(scene),context=await laneContext(!small),grade=readGrade(parent.result.grade),photo=measure(photoRgb(context.o),context),trials=[];
let best=Infinity;
for(const scale of scales){
 const started=performance.now(),geometry=applySelection(control,scale),constraint=reddeningCheck(control,scale),basis=catalogueBasis(projectCatalogue(scene,earthCamera(context.o.width,context.o.height,context.o.rayAt,context.o.pixelOf),.03,context.bar),scene,parent.amplitudes),prediction=gradedPrediction(basis,grade),measurement=measure(displayRgb(prediction,context.o.metadata.sky.rgbLinearDisplay),context),passes=match(measurement,photo),score=((measurement.depth-photo.depth)/TOLERANCE.depthAbsolute)**2+((measurement.darkDecileTransmission-photo.darkDecileTransmission)/TOLERANCE.darkDecileAbsolute)**2+(Math.log(measurement.rg/photo.rg)/Math.log(1.02))**2+(Math.log(measurement.bg/photo.bg)/Math.log(1.02))**2+(passes.bar?0:1000),trial={scale,measurement,passes,score,geometry,constraint,seconds:(performance.now()-started)/1000};trials.push(trial);
 if(score<best){best=score;await writeFile(L26+'calibration/best-prediction.f64le',Buffer.from(prediction.buffer));await sharp(imageBytes(normalized(prediction,context.o),context.o,true),{raw:{width:context.o.width,height:context.o.height,channels:3}}).png().toFile(L26+'calibration/'+(pilot?'pilot':'best')+'.png');}
 console.log(JSON.stringify({sentinel:'L26_LANE_TRIAL',pilot,...trial}));await writeFile(L26+'calibration/'+(pilot?'pilot':'trials')+'.json',JSON.stringify({photo,tolerances:TOLERANCE,trials},null,2)+'\n');
}
const passing=trials.filter(t=>Object.values(t.passes).every(Boolean)),eligible=passing.length?passing:trials.filter(t=>t.passes.bar),selected=eligible.sort((a,b)=>a.score-b.score)[0];need(selected,'No lane trial retained bar color');
if(pilot){const b=await readFile(L26+'baseline.json');need(b.length>0,'Missing measured baseline');console.log('L26_TINY_PILOT_COMPLETE');}
else{const text=JSON.stringify({photo,tolerances:TOLERANCE,trials,selected,freeParameters:1,parameterBounds:[.05,1],globalDustStrength:scene.dustLayer?.strength,method:'Dense patches sample a less-reddened optical population within the measured red-clump distribution. All full source apertures bound the reduction. The total native column, sky positions, Gaussian depth width and Gordon law remain fixed.'},null,2)+'\n';await writeFile(L26+'calibration.json',text);await writeFile(L26+(small?'calibration-foreground-small.json':'calibration-tiny.json'),text);console.log('L26_GLOBAL_CALIBRATION_COMPLETE');}
