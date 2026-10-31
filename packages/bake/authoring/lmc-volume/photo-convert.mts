/** l8: deterministic spectral conversion of observed RGB, not local appearance fitting. */
import {readFile} from 'node:fs/promises';
import {ARCHIVE,need,rec,array,numbers,num,json} from './inputs.mts';
import {EXTINCTION_RGB,HEIGHT_DISC,SIGMA_BAR,BAR_VERTICAL_RATIO} from './model.mts';
import {inverseTone} from './grade.mts';
import type {V3} from './geometry.mts';
export const HEIGHTS={old:HEIGHT_DISC,bar:SIGMA_BAR*BAR_VERTICAL_RATIO,young:.1,gas:.1,dust:HEIGHT_DISC/2};
export const INPUT_CURVE={stretch:0,saturation:1.6};
export interface PhotoSky {width:number;height:number;rgb:Float64Array;valid:Uint8Array;distance:Float32Array;rawDust:Float32Array;colors:V3[];metadata:Record<string,unknown>;}
export function solve3(columns:V3[],rgb:V3):V3 {
  const [a,b,c]=columns,det=a[0]*(b[1]*c[2]-b[2]*c[1])-b[0]*(a[1]*c[2]-a[2]*c[1])+c[0]*(a[1]*b[2]-a[2]*b[1]);need(Math.abs(det)>1e-10,'Degenerate spectral basis');
  const d=(p:V3,q:V3,r:V3)=>p[0]*(q[1]*r[2]-q[2]*r[1])-q[0]*(p[1]*r[2]-p[2]*r[1])+r[0]*(p[1]*q[2]-p[2]*q[1]);
  return [d(rgb,b,c)/det,d(a,rgb,c)/det,d(a,b,rgb)/det];
}
/** Mean transmissions through one Gaussian dust layer; heights and law are fixed. */
export function transmission(tau:number,sigma:number,k:number):number {
  let sum=0,norm=0;const n=80;
  for(let i=0;i<n;i++){const u=-5+(i+.5)*10/n,z=u*sigma,w=Math.exp(-.5*u*u),x=z/(Math.SQRT2*HEIGHTS.dust),t=1/(1+.3275911*Math.abs(x));
    const erf=Math.sign(x)*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-x*x));
    sum+=w*Math.exp(-tau*k*.5*(1-erf));norm+=w;
  }return sum/norm;
}
const SIGMAS=[HEIGHTS.old,HEIGHTS.bar,HEIGHTS.young,HEIGHTS.gas],table=SIGMAS.map(s=>EXTINCTION_RGB.map(k=>Float64Array.from({length:401},(_,i)=>transmission(i*.02,s,k))));
export function transfer(component:number,tau:number,c:number):number {
  const x=Math.max(0,Math.min(8,tau))/.02,i=Math.min(399,Math.floor(x)),f=x-i;return table[component][c][i]*(1-f)+table[component][c][i+1]*f;
}
/** Physical SSP colors and Case-B hydrogen lines through the preserved Johnson filters. */
export async function spectralColors():Promise<{colors:V3[];metadata:Record<string,unknown>}> {
  const root=`${ARCHIVE}dataset-model/detail-stars/ssp-intake/`,raw=rec(await json(root+'bc03-Z008-optical-age-table.json')),native=array(rec(array(raw.solutions)[0]).native).map(v=>rec(v));
  const ssp=(age:number)=>{const row=native.reduce((a,b)=>Math.abs(Math.log(num(b.ageYr)/age))<Math.abs(Math.log(num(a.ageYr)/age))?b:a),v=numbers(row.bandMeanLnuWPerHzPerInitialMsun,3);return{age:num(row.ageYr),color:[v[2]/v[1],1,v[0]/v[1]] as V3};};
  const old=ssp(5e9),young=ssp(3e6),gas:number[]=[];
  for(const band of ['R','V','B']){
    const bytes=await readFile(root+`GENERIC_JOHNSON_${band}_BroadBand.stab`);let offset=0;
    const str=()=>{const s=bytes.toString('ascii',offset,offset+8).trim();offset+=8;return s;},integer=()=>{const n=Number(bytes.readBigUInt64LE(offset));offset+=8;return n;};
    need(str()==='SKIRT X','Invalid passband');offset+=8;need(integer()===1&&str()==='lambda'&&str()==='m'&&str()==='lin','Unexpected passband layout');
    const n=integer();need(n>2&&n<10000,'Invalid passband size');const x=Array.from({length:n},()=>{const v=bytes.readDoubleLE(offset);offset+=8;return v;});
    need(integer()===1&&str()==='T'&&str()==='1/m'&&str()==='lin','Unexpected passband quantity');const y=x.map((_,i)=>bytes.readDoubleLE(offset+i*8));
    let denominator=0;for(let i=0;i<n-1;i++)denominator+=(x[i+1]-x[i])*(y[i]/x[i]**2+y[i+1]/x[i+1]**2)/2;
    let line=0;for(const [nm,flux]of [[656.28,2.86],[486.13,1],[434.05,.468],[410.17,.259]]){const l=nm*1e-9;if(l<x[0]||l>x[n-1])continue;let i=0;while(i<n-2&&x[i+1]<l)i++;const f=(l-x[i])/(x[i+1]-x[i]);line+=flux*(y[i]*(1-f)+y[i+1]*f);}
    gas.push(line/denominator);
  }
  need(gas.every(v=>v>0),'Empty nebular passband');const colors:V3[]=[old.color,young.color,[gas[0]/gas[1],1,gas[2]/gas[1]]];
  return {colors,metadata:{stellarLibrary:'BC03 / Chabrier / Z=0.008, preserved Johnson BVR integrations',oldAgeYears:old.age,youngAgeYears:young.age,caseB:{haOverHb:2.86,hgOverHb:.468,hdOverHb:.259},gasMeaning:'Hydrogen recombination color prior. Metal lines and the photo passbands remain uncertain; only global component grades can adjust this.',law:'Gordon 2003 LMC average Rv=3.41; B/V measured ratio, R-band optical proxy',extinctionRgb:EXTINCTION_RGB,colors}};
}
/** Chamfer distance to observed support, including outer raster edges. */
export function distanceToEdge(valid:Uint8Array,w:number,h:number):Float32Array {
  const d=Float32Array.from(valid,v=>v?1e6:0);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!x||!y||x===w-1||y===h-1)d[i]=0;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y)d[i]=Math.min(d[i],d[i-w]+1);if(x&&y)d[i]=Math.min(d[i],d[i-w-1]+Math.SQRT2);}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)d[i]=Math.min(d[i],d[i+1]+1);if(y+1<h)d[i]=Math.min(d[i],d[i+w]+1);if(x+1<w&&y+1<h)d[i]=Math.min(d[i],d[i+w+1]+Math.SQRT2);}
  return d;
}
function morphology(values:Float32Array,valid:Uint8Array,w:number,h:number,r:number,maximum:boolean):Float32Array {
  let a=values;
  for(const axis of [0,1]){const b=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!valid[p])continue;let v=maximum?-Infinity:Infinity;
    for(let k=-r;k<=r;k++){const xx=x+(axis===0?k:0),yy=y+(axis===1?k:0);if(xx>=0&&yy>=0&&xx<w&&yy<h&&valid[yy*w+xx])v=maximum?Math.max(v,a[yy*w+xx]):Math.min(v,a[yy*w+xx]);}b[p]=Number.isFinite(v)?v:0;
  }a=b;}return a;
}
function localMean(values:Float32Array,valid:Uint8Array,w:number,h:number,r:number):Float32Array {
  const sum=new Float64Array(w*h),weight=new Float64Array(w*h),out=new Float32Array(w*h);
  for(let y=0;y<h;y++){let a=0,b=0;for(let x=-r;x<w+r;x++){const add=x+r,remove=x-r-1;if(add>=0&&add<w&&valid[y*w+add]){a+=values[y*w+add];b++;}if(remove>=0&&remove<w&&valid[y*w+remove]){a-=values[y*w+remove];b--;}if(x>=0&&x<w){sum[y*w+x]=a;weight[y*w+x]=b;}}}
  for(let x=0;x<w;x++){let a=0,b=0;for(let y=-r;y<h+r;y++){const add=y+r,remove=y-r-1;if(add>=0&&add<h){a+=sum[add*w+x];b+=weight[add*w+x];}if(remove>=0&&remove<h){a-=sum[remove*w+x];b-=weight[remove*w+x];}if(y>=0&&y<h&&valid[y*w+x])out[y*w+x]=b>0?a/b:0;}}
  return out;
}
export async function makePhotoSky(rgb:Float64Array,valid:Uint8Array,w:number,h:number):Promise<PhotoSky> {
  need(rgb.length===w*h*3&&valid.length===w*h,'Photo grid mismatch');const spectral=await spectralColors(),linear=inverseTone(rgb,INPUT_CURVE.stretch,INPUT_CURVE.saturation),distance=distanceToEdge(valid,w,h),lum=Float32Array.from(valid,(_,i)=>(linear[i*3]+linear[i*3+1]+linear[i*3+2])/3);
  // Publisher RGB is not Johnson BVR. Measure two GLOBAL tint ratios for the
  // pink endmember before assignment, so hydrogen-plus-metal emission is not
  // incorrectly allocated the old stellar thickness. No spatial labels are fitted.
  const gasRed:number[]=[],gasBlue:number[]=[];
  for(let i=0;i<valid.length;i++)if(valid[i]&&lum[i]>.015){const r=linear[i*3]/Math.max(1e-8,linear[i*3+1]),b=linear[i*3+2]/Math.max(1e-8,linear[i*3+1]);if(r>1.15&&b>.85&&r/b>1.1){gasRed.push(r);gasBlue.push(b);}}
  need(gasRed.length>50,'Insufficient pink signal for one global gas-color calibration');gasRed.sort((a,b)=>a-b);gasBlue.sort((a,b)=>a-b);
  const colors=spectral.colors.map(v=>[...v] as V3),gasColor:V3=[Math.max(1.2,Math.min(2.5,gasRed[Math.floor((gasRed.length-1)*.9)])),1,Math.max(.85,Math.min(1.6,gasBlue[Math.floor((gasBlue.length-1)*.75)]))];colors[2]=gasColor;
  const gasDisplayTint=gasColor.map((v,c)=>v/spectral.colors[2][c]);
  const radius=Math.max(2,Math.round(w/64)),closed=morphology(morphology(lum,valid,w,h,radius,true),valid,w,h,radius,false),rawDust=new Float32Array(w*h),red=localMean(Float32Array.from(valid,(_,i)=>linear[i*3]),valid,w,h,radius),blue=localMean(Float32Array.from(valid,(_,i)=>linear[i*3+2]),valid,w,h,radius);
  for(let i=0;i<valid.length;i++)if(valid[i]){
    const deficit=Math.max(0,Math.log((closed[i]+.002)/(lum[i]+.002)));
    const reddening=Math.max(0,Math.log((linear[i*3]+.002)/(linear[i*3+2]+.002))-Math.log((red[i]+.002)/(blue[i]+.002)))/(EXTINCTION_RGB[2]-EXTINCTION_RGB[0]);
    // Faint sky has no useful extinction contrast. Do not turn noise or missing
    // illumination into dust; a fixed unresolved floor remains under the lanes.
    const support=closed[i]/(closed[i]+.015),contrast=.25*deficit+Math.sqrt(deficit*Math.min(2,reddening));
    rawDust[i]=.02+Math.min(2,contrast)*support*Math.min(1,distance[i]/(radius*2));
  }
  return {width:w,height:h,rgb:linear,valid,distance,rawDust,colors,metadata:{...spectral.metadata,physicalColorPriors:spectral.colors,colors,gasDisplayTint,gasColorCalibration:{global:true,samples:gasRed.length,ratioQuantiles:{red:.9,blue:.75},reason:'Unknown publisher passbands and processing, and missing metal lines in the pure hydrogen prior. This is a single color grade per component, applied before classification.'},inputCurve:INPUT_CURVE,dustProxy:'Fixed dark-lane contrast and local red/blue excess along the Gordon reddening direction, weighted by available illumination, plus an unresolved floor. Bell normalizes one total column budget. Not a measured dust-depth map.',dustClosingRadiusPixels:radius,dustSupportFloorLinearDisplay:.015,localOptimizers:0,localLearnedParameters:0}};
}
export function splitPixel(rgb:V3,colors:V3[],tau:number,barFraction:number):{weights:V3;clipped:boolean;reconstructed:V3} {
  const columns:V3[]=colors.map((color,k)=>color.map((v,c)=>v*(k===0?(1-barFraction)*transfer(0,tau,c)+barFraction*transfer(1,tau,c):transfer(k+1,tau,c))) as V3);
  const solved=solve3(columns,rgb),clipped=solved.some(v=>v<0),weights=solved.map(v=>Math.max(0,v)) as V3;
  let predicted=0;for(let k=0;k<3;k++)predicted+=weights[k]*(columns[k][0]+columns[k][1]+columns[k][2]);const sum=rgb[0]+rgb[1]+rgb[2],scale=predicted>0?sum/predicted:0;
  for(let k=0;k<3;k++)weights[k]*=scale;
  const reconstructed:V3=[0,0,0];for(let c=0;c<3;c++)for(let k=0;k<3;k++)reconstructed[c]+=weights[k]*columns[k][c];
  return {weights,clipped,reconstructed};
}
