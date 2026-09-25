import {createHash} from 'node:crypto';
import type { ObservationMapping, Bounds3, Vector3 } from '@cssearth/bake/volume';
export interface JointDepthSource {mapping:ObservationMapping;supportBounds:Bounds3;densityAt(x:number,y:number,z:number):number;sampleEmission(x:number,y:number,z:number,out:Vector3):void}
export function sampleJointDepth(model:JointDepthSource,x0:number,y0:number,id:string):number{
  const {mapping}=model;
  const [lower, upper] = [model.supportBounds.min[2], model.supportBounds.max[2]];
  if (!(lower > -mapping.distanceUnits) || !(upper > lower)) throw new TypeError('Joint depth bounds cross the observer.');
  const steps = 1536, dz = (upper-lower)/steps, weights=new Float64Array(steps+1);
  const emission:[number,number,number]=[0,0,0];
  const weight=(z:number)=>{
    const density=model.densityAt(...mapping.pointAtDepth(x0,y0,z));
    model.sampleEmission(x0,y0,z,emission);
    return Math.max(...emission)*density*(1+z/mapping.distanceUnits)**2;
  };
  let total=0;
  for(let i=0;i<=steps;i++) { weights[i]=weight(lower+i*dz); if(i) total+=(weights[i-1]+weights[i])*.5*dz; }
  if(!(total>0) || !Number.isFinite(total)) throw new Error(`No joint stellar and cloud emission supports measured sky ray: ${id}`);
  const quantile=(createHash('sha256').update(`cssearth-joint-star-depth@1:${id}`).digest().readUInt32BE(0)+.5)/2**32;
  let remaining=total*quantile;
  for(let i=0;i<steps;i++) {
    const a=weights[i],b=weights[i+1],mass=(a+b)*.5*dz;
    if(mass<=0)continue;
    if(remaining>mass){remaining-=mass;continue;}
    const t=remaining/dz,denominator=a+Math.sqrt(Math.max(0,a*a+2*(b-a)*t));
    const fraction=denominator>0?2*t/denominator:0, z=lower+(i+Math.max(0,Math.min(1,fraction)))*dz;
    // A piecewise-linear CDF must never bridge a true zero-support gap silently.
    if(!(weight(z)>0))throw new Error(`Joint CDF crossed a zero-support gap: ${id}`);
    return z;
  }
  throw new Error(`Joint depth integration failed: ${id}`);
}
