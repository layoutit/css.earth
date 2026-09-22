// Fit filter cameras to a reference image, or measure authored ones with --check-only, and write the full report.
// Preparation runs the same check for every camera a colour recipe registers; this job fits new cameras.
import { sha256 } from '../../../src/platform/sha256.mts';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {requireRecord,requireString} from '../../sources/source-values.mts';
import {array,parseCameraFrame,shape,text} from './source-records.mts';
import {loadCameraShape,controlledShapeCamera,decodeCalibratedCamera} from './shape-camera-mosaic.mts';
import {alignCameraBands,BAND_ALIGNMENT_CRITERIA,BAND_ALIGNMENT_METHOD,BAND_ALIGNMENT_SETTINGS} from './band-alignment.mts';

const jobPath=process.argv[2],outputPath=process.argv[3];
if(!jobPath||!outputPath)throw new Error('Usage: align-camera-bands.mts JOB.json REPORT.json [--check-only]');
const checkOnly=process.argv.includes('--check-only');
const recipeText=await readFile(jobPath,'utf8'),job=requireRecord(JSON.parse(recipeText));
const body=requireString(job.body),root=resolve(dirname(jobPath),requireString(job.sourceRoot));
const color=shape({channels:array(shape({filter:text,frames:array(parseCameraFrame)}))})(job.color),profile=requireRecord(job.shape);
const mesh=await loadCameraShape(root,profile);

const source=async(frame:ReturnType<typeof parseCameraFrame>)=>{const bytes=await readFile(`${root}/${frame.path}`);return {frame,image:decodeCalibratedCamera(bytes),sha256:sha256(bytes)};};
const reference=await source(parseCameraFrame(job.referenceFrame));
const targets=[];for(const channel of color.channels)targets.push({filter:channel.filter,...await source(channel.frames[0])});
const result=alignCameraBands({mesh,camera:controlledShapeCamera,reference,targets,checkOnly});
for(const report of result.reports){const corrected=report.correctedCamera;if(corrected)console.log(body,report.filter,'center',corrected.center,'north azimuth',corrected.northAzimuthDegrees,'fit',report.fit,'holdout',report.holdout);}
const {patchRadiusPixels,patchSampleStepPixels,...settings}=BAND_ALIGNMENT_SETTINGS;
await writeFile(outputPath,JSON.stringify({body,mode:checkOnly?'fixed-camera-validation':'feature-fit',recipeSha256:sha256(recipeText),referenceCamera:reference.frame,
 implementationSha256:sha256(await readFile(new URL('./band-alignment.mts',import.meta.url))),
 mesh:{path:profile.path,sha256:sha256(await readFile(resolve(root,requireString(profile.path))))},
 settings:{patchRadiusPixels,patchSampleStepPixels,patchGridStepPixels:result.patchGridStepPixels,...settings},
 method:BAND_ALIGNMENT_METHOD,criteria:BAND_ALIGNMENT_CRITERIA,reports:result.reports},null,2)+'\n');
