import {array,choice,number,shape,text} from './source-records.mts';
import {readEncounterHdus} from './encounter-fits.mts';
import {encounterCamera} from './encounter-camera.mts';
import {hriiCamera} from './hrii-camera.mts';
import type {SourceMesh} from './contracts.mts';
import type {decodeHriiSpectra} from './hrii-spectra.mts';

const point=array(number),pin=shape({path:text});
export const parseHriiContext=shape({path:text,reference:pin,offsetPixels:point,
  maximumRmsMeters:number,maximumResidualMeters:number,
  controls:array(shape({id:text,partition:choice('fit','holdout'),point,nativeSourcePixel:point,correlation:number,peakMargin:number}))});
export const parseHriiDenseFit=shape({rowStart:number,rowEnd:number,seedOffsetPixels:point,radiusPixels:number,stepPixels:number,
  region:choice('stereo-surface','surface-and-background'),minimumFitPixels:number,minimumCorrelation:number});
const unit=(v:number[])=>v.map(x=>x/Math.hypot(...v));
const correlation=([n,a,b,aa,bb,ab]:number[])=>n>2?(ab-a*b/n)/Math.sqrt((aa-a*a/n)*(bb-b*b/n)):NaN;

/** A visible context image anchors the scan in the existing source body frame.
 * Its terrain controls are measured inputs, with a disjoint fitting partition. */
export async function loadHriiContext(value:unknown,read:(path:string,sha?:string)=>Promise<Buffer>,mesh:SourceMesh,bodyToJ2000:number[][]) {
  const r=parseHriiContext(value),hdus=readEncounterHdus(await read(r.path)),image=hdus[0];
  const reference=shape({camera:shape({bodyToJ2000:array(point)})})(JSON.parse((await read(r.reference.path)).toString('utf8')));
  if(JSON.stringify(reference.camera.bodyToJ2000)!==JSON.stringify(bodyToJ2000)||image.header.INSTRUME!=='HRIVIS')throw new Error('HRII context uses a different source body frame or instrument.');
  const deconvolved=hdus.map(h=>h.name).join(',')==='PRIMARY,RESIDUAL,MASK';
  if(!deconvolved&&hdus.map(h=>h.name).join(',')!=='PRIMARY,FLAGS,SNR,DESTRIPE')throw new Error('Unsupported HRI context image.');
  const quality=hdus[deconvolved?2:1];
  if(quality.width!==image.width||quality.height!==image.height)throw new Error('Invalid context quality plane.');
  const nominal=encounterCamera(image.header,{bodyToJ2000,offsetPixels:[0,0],maximumOffsetPixels:96});
  const fit=r.controls.filter(c=>c.partition==='fit'),holdout=r.controls.filter(c=>c.partition==='holdout');
  if(fit.length<6||holdout.length<6||new Set(r.controls.map(c=>c.id)).size!==r.controls.length||r.controls.some(c=>c.point.length!==3||c.nativeSourcePixel.length!==2||c.correlation<.9||c.peakMargin<.06))throw new Error('Insufficient visible context terrain controls.');
  const offsets=fit.map(c=>{const p=nominal.project(c.point);if(!p)throw new Error('Context terrain is behind camera.');return c.nativeSourcePixel.map((x,i)=>x-p[i]);});
  const measured=[0,1].map(i=>offsets.reduce((s,o)=>s+o[i],0)/offsets.length);
  if(r.offsetPixels.length!==2||measured.some((v,i)=>Math.abs(v-r.offsetPixels[i])>1e-5))throw new Error('Context camera no longer reproduces its fitted pointing.');
  const camera=encounterCamera(image.header,{bodyToJ2000,offsetPixels:measured,maximumOffsetPixels:96});
  const residuals=holdout.map(c=>{const p=camera.project(c.point);if(!p)throw new Error('Context holdout is behind camera.');return {id:c.id,meters:Math.hypot(...c.nativeSourcePixel.map((v,i)=>v-p[i]))*camera.report.nominalPixelScaleMeters};});
  const rms=Math.sqrt(residuals.reduce((s,r)=>s+r.meters**2,0)/residuals.length),maximum=Math.max(...residuals.map(r=>r.meters));
  if(r.maximumRmsMeters<=0||r.maximumResidualMeters<r.maximumRmsMeters||rms>r.maximumRmsMeters||maximum>r.maximumResidualMeters)throw new Error('Visible context terrain holdouts exceed the infrared placement budget.');
  const sample=(point:readonly number[])=>{
    const pixel=camera.project(point);if(!pixel)return null;
    const [x,y]=pixel,ix=Math.floor(x),iy=Math.floor(y);
    if(ix<1||iy<1||ix>=image.width-2||iy>=image.height-2)return null;
    const ids=[iy*image.width+ix,iy*image.width+ix+1,(iy+1)*image.width+ix,(iy+1)*image.width+ix+1];
    if(ids.some(i=>quality.values[i]!==Number(deconvolved)||!Number.isFinite(image.values[i])))return null;
    const d=point.map((v,i)=>v-camera.positionMeters[i]),distance=Math.hypot(...d),hit=mesh.intersect(camera.positionMeters,unit(d),distance+.5);
    if(!hit||Math.abs(hit.radius-distance)>.5)return null;
    const weights=[(1-x+ix)*(1-y+iy),(x-ix)*(1-y+iy),(1-x+ix)*(y-iy),(x-ix)*(y-iy)];
    return ids.reduce((s,i,j)=>s+image.values[i]*weights[j],0);
  };
  return {sample,report:{image:r.path,fitControls:fit.length,holdoutControls:holdout.length,offsetPixels:measured,rmsMeters:rms,maximumMeters:maximum,residuals}};
}

