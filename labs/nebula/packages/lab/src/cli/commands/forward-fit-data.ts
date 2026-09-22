/** Source-qualified observational histograms; no missing sky cell becomes empty physical space. */
import {gunzipSync} from 'node:zlib';
import {parseDensityVolumeObjectDescriptor} from '@cssearth/objects';
import {cataloguePosition} from '@cssearth/volume-core/coordinates/catalogue-position';
import {sourceBytes} from '@cssearth/volume-bake/compact-inputs/density-grid';
import {observableForwardPoint,type WeightedPoint,type ForwardConfig,type ForwardObservations,type HistogramAxis} from '@cssearth/nebula-reconstruction/registration/forward-density-fit';
export function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected object');return value as Record<string,unknown>;}
export function finite(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Expected finite number');return value;}
export function string(value:unknown):string{if(typeof value!=='string'||!value)throw new TypeError('Expected nonempty string');return value;}
export function pin(value:unknown){const p=record(value);return {path:string(p.path)};}
export function axis(value:unknown):HistogramAxis{const v=record(value);return {min:finite(v.min),max:finite(v.max),bins:finite(v.bins)};}
const bin=(v:number,a:HistogramAxis)=>Math.floor((v-a.min)/(a.max-a.min)*a.bins);
export const median=(values:number[])=>{values.sort((a,b)=>a-b);const i=Math.floor(values.length/2);return values.length%2?values[i]!:(values[i-1]!+values[i]!)/2;};
export function unpackPoints(bytes:Buffer):WeightedPoint[]{
 if(!bytes.length||bytes.length%16)throw new TypeError('Expected XYZ-weight float32 LE');
 const result:WeightedPoint[]=[];
 for(let i=0;i<bytes.length;i+=16){const p={x:bytes.readFloatLE(i),y:bytes.readFloatLE(i+4),z:bytes.readFloatLE(i+8),weight:bytes.readFloatLE(i+12)};
 if(!Object.values(p).every(Number.isFinite)||p.weight<0)throw new TypeError('Invalid point');result.push(p);}return result;
}
export function samplePoints(points:readonly WeightedPoint[],count:number){
 if(!Number.isInteger(count)||count<1)throw new TypeError('Invalid sample count');
 return Array.from({length:Math.min(count,points.length)},(_,i)=>points[Math.floor((i+.5)*points.length/Math.min(count,points.length))]!);
}
export function ellipsoidPoints(count:number,seed:number,sigma:number):WeightedPoint[]{
 if(!Number.isInteger(count)||count<1||!Number.isInteger(seed)||!Number.isFinite(sigma)||sigma<=0)throw new TypeError('Invalid seeded sample');
 let state=seed>>>0;const uniform=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
 return Array.from({length:count},()=>({x:normal()*sigma,y:normal()*sigma,z:normal()*sigma,weight:1}));
}
export async function forwardFitData(root:string,config:Record<string,unknown>){
 const [tableBytes,footprintBytes,simBytes,frameBytes]=await Promise.all([
  sourceBytes(root,pin(config.catalogue)),sourceBytes(root,pin(config.footprint)),
  sourceBytes(root,pin(config.simulation)),sourceBytes(root,pin(config.frameObject))]);
 const descriptor=parseDensityVolumeObjectDescriptor(JSON.parse(frameBytes.toString('utf8')) as unknown);
 const frame=descriptor.volume,D=Math.hypot(...frame.originM)/frame.metersPerUnit;
 const [qx,qy,qz,qw]=frame.localToReferenceXyzw,n=[2*(qx*qz+qy*qw),2*(qy*qz-qx*qw),1-2*(qx*qx+qy*qy)];
 if(n.reduce((s,v,i)=>s+v*frame.originM[i]!/Math.hypot(...frame.originM),0)<1-1e-8)throw new TypeError('Forward fit requires local +Z away from the observer.');
 const g=record(config.grid),x=axis(g.x),y=axis(g.y),magnitude=axis(g.m);
 for(const a of [x,y,magnitude])if(a.max<=a.min||!Number.isInteger(a.bins)||a.bins<1)throw new TypeError('Invalid histogram axis');
 const skySize=x.bins*y.bins;if(skySize*magnitude.bins>1000000)throw new TypeError('Fit histogram too large');
 const forward:ForwardConfig={distance:D,referenceDistance:finite(config.referenceDistanceKpc),x,y,magnitude,
  sigmaMag:finite(config.sigmaMag),xyKernel:[.15,.7,.15],contaminationFraction:finite(config.contaminationFraction)};
 const projectedCell=(ra:number,dec:number)=>{const [px,py,pz]=cataloguePosition(((ra%360)+360)%360,dec,D,frame);const view=observableForwardPoint({x:px,y:py,z:pz,weight:1},D,forward.referenceDistance)!;
  const ix=bin(view.x,x),iy=bin(view.y,y);return ix>=0&&ix<x.bins&&iy>=0&&iy<y.bins?iy*x.bins+ix:-1;};
 const published=new Float64Array(skySize),retained=new Float64Array(skySize),counts=new Float64Array(skySize*magnitude.bins);
 for(const line of gunzipSync(footprintBytes).toString('utf8').trim().split(/\r?\n/)){
  const fields=line.trim().split(/\s+/).map(Number);if(fields.length!==4||!fields.every(Number.isFinite))throw new TypeError('Invalid published RC row');
  const cell=projectedCell(fields[0]!,fields[1]!);if(cell>=0)published[cell]++;
 }
 const lines=tableBytes.toString('utf8').trim().split(/\r?\n/),header=lines.shift()!.split('\t');
 const keys=['raDeg','decDeg','distanceKpc','ksErrorMag'],columns=keys.map(k=>header.indexOf(k));if(columns.some(i=>i<0))throw new TypeError('Missing observed columns');
 let outside=0;const errors:number[]=[],centers:[number[],number[],number[]]=[[],[],[]];
 for(const line of lines){const f=line.split('\t');const values=columns.map(i=>Number(f[i]));if(f.length!==header.length||!values.every(Number.isFinite)||values[3]!<0)throw new TypeError('Invalid observation');
  const [ra,dec,d,e]=values as [number,number,number,number];const cell=projectedCell(ra,dec),mag=5*Math.log10(d/forward.referenceDistance),im=bin(mag,magnitude);
  if(cell<0||im<0||im>=magnitude.bins){outside++;continue;}retained[cell]++;counts[cell*magnitude.bins+im]++;errors.push(e);
  const p=cataloguePosition(ra,dec,d,frame);p.forEach((v,i)=>centers[i]!.push(v));
 }
 const footprint=new Float64Array(skySize),split=new Uint8Array(skySize);let excludedCount=0,trainCells=0,testCells=0;
 for(let cell=0;cell<skySize;cell++){
  if(published[cell]!<finite(config.minimumFootprintCount)){excludedCount+=retained[cell]!;continue;}
  // Explicit empirical retention, not a claim of survey/population completeness.
  footprint[cell]=Math.min(1,retained[cell]!/published[cell]!);
  const ix=cell%x.bins,iy=Math.floor(cell/x.bins);split[cell]=(Math.floor(ix/2)+3*Math.floor(iy/2))%4===0?2:1;
  if(split[cell]===1)trainCells++;else testCells++;
 }
 const simulation=unpackPoints(simBytes),center={x:median(simulation.map(p=>p.x)),y:median(simulation.map(p=>p.y)),z:median(simulation.map(p=>p.z))};
 for(const p of simulation){p.x-=center.x;p.y-=center.y;p.z-=center.z;}
 const photometricSigmaMag=median(errors);
 forward.sigmaMag=Math.hypot(forward.sigmaMag,photometricSigmaMag);
 const observations:ForwardObservations={counts,footprint,split};
 return {forward,observations,simulation,frame,center,observedCenter:centers.map(median),
  diagnostics:{rows:lines.length,outsideHistogram:outside,excludedLowCoverage:excludedCount,trainCells,testCells,
   medianPhotometricErrorMag:photometricSigmaMag,effectiveSigmaMag:forward.sigmaMag,selection:'Published-catalogue footprint and retained/published row ratio; duplicate measurements, source selection and magnitude-dependent incompleteness are not fully modelled.',
   split:'2x2-sky-cell checkerboard blocks, one quarter held out before optimizing any model.'}};
}
