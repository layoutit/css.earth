/** Qualify physical fields and integration on the exact final model; no refitting. */
import {mkdir,writeFile} from 'node:fs/promises';
import {at,loadSources,LOCAL,json,rec,need} from './inputs.mts';
import {loadObservation} from './observation.mts';
import {makePhotoSky} from './photo-convert.mts';
import {makeDepthFields,makeDepthModel,ADOPTED_LAYERS,adoptedDepthFields} from './depth-model.mts';
import {sourceTarget,readGrade,gradedPrediction} from './grade.mts';
import {targetOf} from './report.mts';
import {project,earthCamera,type Camera} from './render.mts';
import {bodyToIcrs} from './geometry.mts';
const version=process.argv.includes('--version=10')?10:9,out=`${LOCAL}versions/l${version}/`,sources=await loadSources(512,20),o=await loadObservation(8),t=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor),sky=await makePhotoSky(t.data,Uint8Array.from(o.mask.flat(),Number),o.width,o.height),baseFields=makeDepthFields(sky,o,sources,1536),fields=version===10?adoptedDepthFields(baseFields):baseFields,model=makeDepthModel(fields,sources,version===10?ADOPTED_LAYERS:undefined);
const grade=readGrade(rec(await json(`${LOCAL}versions/l8/result.json`)).grade),rows=fields.regions.map(r=>({id:r.id,component:r.component,skySigmaKpc:r.skySigmaKpc,halfDepthMaxKpc:r.halfDepthMaxKpc,depthRatio:r.losSigmaKpc/r.skySigmaKpc,midplaneErrorKpc:Math.abs(r.centerKpc[2]-at(sources.warp,r.centerKpc[0],r.centerKpc[1]))}));
const summary={regions:rows.length,maxMidplaneErrorKpc:Math.max(...rows.map(r=>r.midplaneErrorKpc)),maxDepthRatioError:Math.max(...rows.map(r=>Math.abs(r.depthRatio-1))),cloudFractions:fields.metadata.cloudFractions,rows};
need(summary.maxMidplaneErrorKpc<.005&&summary.maxDepthRatioError<1e-6,'Cloud geometry does not meet its recorded width/centre rule');
const earth=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),bright=fields.regions.filter(r=>r.component==='gas').sort((a,b)=>b.flux-a.flux)[0],pixel=o.pixelOf(bodyToIcrs(bright.centerKpc));need(pixel,'Brightest gas region is outside the registered camera');
const x0=Math.max(0,Math.min(o.width-48,Math.round(pixel[0])-24)),y0=Math.max(0,Math.min(o.height-48,Math.round(pixel[1])-24)),crop:Camera={...earth,name:'gas-integration-crop',width:48,height:48,ray:(x,y)=>earth.ray(x+x0,y+y0)};
const a=gradedPrediction(project(model,crop,.012,1),grade),b=gradedPrediction(project(model,crop,.006,1),grade);let sumA=0,sumB=0,error=0,power=0;for(let i=0;i<a.length;i++){sumA+=a[i];sumB+=b[i];error+=(a[i]-b[i])**2;power+=b[i]**2;}
const integration={region:bright.id,crop:[x0,y0,48,48],coarseStepKpc:.012,fineStepKpc:.006,totalLightDifference:sumA/sumB-1,relativeRgbRms:Math.sqrt(error/power),grade:'Fixed l8 grade, identical in both samples; no fit'};
need(Math.abs(integration.totalLightDifference)<.02&&integration.relativeRgbRms<.03,'The 12 pc integrator does not resolve the finite clouds');
await mkdir(out,{recursive:true});await writeFile(out+'geometry-audit.json',JSON.stringify(summary,null,2)+'\n');await writeFile(out+'integration-check.json',JSON.stringify(integration,null,2)+'\n');console.log(JSON.stringify({sentinel:`L${version}_GEOMETRY_AND_INTEGRATION_PASS`,geometry:{...summary,rows:undefined},integration}));
