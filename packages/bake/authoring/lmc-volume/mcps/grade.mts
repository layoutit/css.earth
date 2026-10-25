/** The existing six-control optimizer, scored on fixed whole-bar, core and edge colors. */
import {fitStellarGrade,type StellarFamily} from '../stellar-grade.mts';
import {gradedPrediction,sourceTarget,type Grade} from '../grade.mts';import {barAperture,photoRgb} from '../bar-ratios.mts';
import {colorRegions,regionalRatios} from './color-check.mts';import {targetOf,type Observation} from '../report.mts';import {rayPlane} from '../geometry.mts';
import type {Basis} from '../render.mts';import type {BarGeometry} from '../bar-geometry.mts';import type {CatalogueRow} from '../catalogue-data.mts';
export function fitMcpsColors(basis:Basis,initial:Grade,o:Observation,b:BarGeometry,rows:CatalogueRow[],tiny:boolean,baseline:number[]){
 const aperture=barAperture(o,b,rows),regions=colorRegions(o,b,rows),photo=regionalRatios(photoRgb(o),regions),ids:number[]=[],target=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor);
 // Keep every bar pixel so the acceptance apertures are not aliased by the fit's image subsample.
 for(let p=0;p<aperture.mask.length;p++)if(aperture.mask[p]||tiny||(p%o.width+3*Math.floor(p/o.width))%8===0)ids.push(p);
 const pick=(v:Float64Array)=>Float64Array.from({length:ids.length*3},(_,i)=>v[ids[Math.floor(i/3)]*3+i%3]),mask=(v:Uint8Array)=>Uint8Array.from(ids,p=>v[p]),sampleBasis={...basis,width:ids.length,height:1,planes:basis.planes.map(pick)},family:StellarFamily={base:sampleBasis,old:sampleBasis.planes.map(v=>new Float64Array(v.length)),young:sampleBasis.planes.map(v=>new Float64Array(v.length))},sample={data:pick(target.data),train:mask(target.train),holdout:mask(target.holdout)},sampleAperture={...aperture,mask:mask(aperture.mask),bar:mask(aperture.bar),excluded:mask(aperture.excluded)},outer=Uint8Array.from(ids,p=>{const q=rayPlane(o.rayAt(p%o.width+.5,Math.floor(p/o.width)+.5));return Number(Math.hypot(q[0],q[1])>=4&&(target.train[p]||target.holdout[p]));});
 const fit=fitStellarGrade(family,initial,sample,sampleAperture,photo.bar,o.metadata.sky.rgbLinearDisplay,baseline,[.1,.05],{freezeFractions:true,iterations:50,colorDeadzone:0,colorWeight:30,coefficientBounds:[.001,100],regionalColors:[{mask:mask(regions.core),rg:photo.core.rg,bg:photo.core.bg,weight:40},{mask:mask(regions.edges),rg:photo.edges.rg,bg:photo.edges.bg,weight:40}],regions:[{mask:outer,weight:1,deadzone:Math.log(1.075)}]});
 // The cached basis already contains the exact l21 resolved fractions. No grain control is free here.
 return{grade:fit.grade,prediction:gradedPrediction(basis,fit.grade),diagnostics:{...fit.diagnostics,freeParameters:6,regionalColorWeights:{bar:30,core:40,edges:40},allBarPixelsIncluded:true,grainFractionsAlreadyFrozenInBasis:true,pixels:ids.length}};
}
