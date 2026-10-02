// Fit filter cameras to a reference image, or measure authored ones with --check-only, and write the full report.
// Preparation runs the same check for every camera a color recipe registers; this job fits new cameras.
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {requireRecord,requireString,array,shape,text} from '@cssearth/core';
import { parseCameraFrame, loadCameraShape, controlledShapeCamera, decodeCalibratedCamera, alignCameraBands, BAND_ALIGNMENT_CRITERIA, BAND_ALIGNMENT_METHOD, BAND_ALIGNMENT_SETTINGS } from '@cssearth/bake/objects/geometry';

const jobPath=process.argv[2],outputPath=process.argv[3];
if(!jobPath||!outputPath)throw new Error('Usage: align-camera-bands.mts JOB.json REPORT.json [--check-only]');
const checkOnly=process.argv.includes('--check-only');
const recipeText=await readFile(jobPath,'utf8'),job=requireRecord(JSON.parse(recipeText));
const body=requireString(job.body),root=resolve(dirname(jobPath),requireString(job.sourceRoot));
const color=shape({channels:array(shape({filter:text,frames:array(parseCameraFrame)}))})(job.color),profile=requireRecord(job.shape);
const mesh=await loadCameraShape(root,profile);

const source=async(frame:ReturnType<typeof parseCameraFrame>)=>{const bytes=await readFile(`${root}/${frame.path}`);return {frame,image:decodeCalibratedCamera(bytes)};};
const reference=await source(parseCameraFrame(job.referenceFrame));
const targets=[];for(const channel of color.channels)targets.push({filter:channel.filter,...await source(channel.frames[0])});
const result=alignCameraBands({mesh,camera:controlledShapeCamera,reference,targets,checkOnly});
for(const report of result.reports){const corrected=report.correctedCamera;if(corrected)console.log(body,report.filter,'center',corrected.center,'north azimuth',corrected.northAzimuthDegrees,'fit',report.fit,'holdout',report.holdout);}
const {patchRadiusPixels,patchSampleStepPixels,...settings}=BAND_ALIGNMENT_SETTINGS;
await writeFile(outputPath,JSON.stringify({body,mode:checkOnly?'fixed-camera-validation':'feature-fit',recipe:jobPath,referenceCamera:reference.frame,
 mesh:{path:requireString(profile.path)},
 settings:{patchRadiusPixels,patchSampleStepPixels,patchGridStepPixels:result.patchGridStepPixels,...settings},
 method:BAND_ALIGNMENT_METHOD,criteria:BAND_ALIGNMENT_CRITERIA,reports:result.reports},null,2)+'\n');