/** Fit two slit offsets to native 1.8 µm radiance. The four retained terrain
 * patches (including their 9×9 neighbourhoods) cannot contribute to the fit.
 * Detector columns are wavelength; scan frames supply the second spatial axis. */
export function fitHriiPointing(value:unknown,inputs:{frame:{number:number};spectrum:ReturnType<typeof decodeHriiSpectra>}[],bodyToJ2000:number[][],
  mesh:SourceMesh,context:Awaited<ReturnType<typeof loadHriiContext>>,controls:{frame:number;row:number}[]) {
  const r=parseHriiDenseFit(value),rows=inputs[0].spectrum.height,width=inputs.length;
  if(!Number.isSafeInteger(r.rowStart)||!Number.isSafeInteger(r.rowEnd)||r.rowStart<0||r.rowEnd>=rows||r.rowEnd<=r.rowStart||r.seedOffsetPixels.length!==2||r.seedOffsetPixels.some(v=>Math.abs(v)>24)||r.radiusPixels!==4||r.stepPixels!==.25||r.minimumFitPixels<100||r.minimumCorrelation<.8||r.minimumCorrelation>1)throw new Error('Invalid HRII dense registration bounds.');
  const cameras=inputs.map(x=>hriiCamera(x.spectrum.header,{bodyToJ2000,offsetPixels:[0,0]}));
  const target=new Float64Array(width*rows),valid=new Uint8Array(target.length),fitMask=new Uint8Array(target.length);
  for(let x=0;x<width;x++)for(let y=r.rowStart;y<=r.rowEnd;y++) {
    const h=inputs[x].spectrum,values:number[]=[];
    for(let k=0;k<h.width;k++){const i=y*h.width+k;if(!h.reject(i)&&h.wavelength[i]>=1.775&&h.wavelength[i]<=1.825)values.push(h.values[i]);}
    if(values.length<3)continue;
    // The centre channel matches the native scan probe, including even counts.
    values.sort((a,b)=>a-b);const i=y*width+x;target[i]=values[values.length>>>1];valid[i]=1;
    fitMask[i]=controls.some(c=>Math.abs(c.frame-inputs[x].frame.number)<=4&&Math.abs(c.row-y)<=4)?0:1;
  }
  const sub=4,padding=40,bankHeight=(rows+2*padding)*sub;
  let best={x:0,y:0,correlation:-Infinity,fitPixels:0,holdoutCorrelation:NaN};
  const trials:typeof best[]=[];
  for(let ox=r.seedOffsetPixels[0]-4;ox<=r.seedOffsetPixels[0]+4;ox+=.25) {
    const values=new Float64Array(width*bankHeight),mask=new Uint8Array(values.length);
    const start=Math.floor((r.rowStart-r.seedOffsetPixels[1]-4+padding)*sub),end=Math.ceil((r.rowEnd-r.seedOffsetPixels[1]+4+padding)*sub);
    for(let x=0;x<width;x++)for(let yy=start;yy<=end;yy++) {
      const row=yy/sub-padding,ray=cameras[x].ray(row,-ox),hit=mesh.intersect(cameras[x].eye,ray),i=yy*width+x;
      if(!hit){if(r.region==='surface-and-background')mask[i]=1;continue;}
      if(r.region==='stereo-surface'&&mesh.indices[hit.faceId].some(v=>mesh.constraintFlags?.[v]!==1))continue;
      const p=cameras[x].eye.map((v,j)=>v+ray[j]*hit.radius),v=context.sample(p);if(v===null)continue;values[i]=v;mask[i]=1;
    }
    for(let oy=r.seedOffsetPixels[1]-4;oy<=r.seedOffsetPixels[1]+4;oy+=.25) {
      const sums=[[0,0,0,0,0,0],[0,0,0,0,0,0]];
      for(let y=r.rowStart;y<=r.rowEnd;y++)for(let x=0;x<width;x++) {
        const i=y*width+x,j=Math.round((y-oy+padding)*sub)*width+x;if(!valid[i]||j<0||j>=values.length||!mask[j])continue;
        const a=target[i],b=values[j],s=sums[fitMask[i]?0:1];s[0]++;s[1]+=a;s[2]+=b;s[3]+=a*a;s[4]+=b*b;s[5]+=a*b;
      }
      const trial={x:ox,y:oy,correlation:correlation(sums[0]),fitPixels:sums[0][0],holdoutCorrelation:correlation(sums[1])};trials.push(trial);
      if(trial.fitPixels>=r.minimumFitPixels&&trial.correlation>best.correlation)best=trial;
    }
  }
  if(!Number.isFinite(best.correlation)||best.correlation<r.minimumCorrelation||[best.x-r.seedOffsetPixels[0],best.y-r.seedOffsetPixels[1]].some(v=>Math.abs(v)>=4))throw new Error('HRII pointing search lacks a qualified interior solution.');
  return {offsetPixels:[best.x,best.y],fitPixels:best.fitPixels,fitCorrelation:best.correlation,holdoutCorrelation:best.holdoutCorrelation,
    withheldPatchRadiusPixels:4,trials:trials.length,region:r.region};
}
