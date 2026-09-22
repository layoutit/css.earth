import { isArray } from '../../../src/platform/is-array.mts';
import type {encounterCamera} from './encounter-camera.mts';
import {parseEncounterRegistration} from './source-records.mts';
const dot=(a: readonly number[],b: readonly number[])=>a.reduce((s,n,i)=>s+n*b[i],0);
const vector=(v: unknown,n: number): v is number[] =>isArray(v)&&v.length===n&&v.every(Number.isFinite);
/** Recompute the residuals from source coordinates. Reported RMS values alone
 * cannot authorize a camera: every fit and holdout coordinate is checked. */
export function validateEncounterControls(camera: Pick<ReturnType<typeof encounterCamera>,"project"> & {report:Pick<ReturnType<typeof encounterCamera>["report"],"nominalPixelScaleMeters">}, registration: unknown) {
  const r=parseEncounterRegistration(registration);
  if (!r || !['disjoint-limb-normal-translation','source-topography-feature-translation','registered-image-feature-translation'].includes(r.method) ||
      !isArray(r.controls) || !Number.isFinite(r.maximumRmsMeters) || r.maximumRmsMeters<=0 || r.maximumRmsMeters>100 ||
      !Number.isFinite(r.maximumResidualMeters) || r.maximumResidualMeters<r.maximumRmsMeters || r.maximumResidualMeters>200 ||
      !Number.isFinite(r.nominalPixelScaleMeters) || r.nominalPixelScaleMeters<=0 || !r.limitations ||
      new Set(r.controls.map(p=>p.id)).size!==r.controls.length) throw new Error('Missing source-bound encounter registration.');
  if (Math.abs(r.nominalPixelScaleMeters-camera.report.nominalPixelScaleMeters)>1e-6) throw new Error('Registration pixel scale differs from the source camera.');
  if(r.method==='registered-image-feature-translation' && (!r.reference || !r.reference.id || r.controls.some(p=>!vector(p.referencePixel,2)||p.normal!==undefined||p.projectionOffsetPixels!==undefined) || r.maximumRmsMeters>r.nominalPixelScaleMeters || r.maximumResidualMeters>2*r.nominalPixelScaleMeters))throw new Error('Image overlap registration requires pinned reference pixels and a one-pixel RMS budget.');
  const residuals: Record<"fit"|"holdout",number[]>={fit:[],holdout:[]};
  for (const p of r.controls) {
    if (!p.id || !['fit','holdout'].includes(p.partition) || !vector(p.sourcePointMeters,3) || !vector(p.sourcePixel,2) ||
        (p.projectionOffsetPixels!==undefined && (!vector(p.projectionOffsetPixels,2) || Math.hypot(...p.projectionOffsetPixels)>.500001))) throw new Error('Invalid encounter registration control.');
    const projected=camera.project(p.sourcePointMeters);
    if (!projected) throw new Error('Registration control lies behind the camera.');
    const delta=p.sourcePixel.map((n,i)=>n-projected[i]-(p.projectionOffsetPixels?.[i]??0));
    let residual;
    if(r.method==='disjoint-limb-normal-translation') {
      if(!vector(p.normal,2) || Math.abs(Math.hypot(...p.normal)-1)>1e-8)throw new Error('Invalid limb normal.');
      residual=Math.abs(dot(delta,p.normal));
    } else residual=Math.hypot(...delta);
    residuals[p.partition].push(residual);
  }
  const report: Partial<Record<"fit"|"holdout",{count:number;rmsPixels:number;maximumPixels:number;rmsMeters:number;maximumMeters:number}>>={};
  for(const partition of ['fit','holdout'] as const) {
    const a=residuals[partition];
    if(a.length<6)throw new Error('Encounter registration requires six separate fit and holdout controls.');
    const rmsPixels=Math.sqrt(a.reduce((s,n)=>s+n*n,0)/a.length),maximumPixels=Math.max(...a);
    report[partition]={count:a.length,rmsPixels,maximumPixels,rmsMeters:rmsPixels*r.nominalPixelScaleMeters,maximumMeters:maximumPixels*r.nominalPixelScaleMeters};
    if(report[partition]!.rmsMeters>r.maximumRmsMeters || report[partition]!.maximumMeters>r.maximumResidualMeters)throw new Error('Encounter camera exceeds its source-scale registration budget.');
  }
  return {method:r.method,...report,...(r.reference?{reference:r.reference}:{}),nominalPixelScaleMeters:r.nominalPixelScaleMeters,maximumRmsMeters:r.maximumRmsMeters,maximumResidualMeters:r.maximumResidualMeters,limitations:r.limitations};
}
