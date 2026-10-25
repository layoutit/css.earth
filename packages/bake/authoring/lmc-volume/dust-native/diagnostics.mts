/** Fixed HERITAGE-column masks measure lanes and intervals; no photograph sets a dust value. */
import {writeFile} from 'node:fs/promises';import sharp from 'sharp';
import {loadHeritage} from '../heritage-input.mts';import {sampleDensity} from '../heritage-layer.mts';
import {loadParent} from '../sequence-state.mts';import {loadObservation} from '../observation.mts';import {catalogueRows} from '../catalogue-data.mts';
import {unit,type V3} from '../geometry.mts';import {chord,column} from '../catalogue-volume.mts';
import {barWindow,contrast} from '../dust-contrast.mts';import {barAperture,photoRgb,displayRgb,ratios} from '../bar-ratios.mts';
import {rec,json,num,need} from '../inputs.mts';import {L24,sigmaToAv,MAG_PER_TAU} from './field.mts';
import type {Observation} from '../report.mts';import type {CatalogueScene} from '../catalogue-scene.mts';
export async function nativeAvMap(o:Observation,scene:CatalogueScene){
 const {image,wcs}=await loadHeritage(),meta=rec(await json(L24+'dust-column.json')),factor=num(rec(meta.normalization).factor),measured=new Float64Array(o.width*o.height),actual=new Float64Array(measured.length),coverage=new Float32Array(measured.length),byId=new Map(scene.dustLayer?.clouds?.map(v=>[Number(v.id.slice('HERITAGE-native-'.length)),v]));
 const {rayInBody,skyOf,normalize}=await import('../geometry.mts');
 for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){
  const i=y*o.width+x,ray=o.rayAt(x+.5,y+.5),sky=skyOf(ray),p=wcs.pixelOf(...sky);if(!p)continue;const q=sampleDensity(image.values,image.width,image.height,p[0],p[1]);coverage[i]=q.coverage;measured[i]=sigmaToAv(q.value)*q.coverage*factor;
  const body=rayInBody(ray),direction=normalize(body.direction);let tau=0;
  for(let b=Math.floor(p[1])-2;b<=Math.floor(p[1])+2;b++)for(let a=Math.floor(p[0])-2;a<=Math.floor(p[0])+2;a++){if(a<0||b<0||a>=image.width||b>=image.height)continue;const v=byId.get(b*image.width+a);if(!v)continue;const hit=chord(v,body.origin,direction);if(hit)tau+=v.weight*column(v,hit);}
  actual[i]=tau*MAG_PER_TAU;
 }
 return{measured,actual,coverage};
}
export async function laneDiagnostics(){
 const {scene}=await loadParent(24);need(scene.barGeometry&&scene.dustLayer,'Missing native dust');const {rows}=await catalogueRows(),o=await loadObservation(8),window=barWindow(o,scene.barGeometry,rows),crop=await loadObservation(8,window,{sky:o.metadata.sky.rgbLinearDisplay,commonFactor:o.metadata.normalization.commonFactor}),maps=await nativeAvMap(crop,scene),aperture=barAperture(crop,scene.barGeometry,rows),selected=Array.from(maps.measured).filter((v,i)=>aperture.mask[i]&&maps.coverage[i]>.999).sort((a,b)=>a-b),low=selected[Math.floor(selected.length*.25)],high=selected[Math.floor(selected.length*.75)],clear=Uint8Array.from(aperture.mask,(v,i)=>Number(v&&maps.coverage[i]>.999&&maps.measured[i]<=low)),lanes=Uint8Array.from(aperture.mask,(v,i)=>Number(v&&maps.coverage[i]>.999&&maps.measured[i]>=high));
 const {readFile}=await import('node:fs/promises'),read=async(p:string)=>{const b=await readFile(p);need(b.length===crop.width*crop.height*3*8,'Wrong native bar dimensions');return new Float64Array(Uint8Array.from(b).buffer);},photo=photoRgb(crop),old=displayRgb(await read(L24+'../l21/bar-prediction.f64le'),crop.metadata.sky.rgbLinearDisplay),current=displayRgb(await read(L24+'bar-prediction.f64le'),crop.metadata.sky.rgbLinearDisplay),measure=(rgb:Float64Array)=>{const c=ratios(rgb,clear),l=ratios(rgb,lanes);return{clear:c,lanes:l,brownColorRatio:(l.rg/l.bg)/(c.rg/c.bg),laneToClearG:l.meanG/c.meanG};};
 let error=0,power=0,samples=0;for(let i=0;i<maps.measured.length;i++)if(aperture.mask[i]&&maps.coverage[i]>.999&&maps.measured[i]>0){error+=(maps.actual[i]-maps.measured[i])**2;power+=maps.measured[i]**2;samples++;}
 const result={definition:'Fixed lower and upper HERITAGE A_V quartiles in the same catalogue-masked bar, using complete native measurement support only. Photo colors are checks only; no mask is selected by photo color.',thresholdsAv:{clearMaximum:low,laneMinimum:high},photo:measure(photo),l21:measure(old),l24:measure(current),nativeColumnReplay:{samples,relativeRms:Math.sqrt(error/power),meaning:'Actual complete 3D cloud chords versus the direct released column interpolant, before the bounded strength. Missing native support is omitted from this comparison.'}};
 await writeFile(L24+'lane-checks.json',JSON.stringify(result,null,2)+'\n');await writeFile(L24+'bar-native-av.f64le',Buffer.from(maps.measured.buffer));
 const pixels=Buffer.alloc(crop.width*crop.height*3);for(let i=0;i<maps.measured.length;i++){const t=Math.min(1,Math.log1p(maps.measured[i])/Math.log(4));pixels[i*3]=Math.round(255*t);pixels[i*3+1]=Math.round(180*t);pixels[i*3+2]=Math.round(90*t);}await sharp(pixels,{raw:{width:crop.width,height:crop.height,channels:3}}).png().toFile(L24+'bar-dust-column.png');
 console.log(JSON.stringify({sentinel:'L24_LANES_CHECKED',...result}));return result;
}
if(process.argv[1]?.endsWith('/dust-native/diagnostics.mts'))await laneDiagnostics();
