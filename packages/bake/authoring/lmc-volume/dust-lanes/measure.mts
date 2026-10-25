/** l26 measures the same dense l25 lanes against their own nearby bar light. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,json,rec,num,need} from '../inputs.mts';
import {loadObservation} from '../observation.mts';
import {versionDir} from '../sequence-state.mts';
import {readBarGeometry} from '../bar-geometry.mts';
import {catalogueRows} from '../catalogue-data.mts';
import {barWindow,angularPixel} from '../dust-contrast.mts';
import {barAperture,photoRgb,displayRgb,encodeDisplay,ratios} from '../bar-ratios.mts';
import {loadHeritage} from '../heritage-input.mts';
import {sampleDensity} from '../heritage-layer.mts';
import {skyOf} from '../geometry.mts';
import {blur} from '../young-density.mts';
import type {Observation} from '../report.mts';
export const L26=LOCAL+'versions/l26/';
export const TOLERANCE={depthAbsolute:.03,darkDecileAbsolute:.05,colorRelative:.02,barColorRelative:.02};
export function decode(v:number){return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}
function filtered(values:Float64Array,weights:Float64Array,o:Observation,fwhm:number){
 const p=angularPixel(o),sx=fwhm/2.354820045/p.x,sy=fwhm/2.354820045/p.y;
 const denominator=blur(weights,o.width,o.height,sx,sy),numerator=blur(Float64Array.from(values,(v,i)=>v*weights[i]),o.width,o.height,sx,sy);
 return{values:Float64Array.from(numerator,(v,i)=>denominator[i]>.01?v/denominator[i]:0),coverage:denominator};
}
export function localLight(rgb:Float64Array,o:Observation,valid:Float64Array,clear:Float64Array){
 const linear=Array.from({length:3},(_,c)=>Float64Array.from({length:valid.length},(_,i)=>decode(rgb[i*3+c])));
 const light=linear.map(v=>filtered(v,valid,o,.5)),background=linear.map(v=>filtered(v,clear,o,3));
 return{light,background};
}
function shrink(values:Float64Array,w:number,h:number,factor:number){
 if(factor===1)return values.slice();const out=new Float64Array(w*h/factor**2),width=w/factor;
 for(let y=0;y<h/factor;y++)for(let x=0;x<width;x++){let sum=0;for(let j=0;j<factor;j++)for(let i=0;i<factor;i++)sum+=values[(y*factor+j)*w+x*factor+i];out[y*width+x]=sum/factor**2;}return out;
}
export async function laneContext(tiny=false){
 const bar=readBarGeometry(rec(await json(versionDir(25)+'configuration.json')).barGeometry),{rows}=await catalogueRows(),reference=await loadObservation(8),window=barWindow(reference,bar,rows),full=await loadObservation(8,window,{sky:reference.metadata.sky.rgbLinearDisplay,commonFactor:reference.metadata.normalization.commonFactor}),aperture=barAperture(full,bar,rows),{image,wcs}=await loadHeritage(),meta=rec(await json(versionDir(25)+'dust-column.json')),normalization=num(rec(meta.normalization).factor),av=new Float64Array(full.width*full.height),valid=new Float64Array(av.length),clear=new Float64Array(av.length);
 for(let y=0;y<full.height;y++)for(let x=0;x<full.width;x++){const i=y*full.width+x;if(!aperture.mask[i])continue;const p=wcs.pixelOf(...skyOf(full.rayAt(x+.5,y+.5)));if(!p)continue;const q=sampleDensity(image.values,image.width,image.height,p[0],p[1]);if(q.coverage<.999)continue;av[i]=7.394*q.value*normalization;valid[i]=1;if(av[i]<=.15)clear[i]=1;}
 const bytes=await readFile(versionDir(25)+'bar-prediction.f64le');need(bytes.length===av.length*3*8,'Wrong accepted bar dimensions');const baseline=displayRgb(new Float64Array(Uint8Array.from(bytes).buffer),full.metadata.sky.rgbLinearDisplay),local=localLight(baseline,full,valid,clear),lanes=Float64Array.from(valid,(v,i)=>Number(v&&av[i]>=.2&&local.background[1].coverage[i]>.08&&local.background[1].values[i]>.001&&local.light[1].values[i]/local.background[1].values[i]<=.85));
 need(lanes.reduce((a,b)=>a+b,0)>100,'Too few accepted dense lane pixels');const o=tiny?await loadObservation(2,window,{sky:reference.metadata.sky.rgbLinearDisplay,commonFactor:reference.metadata.normalization.commonFactor}):full,factor=tiny?4:1;
 return{o,window,lanes:shrink(lanes,full.width,full.height,factor),valid:shrink(valid,full.width,full.height,factor),clear:shrink(clear,full.width,full.height,factor),bar:barAperture(o,bar,rows).mask,av,fullLanes:lanes,fullValid:valid,fullClear:clear,full};
}
export type LaneContext=Awaited<ReturnType<typeof laneContext>>;
export function measure(rgb:Float64Array,c:LaneContext){
 const local=localLight(rgb,c.o,c.valid,c.clear),sums=[0,0,0],adjacent=[0,0,0],depths:{value:number;weight:number}[]=[];let weight=0,linearLane=0,linearAdjacent=0;
 for(let i=0;i<c.lanes.length;i++){const w=c.lanes[i];if(!(w>0)||local.background[1].coverage[i]<=.08)continue;weight+=w;for(let k=0;k<3;k++){sums[k]+=w*encodeDisplay(local.light[k].values[i]);adjacent[k]+=w*encodeDisplay(local.background[k].values[i]);}linearLane+=w*local.light[1].values[i];linearAdjacent+=w*local.background[1].values[i];depths.push({value:local.light[1].values[i]/local.background[1].values[i],weight:w});}
 need(weight>5&&linearAdjacent>0,'Empty paired lane measurement');depths.sort((a,b)=>a.value-b.value);let cumulative=0,darkDecile=0;for(const d of depths){cumulative+=d.weight;if(cumulative>=.1*weight){darkDecile=d.value;break;}}const relative=sums.map((v,k)=>v/adjacent[k]);
 return{depth:1-linearLane/linearAdjacent,greenTransmission:linearLane/linearAdjacent,darkDecileTransmission:darkDecile,rg:relative[0]/relative[1],bg:relative[2]/relative[1],laneRgb:sums.map(v=>v/weight),adjacentRgb:adjacent.map(v=>v/weight),effectivePixels:weight,bar:ratios(rgb,c.bar)};
}
export function match(a:ReturnType<typeof measure>,b:ReturnType<typeof measure>){return{depth:Math.abs(a.depth-b.depth)<=TOLERANCE.depthAbsolute,darkDecile:Math.abs(a.darkDecileTransmission-b.darkDecileTransmission)<=TOLERANCE.darkDecileAbsolute,rg:Math.abs(a.rg/b.rg-1)<=TOLERANCE.colorRelative,bg:Math.abs(a.bg/b.bg-1)<=TOLERANCE.colorRelative,bar:Math.abs(a.bar.rg/b.bar.rg-1)<=.02&&Math.abs(a.bar.bg/b.bar.bg-1)<=.02};}
export async function baselineReport(){
 await mkdir(L26,{recursive:true});const c=await laneContext(),photo=measure(photoRgb(c.o),c),bytes=await readFile(versionDir(25)+'bar-prediction.f64le'),l25=measure(displayRgb(new Float64Array(Uint8Array.from(bytes).buffer),c.o.metadata.sky.rgbLinearDisplay),c),result={definition:'Fixed l25 dense lanes: native HERITAGE A_V at least 0.2 mag and accepted l25 green transmission at most 0.85. Both images use exactly these locations. Nearby bar light comes from a 3 arcminute weighted Gaussian using only low-column A_V <=0.15 pixels in the same catalogue-masked bar. Signals have 0.5 arcminute FWHM smoothing. Depth uses linear display green light; color ratios use displayed RGB. The darkest decile prevents an acceptable average from hiding black punctures.',photo,l25,tolerances:TOLERANCE};await writeFile(L26+'baseline.json',JSON.stringify(result,null,2)+'\n');
 const pixels=Buffer.alloc(c.av.length*3);for(let i=0;i<c.av.length;i++){pixels[i*3]=c.fullLanes[i]?230:0;pixels[i*3+1]=c.fullClear[i]?190:0;}await sharp(pixels,{raw:{width:c.full.width,height:c.full.height,channels:3}}).png().toFile(L26+'lane-mask.png');console.log(JSON.stringify({sentinel:'L26_LANES_MEASURED',...result}));
}
if(process.argv[1]?.endsWith('/dust-lanes/measure.mts'))await baselineReport();
