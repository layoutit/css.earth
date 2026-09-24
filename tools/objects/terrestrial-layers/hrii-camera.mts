import { cross3 as cross } from '../../../src/platform/vector3.mts';
import {array,number,shape,requireRecord} from '@cssearth/core';
import {equatorialVector,validateBodyFrame} from './encounter-camera.mts';

const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,v,i)=>s+v*b[i],0);

const unit=(a:number[])=>{const norm=Math.hypot(...a);if(!(norm>0))throw new Error('Degenerate HRII direction.');return a.map(v=>v/norm);};
const parseControl=shape({bodyToJ2000:array(array(number)),offsetPixels:array(number)});

/** Reconstructed HRII boresight and along-slit coordinates. Across-slit zero
 * is the slit centre; detector columns remain wavelength throughout. */
export function hriiCamera(value:unknown,sourceControl:unknown) {
  const h=requireRecord(value),control=parseControl(sourceControl);
  validateBodyFrame(control.bodyToJ2000);
  if(h.GEOMSTAT!=='OK'||h.GEOMQUAL!=='RECONSTRUCTED'||h.INSTRUME!=='HRIIR'||h.DNAXIS1!=='+WAVELENGTH'||h.DNAXIS2!=='UP, -Yinstr')throw new Error('Unqualified HRII pointing metadata.');
  if(control.offsetPixels.length!==2||control.offsetPixels.some(x=>Math.abs(x)>32))throw new Error('Invalid HRII pointing correction.');
  const R=control.bodyToJ2000,toBody=(v:number[])=>[0,1,2].map(i=>R.reduce((s,row,j)=>s+row[i]*v[j],0));
  const eye=toBody(['X','Y','Z'].map(a=>number(h[`TARSCR${a}`])*1000));
  const sun=toBody(['X','Y','Z'].map(a=>number(h[`TARSUNR${a}`])*1000));
  const b=equatorialVector(number(h.BORERA),number(h.BOREDEC)),east=equatorialVector(number(h.BORERA)+90,0),north=cross(b,east),angle=number(h.CELESTN)*Math.PI/180;
  const right=toBody(east.map((v,i)=>-v*Math.cos(angle)+north[i]*Math.sin(angle)));
  const up=toBody(east.map((v,i)=>v*Math.sin(angle)+north[i]*Math.cos(angle))),forward=toBody(b);
  const scale=number(h.PXLSCALE),rows=number(h.NAXIS2),focal=number(h.TARSCR)*1000/scale;
  if(scale<=0||focal<=0||!Number.isSafeInteger(rows)||![64,128,256].includes(rows))throw new Error('Invalid HRII spatial sampling.');
  const project=(point:readonly number[])=>{
    const d=point.map((v,i)=>v-eye[i]),z=dot(forward,d);
    return z>0?[focal*dot(right,d)/z+control.offsetPixels[0],focal*dot(up,d)/z+(rows-1)/2+control.offsetPixels[1],z]:null;
  };
  const ray=(row:number,acrossSlit=0)=>unit(forward.map((v,i)=>v+right[i]*(acrossSlit-control.offsetPixels[0])/focal+up[i]*(row-(rows-1)/2-control.offsetPixels[1])/focal));
  return {eye,sunDirection:unit(sun),heliocentricDistanceAu:Math.hypot(...sun)/149597870700,right,up,forward,focal,rows,scale,project,ray};
}

export interface HriiSurfaceControl {frame:number;row:number;sourcePointMeters:number[]}

/** Evaluate retained terrain controls in the detector plane at their measured
 * fractional scan times. The controls are withheld from the dense image fit. */
export function hriiControlResidual(cameras:ReturnType<typeof hriiCamera>[],frames:number[],control:HriiSurfaceControl) {
  if(!Number.isFinite(control.frame)||!Number.isFinite(control.row)||control.sourcePointMeters.length!==3||!control.sourcePointMeters.every(Number.isFinite))throw new Error('Invalid HRII terrain control.');
  const index=frames.findIndex((f,i)=>f<=control.frame&&(i===frames.length-1||frames[i+1]>control.frame));
  if(index<0||control.frame>frames.at(-1)!)throw new Error('Terrain control is outside the scan.');
  const a=cameras[index],b=cameras[Math.min(index+1,cameras.length-1)],span=(frames[Math.min(index+1,frames.length-1)]-frames[index]),t=span?(control.frame-frames[index])/span:0;
  const p=a.project(control.sourcePointMeters),q=b.project(control.sourcePointMeters);if(!p||!q)throw new Error('Terrain control is behind HRII.');
  const residual=[p[0]*(1-t)+q[0]*t,p[1]*(1-t)+q[1]*t-control.row];
  return {residualPixels:residual,distancePixels:Math.hypot(...residual),pixelScaleMeters:a.scale*(1-t)+b.scale*t};
}
