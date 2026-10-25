/** Fixed catalogue-masked aperture and global bar grading in displayed photo RGB. */
import {bodyToIcrs,unit,mul,add,type V3} from './geometry.mts';
import {skyOffset} from './catalogue-ha.mts';
import type {CatalogueRow} from './catalogue-data.mts';
import type {BarGeometry} from './bar-geometry.mts';
import type {Observation} from './report.mts';
import {gradedPrediction,inverseTone,type Grade} from './grade.mts';
import {loss,type Basis,type Target} from './render.mts';
import {need} from './inputs.mts';
export const BAR_COLOR_TOLERANCE=.02,MAX_RMS_REGRESSION=.01;
export interface Aperture {mask:Uint8Array;bar:Uint8Array;excluded:Uint8Array;pixels:number;barPixels:number;}
type Point=readonly[number,number];
function ellipse(mask:Uint8Array,w:number,h:number,center:Point,a:Point,b:Point,inner=0,padding=0){
 const x=a[0],y=a[1],u=b[0],v=b[1],xx=x*x+u*u,yy=y*y+v*v,xy=x*y+u*v,det=xx*yy-xy*xy;need(det>0,'Degenerate catalogue aperture');
 const r=Math.sqrt(Math.max(xx,yy))+padding,scale=1+padding/Math.max(1e-10,Math.sqrt(Math.min(xx,yy)));
 for(let j=Math.max(0,Math.floor(center[1]-r));j<=Math.min(h-1,Math.ceil(center[1]+r));j++)for(let i=Math.max(0,Math.floor(center[0]-r));i<=Math.min(w-1,Math.ceil(center[0]+r));i++){const dx=i+.5-center[0],dy=j+.5-center[1],q=(yy*dx*dx-2*xy*dx*dy+xx*dy*dy)/det;if(q<=scale*scale&&q>=inner*inner)mask[j*w+i]=1;}
}
export function barAperture(o:Pick<Observation,'width'|'height'|'pixelOf'|'mask'>,b:BarGeometry,rows:CatalogueRow[]):Aperture{
 const {width:w,height:h}=o,bar=new Uint8Array(w*h),excluded=new Uint8Array(w*h),mask=new Uint8Array(w*h),center=o.pixelOf(bodyToIcrs(b.center));need(center,'Bar is outside registration');
 const axes:V3[]=[[b.sigma*Math.cos(b.angle),b.sigma*Math.sin(b.angle),0],[-b.sigma*b.ratio*Math.sin(b.angle),b.sigma*b.ratio*Math.cos(b.angle),0],[0,0,b.sigmaZ]];let xx=0,yy=0,xy=0;
 for(const axis of axes){const p=o.pixelOf(bodyToIcrs(add(b.center,axis))),q=o.pixelOf(bodyToIcrs(add(b.center,mul(axis,-1))));need(p&&q,'Missing bar projection');const x=(p[0]-q[0])/2,y=(p[1]-q[1])/2;xx+=x*x;yy+=y*y;xy+=x*y;}
 const d=Math.hypot(xx-yy,2*xy),angle=.5*Math.atan2(2*xy,xx-yy),a=2*Math.sqrt((xx+yy+d)/2),c=2*Math.sqrt((xx+yy-d)/2);ellipse(bar,w,h,center,[a*Math.cos(angle),a*Math.sin(angle)],[-c*Math.sin(angle),c*Math.cos(angle)]);
 for(const r of rows){if(r.kind==='molecular')continue;const p=o.pixelOf(unit(r.ra,r.dec)),qa=o.pixelOf(unit(...skyOffset(r,1,0))),qb=o.pixelOf(unit(...skyOffset(r,0,1)));if(!p||!qa||!qb)continue;ellipse(excluded,w,h,p,[qa[0]-p[0],qa[1]-p[1]],[qb[0]-p[0],qb[1]-p[1]],r.kind==='supershell'?.72:0,w/1024*1.5);}
 let pixels=0,barPixels=0;for(let i=0;i<mask.length;i++){barPixels+=bar[i];if(bar[i]&&!excluded[i]&&o.mask[Math.floor(i/w)][i%w]){mask[i]=1;pixels++;}}
 need(pixels>=8,'Too little clean bar area for a color measurement');return{mask,bar,excluded,pixels,barPixels};
}
export const encodeDisplay=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;};
export function ratios(rgb:Float64Array,mask:Uint8Array){need(rgb.length===mask.length*3,'RGB aperture dimensions differ');const sums=[0,0,0];let pixels=0;for(let p=0;p<mask.length;p++)if(mask[p]){pixels++;for(let c=0;c<3;c++)sums[c]+=rgb[p*3+c];}need(pixels>0&&sums[1]>0,'Empty bar color statistic');return{rg:sums[0]/sums[1],bg:sums[2]/sums[1],meanG:sums[1]/pixels,pixels};}
export function displayRgb(prediction:Float64Array,sky:readonly number[]){return Float64Array.from(prediction,(v,i)=>encodeDisplay(v+sky[i%3]));}
export function photoRgb(o:Observation){return Float64Array.from({length:o.width*o.height*3},(_,i)=>o.rawRgb[i%3][Math.floor(i/3/o.width)][Math.floor(i/3)%o.width]);}
export function colorPass(candidate:ReturnType<typeof ratios>,photo:ReturnType<typeof ratios>){return Math.abs(candidate.rg/photo.rg-1)<=BAR_COLOR_TOLERANCE&&Math.abs(candidate.bg/photo.bg-1)<=BAR_COLOR_TOLERANCE;}
export function rmsPass(candidate:readonly number[],parent:readonly number[]){return candidate.length===2&&parent.length===2&&candidate.every((v,i)=>Number.isFinite(v)&&v<=parent[i]*(1+MAX_RMS_REGRESSION));}
export function fitBarRatios(basis:Basis,initial:Grade,target:Target,aperture:Aperture,photo:ReturnType<typeof ratios>,sky:readonly number[],parentPrediction:Float64Array){
 const all={...target,train:Uint8Array.from(target.train,(v,i)=>v||target.holdout[i]?1:0)},baseline=[loss(parentPrediction,target),loss(parentPrediction,target,true)],parentColor=ratios(displayRgb(parentPrediction,sky),aperture.mask),grade=structuredClone(initial),bounds=grade.coefficients[1].map(v=>[v*.5,v*2]),inverse=inverseTone(target.data,grade.stretch,grade.saturation),fixed=new Float64Array(target.data.length);
 for(let i=0;i<fixed.length;i++){const c=i%3;fixed[i]=(basis.planes[0][i]+basis.planes[2][i])*grade.coefficients[0][c]+basis.planes[3][i]*grade.coefficients[2][c]+basis.planes[4][i]*grade.coefficients[3][c];}
 const evaluate=(g:Grade)=>{const prediction=gradedPrediction(basis,g),color=ratios(displayRgb(prediction,sky),aperture.mask),error=Math.log(color.rg/photo.rg)**2+Math.log(color.bg/photo.bg)**2,brightness=Math.log(color.meanG/parentColor.meanG)**2,rms=[loss(prediction,target),loss(prediction,target,true)],regression=rms.reduce((s,v,i)=>s+Math.max(0,v/baseline[i]-1-MAX_RMS_REGRESSION)**2,0);return{prediction,color,rms,score:rmsPass(rms,baseline)?error+.01*brightness:1+1e4*regression+error};};
 let best=evaluate(grade);
 const guess=structuredClone(grade);for(let c=0;c<3;c++){let a=0,b=0;for(let p=0;p<aperture.mask.length;p++)if(aperture.mask[p]){const i=p*3+c,x=basis.planes[1][i];a+=x*(inverse[i]-fixed[i]);b+=x*x;}if(b>0)guess.coefficients[1][c]=Math.max(bounds[c][0],Math.min(bounds[c][1],a/b));}const first=evaluate(guess);if(first.score<best.score){grade.coefficients[1]=[...guess.coefficients[1]];best=first;}
 for(const step of [.2,.1,.04,.01,.003])for(let repeat=0;repeat<3;repeat++)for(let c=0;c<3;c++)for(const sign of [-1,1]){const trial=structuredClone(grade);trial.coefficients[1][c]=Math.max(bounds[c][0],Math.min(bounds[c][1],trial.coefficients[1][c]*(1+sign*step)));const value=evaluate(trial);if(value.score<best.score){grade.coefficients[1][c]=trial.coefficients[1][c];best=value;}}
 return{grade,prediction:best.prediction,diagnostics:{freeParameters:3,coefficientBounds:bounds,colorToleranceRelative:BAR_COLOR_TOLERANCE,rmsRegressionLimitRelative:MAX_RMS_REGRESSION,photo,parent:parentColor,candidate:best.color,colorPassed:colorPass(best.color,photo),rmsPassed:rmsPass(best.rms,baseline),rmsParent:baseline,rmsCandidate:best.rms,aperturePixels:aperture.pixels,barPixels:aperture.barPixels}};
}
