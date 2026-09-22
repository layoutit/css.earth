/** Bounded observation-constrained shape comparison, independent of image materials. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,sourceBytes} from '@cssearth/volume-bake/compact-inputs/density-grid';
import {fitForwardModel,evaluateForwardModel,transformForwardPoint,FORWARD_PARAMETER_KEYS,
 type ForwardParameters,type ParameterBounds,type FitOptions,type ForwardFit,type ForwardEvaluation} from '@cssearth/nebula-reconstruction/registration/forward-density-fit';
import {fitRegionalWeights,applyRegionalWeights} from '@cssearth/nebula-reconstruction/registration/regional-density-weights';
import {record,string,finite,pin,forwardFitData,samplePoints,ellipsoidPoints} from './forward-fit-data.ts';
const json=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
function parameters(value:unknown):ForwardParameters{const p=record(value);const entries=FORWARD_PARAMETER_KEYS.map(k=>[k,finite(p[k])]);return Object.fromEntries(entries) as unknown as ForwardParameters;}
function bounds(value:unknown):ParameterBounds{const p=record(value);const entries=FORWARD_PARAMETER_KEYS.map(k=>{const v=p[k];if(!Array.isArray(v)||v.length!==2)throw new TypeError('Missing parameter bounds');return [k,[finite(v[0]),finite(v[1])]];});return Object.fromEntries(entries) as unknown as ParameterBounds;}
const summary=(fit:ForwardEvaluation)=>({parameters:fit.parameters,amplitude:fit.amplitude,train:fit.train,validation:fit.validation});
export async function fitTracerDensity(recipePath:string){
 const root=process.cwd(),recipeBytes=await readFile(recipePath),config=record(JSON.parse(recipeBytes.toString('utf8')) as unknown);
 if(config.schema!=='cssearth-tracer-forward-fit@1')throw new TypeError('Unsupported fit recipe');
 const out=string(config.outputDirectory),output=resolve(root,out);
 if(!out.startsWith('.local/nebula-lab/')||relative(resolve(root,'.local/nebula-lab'),output).startsWith('..'))throw new TypeError('Output must stay in the local cache');
 await mkdir(output,{recursive:true});await sourceBytes(root,pin(config.observedReceipt));
 const data=await forwardFitData(root,config),range=bounds(config.bounds),search=record(config.search);
 const options:FitOptions={maxSweeps:finite(search.maxSweeps),refinements:finite(search.refinements),initialStepFraction:finite(search.initialStepFraction)};
 if(!Array.isArray(config.starts)||!config.starts.length)throw new TypeError('Missing starts');const starts=config.starts.map(parameters);
 if(!Array.isArray(config.sensitivitySigmaMag))throw new TypeError('Missing uncertainty sensitivity');const sigmas=config.sensitivitySigmaMag.map(finite);
 const simulations=data.simulation,ellipsoid=ellipsoidPoints(finite(config.ellipsoidParticles),finite(config.seed),finite(config.ellipsoidSigmaKpc));
 const families=[{id:'simulation',full:simulations},{id:'ellipsoid',full:ellipsoid}];
 const outputs:unknown[]=[];
 console.log('FORWARD_DATA',JSON.stringify(data.diagnostics));
 for(const family of families){
  const points=samplePoints(family.full,finite(config.fitParticles));
  // Each start competes on training score only; held-out scores are not used to choose parameters.
  let best:ForwardFit|undefined;const searches:unknown[]=[];
  for(let i=0;i<starts.length;i++){
   const fitted=fitForwardModel(points,data.observations,data.forward,range,[starts[i]!],options);
   searches.push({start:i,...summary(fitted),evaluations:fitted.evaluations});
   console.log('FORWARD_START',family.id,i,JSON.stringify({train:fitted.train.deviancePerObservedCount,validation:fitted.validation.deviancePerObservedCount}));
   if(!best||fitted.train.deviance<best.train.deviance)best=fitted;
  }
  if(!best)throw new Error('No fitted model');
  const refinement=record(config.refinement),refinementPoints=samplePoints(family.full,finite(config.refineParticles));
  best=fitForwardModel(refinementPoints,data.observations,data.forward,range,[best.parameters],{maxSweeps:finite(refinement.maxSweeps),refinements:finite(refinement.refinements),initialStepFraction:finite(refinement.initialStepFraction)});
  console.log('FORWARD_REFINED',family.id,best.validation.deviancePerObservedCount);
  const sensitivity=[];
  for(const sigmaMag of sigmas){
   const trial=fitForwardModel(refinementPoints,data.observations,{...data.forward,sigmaMag:Math.hypot(sigmaMag,data.diagnostics.medianPhotometricErrorMag)},range,[best.parameters],{...options,refinements:2,maxSweeps:2,initialStepFraction:.03});
   sensitivity.push({sigmaMag,...summary(trial),parametersAtBounds:trial.parametersAtBounds});
   console.log('FORWARD_SENSITIVITY',family.id,sigmaMag,trial.validation.deviancePerObservedCount);
  }
  const affineEvaluation=evaluateForwardModel(family.full,data.observations,data.forward,best.parameters);
  let bakePoints=family.full;
  let regional:unknown=null;
  if(family.id==='simulation'){
   const r=record(config.regional),limits=r.bounds;
   if(!Array.isArray(limits)||limits.length!==2)throw new TypeError('Missing regional bounds');
   const settings={spatialScale:finite(r.spatialScale),bounds:[finite(limits[0]),finite(limits[1])] as const,regularization:finite(r.regularization),maxSweeps:finite(r.maxSweeps),refinements:finite(r.refinements)};
   const weighted=fitRegionalWeights(refinementPoints,best.parameters,data.observations,data.forward,settings);
   bakePoints=applyRegionalWeights(family.full,weighted.coefficients,settings.spatialScale);
   regional={settings,coefficients:weighted.coefficients,coefficientsAtBounds:weighted.coefficientsAtBounds,regularizationPenalty:weighted.regularizationPenalty,evaluations:weighted.evaluations,affineBaseline:summary(affineEvaluation),
    fixedGeometrySensitivity:sigmas.map(sigmaMag=>({sigmaMag,...summary(evaluateForwardModel(bakePoints,data.observations,{...data.forward,sigmaMag:Math.hypot(sigmaMag,data.diagnostics.medianPhotometricErrorMag)},best.parameters))}))};
  }
  const fullEvaluation=evaluateForwardModel(bakePoints,data.observations,data.forward,best.parameters);
  const bytes=Buffer.alloc(family.full.length*16);
  for(let i=0;i<family.full.length;i++){
   const p=transformForwardPoint(bakePoints[i]!,best.parameters);[p.x,p.y,p.z,p.weight].forEach((v,j)=>bytes.writeFloatLE(v,i*16+j*4));
  }
  const particlePath=`${out}/${family.id}.f32`;await writeFile(resolve(root,particlePath),bytes);
  const histogram=Buffer.alloc(fullEvaluation.expected.length*4);fullEvaluation.expected.forEach((v,i)=>histogram.writeFloatLE(v,i*4));
  await writeFile(resolve(output,`${family.id}-expected.f32`),histogram);
  const result={family:family.id,...summary(best),fullParticleEvaluation:summary(fullEvaluation),regional,affineRefitSensitivity:sensitivity,searches,
   activeBounds:best.parametersAtBounds.filter(k=>range[k][0]!==range[k][1]),particles:{path:particlePath,sha256:sha256(bytes),count:family.full.length}};
  const codePins=await Promise.all(['labs/nebula/packages/reconstruction/src/registration/regional-density-weights.ts','labs/nebula/packages/reconstruction/src/registration/forward-density-fit.ts','labs/nebula/packages/lab/src/cli/commands/forward-fit-data.ts','labs/nebula/packages/lab/src/cli/commands/fit-tracer-density.ts'].map(async path=>({path,sha256:sha256(await readFile(resolve(root,path)))})));
  const receipt={codePins,schema:'cssearth-constrained-tracer-fit@1',recipe:{path:relative(root,resolve(recipePath)),sha256:sha256(recipeBytes)},
   inputs:{simulation:config.simulation,catalogue:config.catalogue,footprint:config.footprint,observedReceipt:config.observedReceipt,frameObject:config.frameObject},
   simulationCenter:data.center,forwardModel:data.forward,selection:data.diagnostics,result,
   interpretation:config.interpretation,limitations:config.limitations,materialGatePassed:false,
   status:'conditional-neutral-comparison-not-qualified-physical-density'};
  const receiptPath=`${out}/${family.id}-receipt.json`,receiptBytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');await writeFile(resolve(root,receiptPath),receiptBytes);
  const bakePath=`${out}/${family.id}-bake.json`;await json(resolve(root,bakePath),{
   schema:'cssearth-tracer-density@1',id:`${string(config.id)}-${family.id}`,outputDirectory:`${out}/${family.id}-volume`,
   particles:result.particles,receipt:{path:receiptPath,sha256:sha256(receiptBytes)},frameObject:config.frameObject,
   interpretation:config.interpretation,limitations:config.limitations});
  outputs.push({...result,bakePath,receiptPath});
  console.log('FORWARD_FIT_READY',family.id,JSON.stringify({fullTrain:fullEvaluation.train.deviancePerObservedCount,fullValidation:fullEvaluation.validation.deviancePerObservedCount,parameters:best.parameters}));
 }
 await json(resolve(output,'comparison.json'),{schema:'cssearth-tracer-fit-comparison@1',data:data.diagnostics,models:outputs,
  note:'Lower withheld deviance indicates better prediction within the declared footprint and uncertainty model; it does not validate unobserved geometry.'});
 console.log('FORWARD_COMPARISON_READY',out);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const path=process.argv[2];if(!path||process.argv[3])throw Error('Usage: fit-tracer-density <recipe.json>');await fitTracerDensity(path);}
