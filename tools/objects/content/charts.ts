import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readSpectrumData } from './spectrum-data.mts';
import { parseFitsGalleryImageRecipe,renderFitsGalleryImage } from './fits-gallery-image.mts';
import { renderLightCurveChart,renderReflectanceChart,renderTemperaturePressureChart,renderPhotometricPhaseChart } from './chart-svg.js';
import type { ChartIdentity } from './chart-svg.js';
type JsonMap=Record<string,unknown>;
interface Identity {id:string;title:string;description:string;output:string;metadata:JsonMap;}
interface Spectrum extends Identity {kind:'spectrum';source:string;format:'json-columns'|'numeric-lines';pointCount:number;maximum:number;maximumRoundingScale?:number;requiredHeader?:string;xField?:string;yField?:string;countField?:string;countValue?:number;xScale?:number;minimumX?:number;maximumX?:number;metadataFields?:Record<string,string>;}
interface Pressure extends Identity {kind:'pressure';source:string;layerCount:number;temperatureMinimum:number;temperatureMaximum:number;temperatureRoundingStep?:number;includePressureRangeMetadata?:boolean;pressureTicks:{pressure:number;label:string}[];}
interface Phase extends Identity {kind:'phase';sampleCount:number;maximumAngleDegrees:number;segments:({maximumAngleDegrees:number;coefficients:number[];kind:'polynomialMagnitude'}|{maximumAngleDegrees:number;coefficients:number[];kind:'albedoPolynomialMagnitude';constant:number})[];}
interface LightCurve extends Identity {kind:'light-curve';source:string;timeField:string;fluxField:string;maskField?:string;binMinutes:number;axisLabel:string;events:{time:number;label:string}[];}
export interface ChartAssetRecipe {schema:'cssearth-chart-assets@1';publicBase:string;charts:(Spectrum|Pressure|Phase|LightCurve)[];gallery?:{source:string;schema:string;itemCount:number};}
function record(value:unknown,label:string):JsonMap {if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${label} must be an object.`);return value as JsonMap;}
function string(value:unknown,label:string):asserts value is string {if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} must be text.`);}
function path(root:string,value:string):string {if(value.startsWith('/')||value.includes('\\')||value.split('/').includes('..'))throw new TypeError('Unsafe chart source path.');return resolve(root,value);}
function numericArray(value:unknown,label:string):number[]{if(!Array.isArray(value)||value.some(item=>typeof item!=='number'||!Number.isFinite(item)))throw new TypeError(`${label} must contain finite samples.`);return value;}
export function parseChartAssetRecipe(value:unknown):ChartAssetRecipe {
 const recipe=record(value,'charts');if(recipe.schema!=='cssearth-chart-assets@1'||!Array.isArray(recipe.charts))throw new TypeError('Unknown chart recipe schema.');string(recipe.publicBase,'publicBase');if(!recipe.publicBase.startsWith('/')||!recipe.publicBase.endsWith('/'))throw new TypeError('Chart asset base must be an absolute URL prefix.');
 for(const value of recipe.charts){const chart=record(value,'chart');for(const key of ['id','title','description','output'])string(chart[key],key);path('.',String(chart.output));record(chart.metadata,'metadata');if(!['spectrum','pressure','phase','light-curve'].includes(String(chart.kind)))throw new TypeError('Unknown chart operator.');
  if(chart.kind==='light-curve'){for(const key of ['source','timeField','fluxField','axisLabel'])string(chart[key],key);if(chart.maskField!==undefined)string(chart.maskField,'maskField');if(typeof chart.binMinutes!=='number'||!(chart.binMinutes>0)||!Array.isArray(chart.events))throw new TypeError('Invalid light curve profile.');for(const value of chart.events){const event=record(value,'event');if(typeof event.time!=='number'||!Number.isFinite(event.time))throw new TypeError('Invalid light curve event.');string(event.label,'event label');}}
  if(chart.kind==='spectrum'){string(chart.source,'source');if(!['json-columns','numeric-lines'].includes(String(chart.format))||typeof chart.pointCount!=='number'||!Number.isSafeInteger(chart.pointCount)||chart.pointCount<2||typeof chart.maximum!=='number'||!Number.isFinite(chart.maximum)||chart.maximum<=0||(chart.maximumRoundingScale!==undefined&&(typeof chart.maximumRoundingScale!=='number'||!Number.isFinite(chart.maximumRoundingScale)||chart.maximumRoundingScale<=0)))throw new TypeError('Invalid spectrum sampling profile.');}
  if(chart.kind==='pressure'){string(chart.source,'source');if(typeof chart.layerCount!=='number'||chart.layerCount<2||typeof chart.temperatureMinimum!=='number'||typeof chart.temperatureMaximum!=='number'||!Array.isArray(chart.pressureTicks)||(chart.temperatureRoundingStep!==undefined&&(typeof chart.temperatureRoundingStep!=='number'||!Number.isFinite(chart.temperatureRoundingStep)||chart.temperatureRoundingStep<=0))||(chart.includePressureRangeMetadata!==undefined&&typeof chart.includePressureRangeMetadata!=='boolean'))throw new TypeError('Invalid pressure profile.');}
  if(chart.kind==='phase'){if(typeof chart.sampleCount!=='number'||!Number.isSafeInteger(chart.sampleCount)||chart.sampleCount<3||typeof chart.maximumAngleDegrees!=='number'||chart.maximumAngleDegrees<=0||chart.maximumAngleDegrees>180||!Array.isArray(chart.segments)||!chart.segments.length)throw new TypeError('Invalid phase model.');let previous=0;for(const value of chart.segments){const segment=record(value,'segment');if(typeof segment.maximumAngleDegrees!=='number'||segment.maximumAngleDegrees<=previous||!['polynomialMagnitude','albedoPolynomialMagnitude'].includes(String(segment.kind)))throw new TypeError('Invalid phase segment.');numericArray(segment.coefficients,'coefficients');if(segment.kind==='albedoPolynomialMagnitude'&&(typeof segment.constant!=='number'||!Number.isFinite(segment.constant)))throw new TypeError('Invalid phase constant.');previous=segment.maximumAngleDegrees;}if(previous!==chart.maximumAngleDegrees)throw new TypeError('Phase segments do not cover the model.');}
 }
 if(recipe.gallery!==undefined){const gallery=record(recipe.gallery,'gallery');string(gallery.source,'gallery.source');string(gallery.schema,'gallery.schema');if(typeof gallery.itemCount!=='number'||!Number.isSafeInteger(gallery.itemCount)||gallery.itemCount<1)throw new TypeError('Gallery item count is invalid.');}
 return recipe as unknown as ChartAssetRecipe;
}
export async function prepareChartAssets({sourceDirectory,publicDirectory,config}:{sourceDirectory:string;publicDirectory:string;config:unknown}) {
 const recipe=parseChartAssetRecipe(config);await mkdir(publicDirectory,{recursive:true});const urls:string[]=[];
 for(const chart of recipe.charts){const identity:ChartIdentity={id:chart.id,title:chart.title,description:chart.description,metadata:{...chart.metadata}};let svg:string;
  if(chart.kind==='spectrum'){
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
  await writeFile(path(publicDirectory,chart.output),svg);urls.push(recipe.publicBase+chart.output);
 }
 let gallery:unknown;
 if(recipe.gallery){const source=record(JSON.parse(await readFile(path(sourceDirectory,recipe.gallery.source),'utf8')) as unknown,'gallery');if(source.schema!==recipe.gallery.schema||!Array.isArray(source.items)||source.items.length!==recipe.gallery.itemCount)throw new TypeError('Gallery source schema or item count drifted.');for(const key of ['id','qualification','credit','sourcePage'])string(source[key],`gallery.${key}`);const ids=new Set<string>(),files=new Set<string>();const items=[];
  for(const value of source.items){const item=record(value,'gallery item');for(const key of ['id','label','sourcePath','publicFilename','alt','caption','sourceUrl'])string(item[key],key);const filename=String(item.publicFilename),id=String(item.id);if(ids.has(id)||files.has(filename)||filename.includes('/'))throw new TypeError('Duplicate or unsafe gallery address.');ids.add(id);files.add(filename);
   // An item is the archive's own picture, published as it is, or a stated window of a FITS sky image drawn here.
   const file=await readFile(path(sourceDirectory,String(item.sourcePath))),bytes=item.fits===undefined?file:(await renderFitsGalleryImage(file,parseFitsGalleryImageRecipe(item.fits))).bytes,metadata=await sharp(bytes).metadata();if(metadata.width!==item.width||metadata.height!==item.height)throw new TypeError('Gallery source dimensions drifted.');await writeFile(path(publicDirectory,filename),bytes);const src=recipe.publicBase+filename;urls.push(src);items.push({id,label:item.label,src,width:item.width,height:item.height,alt:item.alt,caption:item.caption,sourceUrl:item.sourceUrl});}
  gallery={schema:'cssearth-prepared-gallery@1',id:source.id,open:false,qualification:source.qualification,credit:source.credit,sourcePage:source.sourcePage,items};
 }
 return {urls,...(gallery?{gallery}:{})};
}
