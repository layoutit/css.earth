/** Continuous published density shapes plus source-derived surfaces. No image samples. */
import { at, type Sources } from './inputs.mts';
import { BAR_ANGLE, BAR_OFFSET, DISTANCE, DEG,rayInBody,type V3 } from './geometry.mts';
export const SIGMA_DISC=7416.50/3600*DEG*DISTANCE;
export const HEIGHT_DISC=.23*SIGMA_DISC;
export const BAR_RATIO=.38, BAR_VERTICAL_RATIO=.23;
// Preserve the physical scale of Kacharov's adopted deprojection, then rotate it.
export function projectedBarAxes(p:number,q:number,inclination:number,tip:number):[number,number] {
  // Binney projection in Kacharov equation 5; eigenvalues of the projected covariance.
  const s=Math.sin(tip),c=Math.cos(tip),ci=Math.cos(inclination),si=Math.sin(inclination);
  const a=s*s+p*p*c*c,b=ci*ci*(c*c+p*p*s*s)+q*q*si*si,off=ci*s*c*(1-p*p);
  const delta=Math.hypot(a-b,2*off);return [Math.sqrt((a+b+delta)/2),Math.sqrt((a+b-delta)/2)];
}
const projectedMajor=projectedBarAxes(BAR_RATIO,BAR_VERTICAL_RATIO,25*DEG,-61.3*DEG)[0];
export const SIGMA_BAR=(4271.76/3600*DEG*DISTANCE)/projectedMajor;
export const BAR_LUMINOSITY=117.02*4271.76**2*.37/(55.54*7416.50**2*.91);
const SQRT2PI=Math.sqrt(2*Math.PI);
export const EXTINCTION_RGB=[.75,1,1+1/3.41];
export const FOREGROUND_EBV=.06; // Chen foreground mean; fixed proxy, not a retrieved spatial foreground map.
export const gaussian=(z:number,s:number)=>Math.exp(-.5*(z/s)**2)/(SQRT2PI*s);
export const smoothstep=(t:number)=>{const q=Math.max(0,Math.min(1,t));return q*q*(3-2*q);};
export function discSurface(r:number):number {return Math.exp(-.5*(r/SIGMA_DISC)**2)/(2*Math.PI*SIGMA_DISC**2);}
export function exponentialSurface(r:number,h=1.4):number {return Math.exp(-r/h)/(2*Math.PI*h*h);}
// The observed outer power law is continued inward with the measured disc scale
// as a core. This interpolation is assumed; it creates no independent inner hole.
function outerRaw(r:number):number {return ((r*r+SIGMA_DISC**2)/(11.3**2+SIGMA_DISC**2))**-1.1*(1-smoothstep((r-18)/1));}
let outerNorm=0;for(let r=11.31;r<19;r+=.02)outerNorm+=outerRaw(r)*2*Math.PI*r*.02;
export function outerSurface(r:number):number {return Math.max(0,.004*(1+BAR_LUMINOSITY)*outerRaw(r)/outerNorm-discSurface(r));}
export interface Model {stage:number;kept:readonly number[];sources:Sources;gasAvailable:boolean;youngBudget:number;sampleField?:(x:number,y:number,z:number,out:Float64Array)=>void;}
export const has=(model:Model,stage:number)=>model.kept.includes(stage);
const earthOrigin=rayInBody([0,0,1]).origin;
/** Conditional depth must preserve measured sky positions, as for native stars. */
export function gasFootpoint(model:Model,x:number,y:number,z:number):V3 {
  const dx=x-earthOrigin[0],dy=y-earthOrigin[1],dz=z-earthOrigin[2];let f=-earthOrigin[2]/dz,xx=earthOrigin[0]+f*dx,yy=earthOrigin[1]+f*dy,zz=0;
  for(let i=0;i<3;i++){zz=has(model,3)?at(model.sources.warp,xx,yy):0;f=(zz-earthOrigin[2])/dz;xx=earthOrigin[0]+f*dx;yy=earthOrigin[1]+f*dy;}
  return [xx,yy,zz];
}
export function barSurface(x:number,y:number):number {
  const dx=x-BAR_OFFSET[0],dy=y-BAR_OFFSET[1],xx=Math.cos(BAR_ANGLE)*dx+Math.sin(BAR_ANGLE)*dy,yy=-Math.sin(BAR_ANGLE)*dx+Math.cos(BAR_ANGLE)*dy;
  return BAR_LUMINOSITY*Math.exp(-.5*((xx/SIGMA_BAR)**2+(yy/(SIGMA_BAR*BAR_RATIO))**2))/(2*Math.PI*SIGMA_BAR**2*BAR_RATIO);
}
export function createModel(stage:number,kept:readonly number[],sources:Sources):Model {
  const map=sources.youngCoverage,dx=2*map.half/map.n;let youngBudget=0;
  for(let j=0;j<map.n;j++)for(let i=0;i<map.n;i++){
    const x=-map.half+(i+.5)*dx,y=-map.half+(j+.5)*dx;
    youngBudget+=map.values[j*map.n+i]*(discSurface(Math.hypot(x,y))+(kept.includes(2)?barSurface(x,y):0))*dx*dx;
  }
  return {stage,kept,sources,gasAvailable:sources.gas.mask.some(v=>v>0),youngBudget};
}
/** 15 emissivity values: disc RGB, bar RGB, outer RGB, young RGB, line RGB; then kappaV. */
export function sampleModel(model:Model,x:number,y:number,z:number,out:Float64Array):void {
  if(model.sampleField){model.sampleField(x,y,z,out);return;}
  out.fill(0);const r=Math.hypot(x,y);if(r>20||Math.abs(z)>12)return;
  const warp=has(model,3)?at(model.sources.warp,x,y):0;
  const zz=z-warp,vertical=gaussian(zz,HEIGHT_DISC),youngOn=has(model,5),coverage=youngOn?at(model.sources.youngCoverage,x,y):0,fy=youngOn?model.sources.youngFraction*coverage:0;
  const d=discSurface(r)*vertical*(1-fy),color=model.sources.oldColor;
  for(let c=0;c<3;c++)out[c]=d*color[c];
  if(has(model,2)){
    const b=barSurface(x,y)*gaussian(zz,SIGMA_BAR*BAR_VERTICAL_RATIO)*(1-fy);
    for(let c=0;c<3;c++)out[3+c]=b*color[c];
  }
  if(has(model,4))for(let c=0;c<3;c++)out[6+c]=outerSurface(r)*vertical*color[c];
  if(youngOn&&!model.sources.nativeStars)for(let c=0;c<3;c++)out[9+c]=at(model.sources.young[c],x,y)*vertical*fy*model.youngBudget;
  if(has(model,6))out[15]=at(model.sources.dust,x,y)*gaussian(zz,HEIGHT_DISC/2);
  if(has(model,7)&&model.gasAvailable){
    const verticalGas=gaussian(zz,HEIGHT_DISC/2);
    if(verticalGas>1e-14){
      // A vertical extrusion blurs the known H-alpha sky map. Lift its samples
      // along their measured Earth rays through the same conditional thin layer.
      const p=gasFootpoint(model,x,y,z),intrinsic=at(model.sources.gas,p[0],p[1])*Math.exp(at(model.sources.dust,p[0],p[1])*.75/(2*Math.cos(25.86*DEG)));
      const j=intrinsic*verticalGas;for(let c=0;c<3;c++)out[12+c]=j;
    }
  }
}
