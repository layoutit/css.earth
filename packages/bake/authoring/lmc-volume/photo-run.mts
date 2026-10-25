/** l8 tiny then 512 px: photo-derived on-sky components with fixed physical depth priors. */
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {LOCAL,ROOT,loadSources,need,json,rec,array,num} from './inputs.mts';
import {loadObservation} from './observation.mts';
import {targetOf,metrics,imageBytes,type Observation} from './report.mts';
import {makePhotoSky,HEIGHTS,INPUT_CURVE,type PhotoSky} from './photo-convert.mts';
import {makePhotoFields,makePhotoModel,type PhotoFields} from './photo-model.mts';
import {project,earthCamera,outsideCamera,type Basis} from './render.mts';
import {fitGrade,gradedPrediction,sourceTarget,componentSettings,appearanceLoss,type Grade} from './grade.mts';
import {saveGradedSheet,normalized} from './grade-report.mts';
import {DISTANCE,INCLINATION,NODE,DEG,BAR_ANGLE,BAR_OFFSET,ORIGIN_ICRS,BODY_X,BODY_Y,BODY_Z} from './geometry.mts';
const out=`${LOCAL}versions/l8/`;
const writeJson=async(p:string,v:unknown)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
export interface PhotoRun {fields:PhotoFields;sky:PhotoSky;observation:Observation;grade:Grade;}
const initial:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustStrength:1,dustTint:[1,1,1],stretch:INPUT_CURVE.stretch,saturation:INPUT_CURVE.saturation,score:0};
async function diagnostics(s:PhotoSky,fields:PhotoFields,o:Observation){
  const panel=async(values:Float64Array|Float32Array,w:number,h:number,label:string,rgb:boolean)=>{
    const bytes=Buffer.alloc(w*h*3);if(rgb){for(let i=0;i<bytes.length;i++){const v=Math.max(0,Math.min(1,values[i]));bytes[i]=Math.round(255*(v<.0031308?v*12.92:1.055*v**(1/2.4)-.055));}}
    else for(let i=0;i<w*h;i++)for(let c=0;c<3;c++)bytes[i*3+c]=Math.round(255*Math.min(1,values[i]));
    const png=await sharp(bytes,{raw:{width:w,height:h,channels:3}}).resize(384,384,{fit:'contain',background:'#07080a'}).png().toBuffer();return {png,label};
  };
  const panels=[];
  for(let k=0;k<4;k++){const m=fields.maps[k],v=new Float64Array(m.values.length*3),color=fields.colors[k<2?0:k-1];for(let i=0;i<m.values.length;i++)for(let c=0;c<3;c++)v[i*3+c]=m.values[i]*color[c];panels.push(await panel(v,m.n,m.n,['Old disc','Bar partition','Young stars','Hydrogen-line gas'][k],true));}
  panels.push(await panel(Float32Array.from(fields.maps[4].values,v=>v/2),fields.maps[4].n,fields.maps[4].n,'Dust optical depth / 2',false));
  const labels=Buffer.from(`<svg width="1920" height="424" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial" font-size="18">${panels.map((p,i)=>`<text x="${i*384+10}" y="27">${p.label}</text>`).join('')}</g></svg>`);
  await sharp(labels).composite(panels.map((p,i)=>({input:p.png,left:i*384,top:40}))).png().toFile(out+'components.png');
}
async function main(){
  await mkdir(out,{recursive:true});const began=performance.now(),sources=await loadSources(512,20),native=await loadObservation(8),target=sourceTarget(targetOf(native),native.metadata.normalization.commonFactor),valid=Uint8Array.from(native.mask.flat(),v=>Number(v));
  const sky=await makePhotoSky(target.data,valid,native.width,native.height);await writeJson(out+'conversion.json',sky.metadata);
  let previous=structuredClone(initial);const runs=[];
  for(const rung of ['tiny','small'] as const){
    const start=performance.now(),size=rung==='tiny'?64:512,grid=rung==='tiny'?512:1536,o=rung==='tiny'?await loadObservation(1):native,fields=makePhotoFields(sky,native,sources,grid,12),model=makePhotoModel(fields,sources),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),step=rung==='tiny'?.035:.018;
    console.log(JSON.stringify({sentinel:'L8_FIELDS_READY',rung,grid,metadata:fields.metadata}));
    const basis=project(model,camera,step,1),t=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor),grade=fitGrade({values:[1],bases:[basis]},t,previous,false,true),earth=gradedPrediction(basis,grade),stats=metrics(normalized(earth,o),targetOf(o),o),appearance=appearanceLoss(earth,t),views=[];
    need(Number.isFinite(appearance)&&stats.trainRelativeRms<.25,'l8 source conversion failed its fidelity guard');
    console.log(JSON.stringify({sentinel:'L8_EARTH_READY',rung,stats,appearance,grade}));
    for(const angle of [0,45,90]){const viewStep=rung==='tiny'?step:angle===0?.045:.012;views.push(gradedPrediction(project(model,outsideCamera(angle,size),viewStep,1),grade));console.log(JSON.stringify({sentinel:'L8_OUTSIDE_READY',rung,angle,viewStepKpc:viewStep}));}
    const dir=rung==='tiny'?out+'tiny/':out;await mkdir(dir,{recursive:true});await saveGradedSheet(dir,8,o,earth,views,grade);
    const result={rung,size,grid,stepKpc:step,seconds:(performance.now()-start)/1000,grade,components:componentSettings(grade),residuals:stats,appearanceRms:appearance,meaning:'Photo-source round-trip. The same photo supplied the component maps; this is not independent prediction or depth validation.'};
    await writeJson(dir+'result.json',result);runs.push(result);previous=grade;
    need((await sharp(dir+'sheet.png').metadata()).width===3*size,'Completed end-to-end sheet missing');
    if(rung==='small'){
      await writeJson(out+'field.json',fields.metadata);await diagnostics(sky,fields,o);
      for(let k=0;k<fields.maps.length;k++)await writeFile(out+`field-${k}.f32le`,Buffer.from(fields.maps[k].values.buffer));
      await writeJson(out+'sky-layout.json',{width:sky.width,height:sky.height,colors:sky.colors});
      for(const[name,v]of Object.entries({rgb:sky.rgb,valid:sky.valid,distance:sky.distance,rawDust:sky.rawDust}))await writeFile(out+`sky-${name}.bin`,Buffer.from(v.buffer,v.byteOffset,v.byteLength));
      const recordDir=`${ROOT}src/objects/lmc-volume/source/preparation/l8/`;await mkdir(recordDir,{recursive:true});
      const references=[{id:'Horálek',url:'https://noirlab.edu/public/images/iotw2547a/',role:'Cleaned registered source of on-sky detail; processed RGB, not calibrated radiance.'},{id:'BC03',url:'https://doi.org/10.1046/j.1365-8711.2003.06897.x',role:'Fixed Z=0.008 old and young stellar color priors.'},{id:'Gordon2003',url:'https://doi.org/10.1086/376774',role:'LMC average extinction law, Rv=3.41.'},{id:'Bell2022',url:'https://arxiv.org/abs/2205.04406',role:'One full-column dust normalization; spatial pattern is check only.'},{id:'Kacharov2024',url:'https://arxiv.org/html/2410.05374',role:'Old-disc and bar geometry, old-disc height and exterior profile.'},{id:'Choi2018',url:'https://arxiv.org/abs/1804.07765',role:'Disc plane.'},{id:'Oden',url:'https://doi.org/10.5281/zenodo.18330355',role:'Measured warp through preserved qualified cache.'},{id:'Rathore2025',url:'https://arxiv.org/html/2410.18182',role:'Bar placement and orientation, retaining the recorded approximate offset direction.'},{id:'Pietrzynski2019',url:'https://arxiv.org/abs/1903.08096',role:'Distance.'}];
      await Promise.all([
        writeJson(recordDir+'recipe.json',{schema:'lmc-photo-conversion@1',generator:'packages/bake/authoring/lmc-volume/photo-run.mts',distanceKpc:DISTANCE,inclinationDegrees:INCLINATION/DEG,lineOfNodesDegrees:NODE/DEG,barAngleInDiscRadians:BAR_ANGLE,barOffsetKpc:BAR_OFFSET,heightsSigmaKpc:HEIGHTS,heightCaveat:fields.metadata.thicknessStatus,sourceRole:'Photo supplies spatial emission and dust-lane detail. Surveys are checks; Bell also fixes one dust amount.',inputCurve:INPUT_CURVE,method:fields.metadata,acceptedByOwner:false}),
        writeJson(recordDir+'fit.json',{grade,globalControlsOnly:true,localFitParameters:0}),writeJson(recordDir+'lineage.json',{references}),
        writeJson(recordDir+'frame.json',{referenceFrame:'ICRS',originKpc:ORIGIN_ICRS,axesInWestNorthToward:{x:BODY_X,y:BODY_Y,z:BODY_Z},metersPerUnit:3.0856775814913673e19}),
        writeJson(recordDir+'field.json',{...fields.metadata,workingField:'src/objects/lmc-volume/.local/versions/l8/field-0.f32le through field-4.f32le',generator:'packages/bake/authoring/lmc-volume/photo-model.mts'}),
        writeJson(recordDir+'provenance.json',{status:'Unaccepted l8 research pilot',rungs:runs,sheet:'src/objects/lmc-volume/.local/versions/l8/sheet.png',fullFit:false,slabs:false})
      ]);
    }
    console.log(JSON.stringify({sentinel:'L8_RUNG_COMPLETE',...result}));if(process.argv.includes('--tiny-only'))break;
  }
  await writeJson(out+'rungs.json',runs);console.log(JSON.stringify({sentinel:'L8_ALL_REQUESTED_RUNGS_COMPLETE',seconds:(performance.now()-began)/1000}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
