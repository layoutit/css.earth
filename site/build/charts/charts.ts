import { parseChartAssetRecipe } from '@cssearth/objects';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readSpectrumData, type SpectrumRecipe } from '../../overview/spectrum-data.mts';
import { parseFitsGalleryImageRecipe, parseMeasuredSpectrum, parseRetrievedProfile, parseSystemOrbits, readMeasuredSpectrum, readRetrievedProfile, readSystemOrbits, renderFitsGalleryImage, renderFoldedTransit, renderLightCurveChart, renderMeasuredSpectrum, renderPhotometricPhaseChart, renderReflectanceChart, renderRetrievedProfile, renderSystemOrbits, renderTemperaturePressureChart } from '@cssearth/bake/objects/charts';
import type { ChartIdentity, MeasuredSpectrumRecipe, RetrievedProfileRecipe, SystemOrbitsRecipe } from '@cssearth/bake/objects/charts';
type JsonMap=Record<string,unknown>;
export { parseChartAssetRecipe, type ChartAssetRecipe } from '@cssearth/objects';
function record(value:unknown,label:string):JsonMap {if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${label} must be an object.`);return value as JsonMap;}
function string(value:unknown,label:string):asserts value is string {if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} must be text.`);}
function path(root:string,value:string):string {if(value.startsWith('/')||value.includes('\\')||value.split('/').includes('..'))throw new TypeError('Unsafe chart source path.');return resolve(root,value);}
export async function prepareChartAssets({sourceDirectory,publicDirectory,config}:{sourceDirectory:string;publicDirectory:string;config:unknown}) {
 const recipe=parseChartAssetRecipe(config);await mkdir(publicDirectory,{recursive:true});const urls:string[]=[];
 const dimensions:{src:string;width:number;height:number}[]=[];
 for(const chart of recipe.charts){const identity:ChartIdentity={id:chart.id,title:chart.title,description:chart.description,metadata:{...chart.metadata}};let svg:string;
  if(chart.kind==='measured-spectrum'){
   svg=renderMeasuredSpectrum(await readMeasuredSpectrum(sourceDirectory,chart));
  }else if(chart.kind==='folded-transit'){
   // The host's light curves, each transit divided by its baseline line and folded onto the planet's orbit (foldTransits), then
   // averaged in bins of fixed width; a bin's error is the standard error of its samples.
   const {foldTransits,readTessLightCurve,transitWindow}=await import('@cssearth/bake/objects/raster');const {hostedOrbit}=await import('@cssearth/astronomy');
   const curves=await Promise.all(chart.sources.map(async source=>readTessLightCurve(await readFile(path(sourceDirectory,source)))));
   // A recipe aligned on the dip TESS measures moves the orbit's transit by alignMinutes, which the generator keeps inside the ephemeris's uncertainty.
   const base=hostedOrbit(chart.planet as Parameters<typeof hostedOrbit>[0]),orbit={...base,transitTimeBmjdTdb:base.transitTimeBmjdTdb+(chart.alignMinutes??0)/1440},folded=foldTransits(curves,orbit,transitWindow(chart.durationHours));
   if(!folded.transits)throw new TypeError(`${chart.id}: no transit of ${chart.planet} in ${chart.sources.join(', ')} has enough samples on both sides.`);
   const width=chart.binMinutes/60,groups=new Map<number,number[]>();
   folded.time.forEach((time,i)=>{const bin=Math.round((time-orbit.transitTimeBmjdTdb)*24/width);groups.set(bin,[...(groups.get(bin)??[]),folded.flux[i]!]);});
   const bins=[...groups].filter(([,values])=>values.length>=3).sort(([a],[b])=>a-b).map(([bin,values])=>{const mean=values.reduce((sum,value)=>sum+value,0)/values.length,spread=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1));return {hours:bin*width,ppm:(mean-1)*1e6,error:spread/Math.sqrt(values.length)*1e6,samples:values.length};});
   identity.metadata={...identity.metadata,sectors:curves.map(curve=>curve.sector),binMinutes:chart.binMinutes,...(chart.alignMinutes?{alignMinutes:chart.alignMinutes}:{})};
   svg=renderFoldedTransit({...identity,bins,transits:folded.transits,notes:chart.notes});
  }else if(chart.kind==='system-orbits'){
   const orbits=parseSystemOrbits(chart);svg=renderSystemOrbits(orbits,readSystemOrbits(orbits));
  }else if(chart.kind==='retrieved-profile'){
   svg=renderRetrievedProfile(await readRetrievedProfile(sourceDirectory,chart));
  }else if(chart.kind==='spectrum'){
   const {points,maximum,metadata}=await readSpectrumData(sourceDirectory,chart);
   identity.metadata=metadata;
   svg=renderReflectanceChart({...identity,points,maximum});
  }else if(chart.kind==='pressure'){
   const text=await readFile(path(sourceDirectory,chart.source),'utf8');const layers=[...text.matchAll(/<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/g)].map(([,index,row])=>{const [pressure,temperature]=row.split(',').map(Number);return {index:Number(index),pressure,temperature};});
   if(layers.length!==chart.layerCount||layers.some((layer,index)=>layer.index!==index+1||!Number.isFinite(layer.pressure)||layer.pressure<=0||!Number.isFinite(layer.temperature)))throw new TypeError('Pressure layers drifted.');
   const pressureMinimum=layers[layers.length-1].pressure,pressureMaximum=layers[0].pressure;if(chart.includePressureRangeMetadata!==false)identity.metadata.pressureRangeBar=[pressureMinimum,pressureMaximum];
   if(identity.metadata.temperatureRangeKelvin===null)identity.metadata.temperatureRangeKelvin=[Math.min(...layers.map(layer=>layer.temperature)),Math.max(...layers.map(layer=>layer.temperature))];
   const temperatureMinimum=chart.temperatureRoundingStep===undefined?chart.temperatureMinimum:Math.floor(Math.min(...layers.map(layer=>layer.temperature))/chart.temperatureRoundingStep)*chart.temperatureRoundingStep;
   const temperatureMaximum=chart.temperatureRoundingStep===undefined?chart.temperatureMaximum:Math.ceil(Math.max(...layers.map(layer=>layer.temperature))/chart.temperatureRoundingStep)*chart.temperatureRoundingStep;
   svg=renderTemperaturePressureChart({...identity,layers,pressureMinimum,pressureMaximum,temperatureMinimum,temperatureMaximum,pressureTicks:chart.pressureTicks});
  }else if(chart.kind==='light-curve'){
   // Masked samples are dropped; the rest are averaged in bins from the first sample and shown as the change from their median.
   const rows=(await readFile(path(sourceDirectory,chart.source),'utf8')).trim().split(/\r?\n/u),header=rows[0]!.split(','),column=(name:string)=>{const index=header.indexOf(name);if(index<0)throw new TypeError(`The light curve has no ${name} column.`);return index;};
   const t=column(chart.timeField),f=column(chart.fluxField),m=chart.maskField===undefined?-1:column(chart.maskField);
   const samples=rows.slice(1).map(line=>line.split(',').map(Number)).filter(row=>Number.isFinite(row[t]!)&&Number.isFinite(row[f]!)&&(m<0||row[m]===0)).sort((a,b)=>a[t]!-b[t]!);
   if(samples.length<3)throw new TypeError('The light curve has too few samples.');
   const start=samples[0]![t]!,width=chart.binMinutes/1440,bins=new Map<number,number[]>();
   for(const row of samples){const bin=Math.floor((row[t]!-start)/width);bins.set(bin,[...(bins.get(bin)??[]),row[f]!]);}
   const averaged=[...bins].sort(([a],[b])=>a-b).map(([bin,values])=>({hours:bin===0?0:(bin+.5)*chart.binMinutes/60,flux:values.reduce((sum,value)=>sum+value,0)/values.length}));
   const sorted=averaged.map(point=>point.flux).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]!;
   identity.metadata={...identity.metadata,samples:samples.length,binMinutes:chart.binMinutes};
   svg=renderLightCurveChart({...identity,axisLabel:chart.axisLabel,points:averaged.map(point=>({hours:point.hours,flux:(point.flux/median-1)*1e6})),events:chart.events.map(event=>({hours:(event.time-start)*24,label:event.label}))});
  }else{
   const evaluate=(angle:number)=>{const segment=chart.segments.find(segment=>angle<=segment.maximumAngleDegrees);if(!segment)throw new RangeError('Phase angle outside declared segments.');const value=segment.coefficients.reduceRight((sum,coefficient)=>sum*(segment.kind==='polynomialMagnitude'?angle:angle/180)+coefficient,0);if(segment.kind==='polynomialMagnitude')return value;if(value<=0)throw new RangeError('Phase albedo is nonpositive.');return segment.constant-2.5*Math.log10(value);};
   const zero=evaluate(0),points=Array.from({length:chart.sampleCount},(_,index)=>{const phaseAngle=chart.maximumAngleDegrees*index/(chart.sampleCount-1);return {phaseAngle,dimmingMagnitude:evaluate(phaseAngle)-zero};});
   svg=renderPhotometricPhaseChart({...identity,points});
  }
  const {width,height}=await sharp(Buffer.from(svg)).metadata();
  if(!width||!height)throw new TypeError('Prepared chart has no intrinsic dimensions.');
  const src=recipe.publicBase+chart.output;dimensions.push({src,width,height});
  await writeFile(path(publicDirectory,chart.output),svg);urls.push(src);
 }
 let gallery:unknown;
 if(recipe.gallery){const source=record(JSON.parse(await readFile(path(sourceDirectory,recipe.gallery.source),'utf8')) as unknown,'gallery');if(source.schema!==recipe.gallery.schema||!Array.isArray(source.items)||source.items.length!==recipe.gallery.itemCount)throw new TypeError('Gallery source schema or item count drifted.');for(const key of ['id','qualification','credit','sourcePage'])string(source[key],`gallery.${key}`);const ids=new Set<string>(),files=new Set<string>();const items=[];
  for(const value of source.items){const item=record(value,'gallery item');for(const key of ['id','label','sourcePath','publicFilename','alt','caption','sourceUrl'])string(item[key],key);const filename=String(item.publicFilename),id=String(item.id);if(ids.has(id)||files.has(filename)||filename.includes('/'))throw new TypeError('Duplicate or unsafe gallery address.');ids.add(id);files.add(filename);
   // An item is the archive's own picture, published as it is, or a stated window of a FITS sky image drawn here.
   const file=await readFile(path(sourceDirectory,String(item.sourcePath))),bytes=item.fits===undefined?file:(await renderFitsGalleryImage(file,parseFitsGalleryImageRecipe(item.fits))).bytes,metadata=await sharp(bytes).metadata();if(metadata.width!==item.width||metadata.height!==item.height)throw new TypeError('Gallery source dimensions drifted.');await writeFile(path(publicDirectory,filename),bytes);const src=recipe.publicBase+filename;urls.push(src);items.push({id,label:item.label,src,width:item.width,height:item.height,alt:item.alt,caption:item.caption,sourceUrl:item.sourceUrl});}
  gallery={schema:'cssearth-prepared-gallery@1',id:source.id,open:false,qualification:source.qualification,credit:source.credit,sourcePage:source.sourcePage,items};
 }
 return {urls,dimensions,...(gallery?{gallery}:{})};
}
