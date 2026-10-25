/** Authorized l1–l7 experiment: same code at tiny/small; no full rung or slab bake. */
import { mkdir,writeFile,appendFile,readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { loadObservation } from './observation.mts';
import {loadSources,LOCAL,ROOT,need,json,rec,numbers,num,type Sources} from './inputs.mts';
import {sampleModel,discSurface,exponentialSurface,SIGMA_DISC,HEIGHT_DISC,BAR_LUMINOSITY,createModel,type Model} from './model.mts';
import {earthCamera,outsideCamera,project,calibrateVersion,predict,type Fit} from './render.mts';
import {targetOf,metrics,saveSheet,writeNotes,imageBytes} from './report.mts';
import {DISTANCE,BAR_ANGLE,BAR_OFFSET,BODY_X,BODY_Y,BODY_Z,ORIGIN_ICRS} from './geometry.mts';
const OUT=`${LOCAL}versions/`;
const LABELS=['Stellar disc','Offset stellar bar','Measured outer warp','Faint stellar outskirts','Young stellar populations','Dust attenuation','Ionized-gas emission'];
const INITIAL:Fit={gains:[1,1,1,1,1],red:1,blue:1,dust:0,loss:0,iterations:0};
async function saveJson(path:string,value:unknown){await writeFile(path,JSON.stringify(value,null,2)+'\n');}
const references=[
  {id:'Pietrzynski2019',url:'https://arxiv.org/abs/1903.08096',role:'Absolute distance'},
  {id:'Kacharov2024',url:'https://arxiv.org/html/2410.05374',role:'Adopted Gaussian disc and triaxial bar density shapes; equilibrium is not retained'},
  {id:'Rathore2025',url:'https://arxiv.org/html/2410.18182',role:'Bar PA, scalar offset, and figure-derived direction; no claimed exact center-vector catalogue'},
  {id:'Choi2018',url:'https://arxiv.org/html/1804.07765',role:'Disc plane and independent warp check'},
  {id:'Oden2026',url:'https://doi.org/10.5281/zenodo.18330355',role:'Mean-distance surface, through the previously qualified TAN cache'},
  {id:'Nidever2019',url:'https://arxiv.org/abs/1805.02671',role:'Outer counts; 0.4% mass fraction converted to a light fraction under equal M/L assumption'},
  {id:'Mazzi2021',url:'https://arxiv.org/html/2108.07225',role:'Regional ages and formed-mass budgets'},
  {id:'SMASH',url:'https://datalab.noirlab.edu/data/smash',role:'Observed blue-count spatial redistribution within regional age budgets'},
  {id:'BC03',url:'https://doi.org/10.1046/j.1365-8711.2003.06897.x',role:'Fixed Z=0.008 Chabrier spectral color proxy, not the VMC synthesis library'},
  {id:'Bell2022',url:'https://arxiv.org/html/2205.04406',role:'Full internal reddening columns'},
  {id:'Ripepi2022',url:'https://arxiv.org/html/2203.01780',role:'Thickness comparison only; no exact height inference from Cepheid scatter'},
];
async function storeField(dir:string,model:Model,fit:Fit,n:number,nz:number):Promise<Record<string,unknown>> {
  const values=new Float32Array(n*n*nz*4),sample=new Float64Array(16),dx=40/(n-1),dz=24/(nz-1);
  for(let k=0;k<nz;k++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    sampleModel(model,-20+i*dx,-20+j*dx,-12+k*dz,sample);const index=((k*n+j)*n+i)*4;
    for(let c=0;c<3;c++){let v=0;for(let p=0;p<5;p++)v+=sample[p*3+c]*fit.gains[p];values[index+c]=v*(c===0?fit.red:c===2?fit.blue:1);}
    values[index+3]=sample[15]*fit.dust;
  }
  need(values.every(v=>Number.isFinite(v)&&v>=0),'Nonfinite or negative physical field');
  await writeFile(`${dir}/field.f32`,Buffer.from(values.buffer));
  return {path:`${dir.slice(ROOT.length)}/field.f32`,dimensions:[n,n,nz,4],boundsKpc:{min:[-20,-20,-12],max:[20,20,12]},spacingKpc:[dx,dx,dz],layout:'z,y,x,channel; float32 little endian; RGB emissivity and V-band extinction per kpc',
    renderOwner:'Continuous analytic densities and fixed source surfaces, rather than interpolating this coarse diagnostic field',bytes:values.byteLength};
}
async function rung(stage:number,kept:number[],sources:Sources,initial:Fit,rungName:'tiny'|'small'){
  const start=performance.now(),scale=rungName==='tiny'?1:4,size=64*scale,step=rungName==='tiny'?.24:.12;
  const observation=await loadObservation(scale),target=targetOf(observation),camera=earthCamera(observation.width,observation.height,observation.rayAt);
  const model=createModel(stage,kept,sources);
  const skipRejectedDust=stage===6&&process.argv.includes('--skip-rejected-dust');
  if(skipRejectedDust){const path=`${OUT}l6/${rungName}/rejected-dust-fit.json`,evidence=rec(await json(path));need(num(rec(evidence.fit).dust)===0,'No prior zero-dust rejection supports this skip');
    if(!evidence.frameOriginIcrsKpc){const frame=rec(await json(`${ROOT}src/objects/lmc-volume/source/preparation/l6/frame.json`));evidence.frameOriginIcrsKpc=numbers(frame.originKpc,3);}
    evidence.scope='Previously rejected pilot fit, before the disc-distance anchor correction. No further dust fit was run.';await saveJson(path,evidence);
  }
  const candidates=skipRejectedDust?[0]:stage===6?(rungName==='tiny'?[0,.1,.25,.5,1,1.5,2]:[Math.max(0,initial.dust-.1),initial.dust,Math.min(2,initial.dust+.05),Math.min(2,initial.dust+.1)]):[stage>=6?initial.dust:0];
  let best:Fit|undefined,bestBasis:ReturnType<typeof project>|undefined;
  for(const dust of candidates){const basis=project(model,camera,step,dust),fit=skipRejectedDust?{...initial,dust:0}:calibrateVersion(basis,target,initial,stage);if(!best||fit.loss<best.loss){best=fit;bestBasis=basis;}}
  need(best&&bestBasis,'No reference candidate');
  const dir=`${OUT}l${stage}/${rungName}`;await mkdir(dir,{recursive:true});
  const skippedDust=stage===6&&best.dust===0;
  if(skippedDust){
    if(!skipRejectedDust)await saveJson(`${dir}/rejected-dust-fit.json`,{reason:'Image-only calibration preferred erasing the measured internal dust. Reject this result rather than interpreting it as no dust.',fit:best,frameOriginIcrsKpc:ORIGIN_ICRS});
    const previous=rec(rec(await json(`${OUT}l5/${rungName}/result.json`)).fit);
    best={gains:numbers(previous.gains,5),red:num(previous.red),blue:num(previous.blue),dust:num(previous.dust),loss:num(previous.loss),iterations:num(previous.iterations)};
    model.kept=model.kept.filter(s=>s!==6);bestBasis=project(model,camera,step,best.dust);
  }
  const prediction=predict(bestBasis,best),stats=metrics(prediction,target,observation);
  const views=[0,45,90].map(tilt=>predict(project(model,outsideCamera(tilt,size),step,best.dust),best!));
  await saveSheet(dir,`l${stage}: ${LABELS[stage-1]}`,observation,prediction,views,stats,skippedDust?'Dust fit rejected; l5 retained':stage===7&&!model.gasAvailable?'Component skipped: input not qualified':'Conditional physical model');
  const field=await storeField(dir,model,best,rungName==='tiny'?49:97,rungName==='tiny'?33:65);
  const seconds=(performance.now()-start)/1000;
  const result={rung:rungName,size,rayStepKpc:step,seconds,fit:best,residuals:stats,kept:model.kept,skippedDust,field};await saveJson(`${dir}/result.json`,result);
  console.log(JSON.stringify({sentinel:'LMC_RUNG_COMPLETE',version:stage,rung:rungName,seconds,heldoutRms:stats.heldoutRelativeRms,fit:best}));
  return {result,observation,prediction,views,model,fit:best,stats,skippedDust};
}
async function record(stage:number,small:Awaited<ReturnType<typeof rung>>,tiny:Awaited<ReturnType<typeof rung>>){
  const dir=`${ROOT}src/objects/lmc-volume/source/preparation/l${stage}`;await mkdir(dir,{recursive:true});
  const recipe={schema:'lmc-physical-model-pilot@1',version:`l${stage}`,label:LABELS[stage-1],acceptedByOwner:false,scope:'Tiny and small images only; no full fit or slab bake',keptComponents:small.model.kept,
    generator:'packages/bake/authoring/lmc-volume/run.mts',command:`node packages/bake/authoring/lmc-volume/run.mts --through=${stage}`,distanceKpc:DISTANCE,
    geometry:{inclinationDegrees:25.86,lineOfNodesDegrees:149.23,sigmaDiscKpc:SIGMA_DISC,sigmaDiscZKpc:HEIGHT_DISC,barAngleInDiscRadians:BAR_ANGLE,barOffsetKpc:BAR_OFFSET,barLuminosityRelativeToDisc:BAR_LUMINOSITY},
    modelingChoice:'Kacharov density shapes with Rathore placement/orientation and Choi/Oden geometry; not the original equilibrium solution',
    optimizer:{method:'Bounded coordinate least squares on global component gains and shared red/green and blue/green ratios; discrete dust-column scale',gainBounds:[0,10],colorRatioBounds:[.4,2.5],dustScaleBounds:[0,2],perPixelFreeValues:0,freeControlsAtMost:8,outerGain:'Tied to disc gain',outerGainReason:'The photo cannot constrain the far outskirts. Retain the count-normalized radial continuation at the same old-population exposure.',originalB30OptimizerAvailable:false},
    sources:small.model.sources.metadata};
  await Promise.all([
    saveJson(`${dir}/recipe.json`,recipe),saveJson(`${dir}/fit.json`,small.fit),saveJson(`${dir}/lineage.json`,{references}),
    saveJson(`${dir}/provenance.json`,{status:small.skippedDust?'Dust component skipped: image-only fit erased the measured column':stage===7&&!small.model.gasAvailable?'Gas component skipped; preceding physical model retained':'Unaccepted research pilot',tiny:tiny.result,small:small.result,artifact:`src/objects/lmc-volume/.local/versions/l${stage}/sheet.png`,fullResolutionRun:false,slabBakeRun:false}),
    saveJson(`${dir}/frame.json`,{referenceFrame:'ICRS',metersPerUnit:3.0856775814913673e19,originKpc:ORIGIN_ICRS,distanceAnchor:'The disc center, after applying the bar offset, remains at 49.59 kpc.',axesInWestNorthToward:{x:BODY_X,y:BODY_Y,z:BODY_Z},observer:'Earth baseline unresolved at LMC distance; heliocentric measured rays'}),
    saveJson(`${dir}/field.json`,small.result.field)
  ]);
}
async function main(){
  const arg=process.argv.find(a=>a.startsWith('--through=')),through=arg?Number(arg.split('=')[1]):7;
  const fromArg=process.argv.find(a=>a.startsWith('--from=')),from=fromArg?Number(fromArg.split('=')[1]):1;
  need(Number.isInteger(through)&&through>=1&&through<=7,'Only --through=1..7; no full rung is implemented');
  need(Number.isInteger(from)&&from>=1&&from<=through,'--from must name an existing predecessor or start at 1');
  await mkdir(OUT,{recursive:true});const sources=await loadSources();await saveJson(`${OUT}inputs/source-summary.json`,sources.metadata);
  const kept=[1];let fit=structuredClone(INITIAL);
  if(from>1){const parent=rec(await json(`${OUT}l${from-1}/small/result.json`));kept.splice(0,kept.length,...numbers(parent.kept));const source=rec(parent.fit);fit={gains:numbers(source.gains,5),red:num(source.red),blue:num(source.blue),dust:num(source.dust),loss:num(source.loss),iterations:num(source.iterations)};}
  for(let stage=from;stage<=through;stage++){
    if(stage>1&&stage!==7)kept.push(stage);if(stage===7&&sources.gas.mask.some(v=>v>0))kept.push(7);
    const tiny=await rung(stage,[...kept],sources,fit,'tiny');
    // A completed tiny contact sheet and finite field are positive evidence before the small rung.
    need((await sharp(`${OUT}l${stage}/tiny/sheet.png`).metadata()).width===768,'Tiny end-to-end sheet missing');
    const small=await rung(stage,[...kept],sources,tiny.fit,'small');fit=small.fit;
    kept.splice(0,kept.length,...small.model.kept);
    const dir=`${OUT}l${stage}`;await saveSheet(dir,`l${stage}: ${LABELS[stage-1]}`,small.observation,small.prediction,small.views,small.stats,small.skippedDust?'Skipped: zero-dust fit rejected; l5 retained':stage===7&&!small.model.gasAvailable?'Skipped: DeMCELS input not qualified':'Pilot complete; owner review pending');
    const limitations=[
      'This is a conditional physical model, not measured three-dimensional positions for every structure.',
      'Bar direction is approximate: digitized star/circle direction from Rathore Figure 8, normalized to its measured offset. The Fourier center proxies the untabulated bar ellipse center; precision is not 0.01 kpc.',
      'No per-pixel, per-region, or per-star brightness or color values were fitted to the photograph.',
      'Bright off-axis centers can clip under the same exposure; no individual view was renormalized.'
    ];
    if(stage>=3)limitations.push('Warp uses the qualified 64×64 Oden TAN cache, not the full native CAR map. Its missing outskirts have a declared planar continuation.');
    if(stage>=4)limitations.push('Outskirts corrections: the unconstrained gain is tied to the old-disc exposure. An unmotivated inner hole was removed; a cored continuation of the measured outer power law meets the Gaussian without double counting. Its inner continuation and equal mass-to-light ratio are assumptions, not measured extra structure.');
    if(stage>=5)limitations.push('Regional age budgets plus fixed SMASH blue counts set young structure. BC03/Chabrier is an explicit spectral proxy for VMC/Kroupa, not a matched population synthesis.');
    if(stage>=5)limitations.push('Correction round 1 fixed survey-gap striping at the population-replacement layer. Missing coverage now blends to the smooth parent, with no new image-fit controls.');
    if(stage>=6)limitations.push('Dust height is assumed. Bell gaps are unknown and contribute no modeled attenuation; the fixed foreground mean is not a retrieved Chen foreground map.');
    if(small.skippedDust)limitations.push('The coarse and refined dust-scale searches preferred zero. That would erase real measured dust, so this component failed and was skipped. The retained sheet is exactly l5, not evidence that the LMC has no dust. Rejected fit records remain beside both rungs.');
    if(stage===7&&!small.model.gasAvailable)limitations.push('The DeMCELS pilot file fails the existing FITS reader: duplicate EQUINOX cards. This component is skipped; this sheet repeats l6 rather than bypassing the shared reader or substituting an unapproved template.');
    await writeNotes(dir,stage,LABELS[stage-1],small.skippedDust?'Dust fit failed and was skipped. l5 is retained.':stage===7&&!small.model.gasAvailable?'Gas component skipped. The preceding model is retained.':'Tiny and small rungs completed. Physical and appearance limitations remain for owner review.',tiny.result,small.result,small.stats,fit,limitations);
    if(stage===1){const rows=[0,2,4,6,8].map(r=>`| ${r} | ${discSurface(r).toExponential(3)} | ${exponentialSurface(r).toExponential(3)} | ${(discSurface(r)/exponentialSurface(r)).toFixed(3)} |`).join('\n');
      await appendFile(`${dir}/notes.md`,`\n## Gaussian versus historical exponential\n\nAt equal integrated light, Kacharov's Gaussian has a flatter center and drops more steeply in the outskirts than a van der Marel exponential with representative scale length 1.4 kpc (published range 1.3–1.5 kpc). This is a comparison, not another fit or a change to the accepted model.\n\n| Radius, kpc | Gaussian surface density | Exponential surface density | Gaussian / exponential |\n| --- | --- | --- | --- |\n${rows}\n\nThe Gaussian vertical width is ${HEIGHT_DISC.toFixed(3)} kpc. Ripepi's 1.94 kpc sech² parameter describes a different, noisy young tracer. It cannot be substituted directly as this old-population Gaussian height.\n`);
    }
    await record(stage,small,tiny);
    const wide=predict(project(small.model,outsideCamera(0,256,20),.18,fit.dust),fit);
    await sharp(imageBytes(wide,small.observation,false,30),{raw:{width:256,height:256,channels:3}}).png().toFile(`${dir}/surroundings-40kpc-30x.png`);
    console.log(JSON.stringify({sentinel:'LMC_VERSION_COMPLETE',version:stage,sheet:`${dir}/sheet.png`}));
  }
  const tiles=await Promise.all(Array.from({length:through},(_,i)=>sharp(`${OUT}l${i+1}/sheet.png`).resize(576,503).png().toBuffer()));
  await sharp({create:{width:576*through,height:503,channels:3,background:'#101216'}}).composite(tiles.map((input,i)=>({input,left:i*576,top:0}))).png().toFile(`${OUT}all-versions.png`);
  console.log(JSON.stringify({sentinel:'LMC_ALL_REQUESTED_VERSIONS_COMPLETE',through,overview:`${OUT}all-versions.png`}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
