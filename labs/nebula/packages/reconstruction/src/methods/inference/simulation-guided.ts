/** Image-fitted finite emission, conditionally placed inside a sampled simulation depth prior. */
import { createHash } from 'node:crypto';
import { fitEmissionField } from './fit.ts';
import { createEmissionField, createEmissionMaterial, type MaterialImage, readCompilerControls, type EmissionFitInput, type EmissionComponent, type EmissionFieldModel, type EmissionBounds } from '@cssearth/bake/volume';
export interface SimulationDepthPrior {
  /** SHA-256 identity of the pinned source and its sampling transform. */
  identity: string;
  bounds: EmissionBounds;
  /** Same angular/tangent XYZ units as the field. Caller owns any physical ray mapping. */
  sampleDensity(x:number,y:number,z:number):number;
}
export interface SimulationDepthSettings {
  depthSamples:number;modeRelativeThreshold:number;maximumModes:number;
  minimumSigmaZ:number;maximumSigmaZ:number;featureThicknessRatio:number;supportSigma:number;
  /** A deterministic conditional draw assigns each finite feature one depth; it never repeats the image along a ray. */
  placement?:'modes'|'conditional-quantile';
}
export interface SimulationDepthAssignment {
  sourceComponentId:string;componentIds:string[];supported:boolean;profileMass:number;
  modes:{center:number;sigma:number;priorWeight:number}[];
}
function validate(prior:SimulationDepthPrior,s:SimulationDepthSettings):void {
  if(!/^[a-f0-9]{64}$/.test(prior.identity)||typeof prior.sampleDensity!=='function'||prior.bounds.min.length!==3||prior.bounds.max.length!==3||
    prior.bounds.min.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(prior.bounds.max[i])||v>=prior.bounds.max[i]!))throw Error('Invalid pinned simulation depth prior');
  if(!Number.isInteger(s.depthSamples)||s.depthSamples<8||s.depthSamples>4096||!Number.isInteger(s.maximumModes)||s.maximumModes<1||s.maximumModes>8||
    !Number.isFinite(s.modeRelativeThreshold)||s.modeRelativeThreshold<=0||s.modeRelativeThreshold>1||
    !Number.isFinite(s.minimumSigmaZ)||s.minimumSigmaZ<=0||!Number.isFinite(s.maximumSigmaZ)||s.maximumSigmaZ<s.minimumSigmaZ||
    !Number.isFinite(s.featureThicknessRatio)||s.featureThicknessRatio<=0||s.supportSigma!==4||
    8*s.minimumSigmaZ>prior.bounds.max[2]-prior.bounds.min[2]||
    (s.placement!==undefined&&s.placement!=='modes'&&s.placement!=='conditional-quantile')||
    (s.placement==='conditional-quantile'&&s.maximumModes!==1))throw Error('Invalid finite-depth settings; emission kernels have fixed ±4σ support');
}
/** Depth probabilities come only from the prior. Image intensity controls projected weight, never depth. */
export function conditionSimulationComponents(components:readonly EmissionComponent[],prior:SimulationDepthPrior,settings:SimulationDepthSettings,signal?:AbortSignal) {
  validate(prior,settings);
  const n=settings.depthSamples,zMin=prior.bounds.min[2],zMax=prior.bounds.max[2],dz=(zMax-zMin)/n;
  const conditioned:EmissionComponent[]=[],assignments:SimulationDepthAssignment[]=[];
  let unsupported=0,totalLight=0,unsupportedLight=0;
  for(const component of components) {
    signal?.throwIfAborted();
    if(component.center.some(v=>!Number.isFinite(v))||component.sigma.some(v=>!Number.isFinite(v)||v<=0)||!Number.isFinite(component.projectedWeight)||component.projectedWeight<0)throw Error('Invalid source emission component');
    const profile=new Float64Array(n),sampleWeights=[.25,.5,.25];
    for(let i=0;i<n;i++)for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
      const x=component.center[0]+ox*component.sigma[0],y=component.center[1]+oy*component.sigma[1],z=zMin+(i+.5)*dz;
      if(x<prior.bounds.min[0]||x>prior.bounds.max[0]||y<prior.bounds.min[1]||y>prior.bounds.max[1])continue;
      const density=prior.sampleDensity(x,y,z);if(!Number.isFinite(density)||density<0)throw Error('Prior returned invalid density');
      profile[i]!+=density*sampleWeights[ox+1]!*sampleWeights[oy+1]!;
    }
    const smoothed=profile.map((v,i)=>(profile[Math.max(0,i-1)]!+2*v+profile[Math.min(n-1,i+1)]!)/4);
    const mass=profile.reduce((a,b)=>a+b,0),peak=smoothed.reduce((a,b)=>Math.max(a,b),0);
    const light=component.projectedWeight*component.sigma[0]*component.sigma[1];totalLight+=light;
    let peaks:number[]=[];
    if(mass>0) {
      // One deterministic representative for flat maxima; no random front/back assignment.
      for(let i=0;i<n;i++)if(smoothed[i]!>=peak*settings.modeRelativeThreshold&&smoothed[i]!>0&&
        (i===0||smoothed[i]!>smoothed[i-1]!)&&(i===n-1||smoothed[i]!>=smoothed[i+1]!))peaks.push(i);
      peaks=peaks.sort((a,b)=>smoothed[b]!-smoothed[a]!||a-b).slice(0,settings.maximumModes).sort((a,b)=>a-b);
    }
    const modes:{center:number;sigma:number;priorWeight:number}[]=[];
    if(mass>0&&settings.placement==='conditional-quantile') {
      // The salt is the pinned prior, not image intensity or colour. Component IDs identify the fitted support.
      const quantile=(createHash('sha256').update(prior.identity+':'+component.id).digest().readUInt32BE(0)+.5)/4294967296;
      let cumulative=0,index=0;
      for(;index<n-1;index++){if(cumulative+profile[index]!>=quantile*mass)break;cumulative+=profile[index]!;}
      const fraction=profile[index]!>0?(quantile*mass-cumulative)/profile[index]!:0.5;
      const sigma=Math.min(settings.maximumSigmaZ,Math.max(settings.minimumSigmaZ,Math.min(component.sigma[0],component.sigma[1])*settings.featureThicknessRatio),(zMax-zMin)/8);
      const center=zMin+(index+fraction)*dz;
      if(center-4*sigma<zMin||center+4*sigma>zMax)throw Error('Conditional depth kernel exceeds the prior bounds; do not clamp its draw');
      modes.push({center,sigma,priorWeight:1});
    } else if(peaks.length) {
      const boundaries=[0];for(let m=0;m<peaks.length-1;m++){let valley=peaks[m]!;for(let i=peaks[m]!;i<=peaks[m+1]!;i++)if(smoothed[i]!<smoothed[valley]!)valley=i;boundaries.push(valley+1);}boundaries.push(n);
      const modeMass=peaks.map((_,m)=>{let sum=0;for(let i=boundaries[m]!;i<boundaries[m+1]!;i++)sum+=profile[i]!;return sum;});
      for(let m=0;m<peaks.length;m++) {
        const p=peaks[m]!;let left=p,right=p;
        while(left>boundaries[m]!&&smoothed[left-1]!>=smoothed[p]!*.5)left--;
        while(right+1<boundaries[m+1]!&&smoothed[right+1]!>=smoothed[p]!*.5)right++;
        const localSigma=Math.max(dz/2,(right-left+1)*dz/2.354820045);
        const sigma=Math.min(settings.maximumSigmaZ,Math.max(settings.minimumSigmaZ,Math.min(localSigma,Math.min(component.sigma[0],component.sigma[1])*settings.featureThicknessRatio)));
        const maxSigma=Math.min(sigma,(zMax-zMin)/8);
        const center=Math.max(zMin+4*maxSigma,Math.min(zMax-4*maxSigma,zMin+(p+.5)*dz));
        modes.push({center,sigma:maxSigma,priorWeight:modeMass[m]!/mass});
      }
    } else {
      if(settings.placement==='conditional-quantile')throw Error('Conditional depth requires positive prior support for every finite feature');
      unsupported++;unsupportedLight+=light;
      const sigma=Math.min(settings.maximumSigmaZ,Math.max(settings.minimumSigmaZ,Math.min(component.sigma[0],component.sigma[1])*settings.featureThicknessRatio),(zMax-zMin)/8);
      const center=Math.max(zMin+4*sigma,Math.min(zMax-4*sigma,0));
      modes.push({center,sigma,priorWeight:1});
    }
    const ids:string[]=[];
    for(let m=0;m<modes.length;m++) {
      const mode=modes[m]!,id=`${component.id}-prior-${m}`;ids.push(id);
      conditioned.push({...component,id,center:[component.center[0],component.center[1],mode.center],sigma:[component.sigma[0],component.sigma[1],mode.sigma],
        projectedWeight:component.projectedWeight*mode.priorWeight,depthAssignment:mass>0?'simulation-prior':'unsupported-local',velocityCovered:false,depthGradient:undefined});
    }
    assignments.push({sourceComponentId:component.id,componentIds:ids,supported:mass>0,profileMass:mass*dz,modes});
  }
  return {components:conditioned,assignments,unsupportedComponents:unsupported,unsupportedComponentFraction:components.length?unsupported/components.length:0,
    unsupportedProjectedLightFraction:totalLight>0?unsupportedLight/totalLight:0};
}
export function fitSimulationGuidedEmission(input:EmissionFitInput,requestedControls:unknown,prior:SimulationDepthPrior,settings:SimulationDepthSettings,
  options:{signal?:AbortSignal;onProgress?(message:string):void;maximumComponents?:number}={}) {
  validate(prior,settings);const controls=readCompilerControls(requestedControls);
  if(controls.depth!==1)throw Error('Simulation-guided depth uses the pinned prior at depth=1; global stretching is not implicit');
  const fitted=fitEmissionField(input,controls,{...options,externalDepthAssignment:true});
  options.onProgress?.(`Conditioning ${fitted.field.components.length} finite image supports on simulation depth modes…`);
  const conditioned=conditionSimulationComponents(fitted.field.components,prior,settings,options.signal);
  const field:EmissionFieldModel={...fitted.field,components:conditioned.components,identity:'',scaffold:null,
    assumptions:{...fitted.field.assumptions,equalNearFarSplit:false,velocityUncoveredComponents:conditioned.components.length,
      depth:settings.placement==='conditional-quantile'?
        'Each finite image feature receives one deterministic conditional depth draw from the pinned density prior. This is an authored realization of a published bulk model, not measured individual stellar depths. Image intensity and colour do not choose the draw; no feature is copied through the line of sight. Finite feature thickness is authored.':
        'Image-fitted emission weights on finite components; source density supplies conditional ray-depth modes, not gas measurements. Local component thickness is bounded by feature size and prior mode width. With one selected mode, the strongest prior peak receives the entire feature weight as an authored dominant-mode hypothesis. Multiple selected modes receive their normalized basin masses. Image intensity never sets depth.',
      halo:settings.placement==='conditional-quantile'?
        'Every finite feature requires positive conditional prior support; unsupported features or draws whose kernels exceed the prior bounds reject the fit. No midplane fallback or inward-clamped draws.':
        'Unsupported features remain at an explicitly authored local depth with finite feature-sized thickness and are counted separately. No image repetition across a global depth tube.'}};
  field.bounds=createEmissionField(field).bounds;
  field.identity=createHash('sha256').update(JSON.stringify({field,prior:prior.identity,settings,assignments:conditioned.assignments})).digest('hex');
  const prepared=createEmissionField(field);
  // The finite kernel integrates exactly to projectedWeight, independent of its assigned Z and sigmaZ.
  return {field,sampleEmission:prepared.sampleEmission,material:(image:MaterialImage)=>createEmissionMaterial(field,image,prepared),
    projection:fitted.projection,residual:fitted.residual,coverage:fitted.coverage,unassigned:fitted.unassigned,
    metrics:{...fitted.metrics,componentCount:field.components.length,unsupportedComponents:conditioned.unsupportedComponents,
      unsupportedComponentFraction:conditioned.unsupportedComponentFraction,unsupportedProjectedLightFraction:conditioned.unsupportedProjectedLightFraction},
    depthAssignments:conditioned.assignments,priorIdentity:prior.identity,settings};
}
