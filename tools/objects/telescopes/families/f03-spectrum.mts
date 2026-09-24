import type { FamilyHandler, FamilyOperation } from '../family-handlers.mts';
import type { DescriptorMember, ProductDescriptor } from '../product-descriptor.mts';
import { csv, descriptor, stable } from './common.mts';
import { requireFiniteNumber as finite } from '@cssearth/core';
import{ plotNumericPreview ,type FigureOptions}from'../../astronomy-packages/plots.mts';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface SpectrumSample {readonly id?:string;readonly wavelength:number;readonly value:number;readonly uncertainty?:number;readonly upperLimit?:boolean;readonly segment?:string}
export interface SpectrumDescription {readonly id:string;readonly target?:string;readonly member:DescriptorMember;readonly samples:readonly SpectrumSample[];readonly wavelengthUnit:string;readonly valueName:string;readonly valueUnit?:string;readonly spectralFrame?:string;readonly producingRecord:string;readonly calibrationBasis:readonly string[]}

export function validateSpectrum(samples:readonly SpectrumSample[]):readonly SpectrumSample[]{
  if(!samples.length)throw new TypeError('A standalone spectrum needs samples.');
  let prior:number|undefined,segment:string|undefined;
  for(const [index,sample] of samples.entries()){
    finite(sample.wavelength,`wavelength ${index}`);finite(sample.value,`value ${index}`);
    if(sample.uncertainty!==undefined&&(!(finite(sample.uncertainty,`uncertainty ${index}`)>0)))throw new TypeError('Spectrum uncertainties must be positive.');
    if(sample.id!==undefined)stable(sample.id,'spectrum sample id');
    const next=sample.segment??'0';if(next===segment&&prior!==undefined&&sample.wavelength<=prior)throw new TypeError('Spectrum wavelengths must increase within each segment.');
    segment=next;prior=sample.wavelength;
  }
  return samples;
}

export function exportSpectrumCsv(samples:readonly SpectrumSample[]):string{
  validateSpectrum(samples);return csv(['id','segment','wavelength','value','uncertainty','upper_limit'],samples.map((sample,index)=>[sample.id??String(index),sample.segment??'',sample.wavelength,sample.value,sample.uncertainty,sample.upperLimit?1:0]));
}
/** Return native samples in an explicit spectral interval; segment boundaries stay intact. */
export function selectSpectrumRange(samples:readonly SpectrumSample[],range:{readonly from:number;readonly to:number}){validateSpectrum(samples);if(!Number.isFinite(range.from)||!Number.isFinite(range.to)||range.to<range.from)throw new TypeError('Spectrum range must be finite and ordered.');return samples.filter(sample=>sample.wavelength>=range.from&&sample.wavelength<=range.to);}
/** Plot-ready native coordinates, including censored values, for the existing figure owner. */
export function spectrumChartData(samples:readonly SpectrumSample[]){validateSpectrum(samples);return samples.map((sample,index)=>({id:sample.id??String(index),segment:sample.segment??'0',wavelength:sample.wavelength,value:sample.value,...(sample.uncertainty===undefined?{}:{uncertainty:sample.uncertainty}),upperLimit:sample.upperLimit===true}));}
/** Bound only the figure; exports and chart data retain every usable native sample. */
export function spectrumPreviewSamples(samples:readonly SpectrumSample[]){
  validateSpectrum(samples);
  const maximum=1600, count=Math.min(maximum,samples.length);
  const selected=count===samples.length?samples:Array.from({length:count},(_,i)=>samples[Math.round(i*(samples.length-1)/(count-1))]!);
  return {samples:selected,sampling:{method:'uniform native-sample selection; no averaging or interpolation',sourceSamples:samples.length,drawnSamples:count,maximumSamples:maximum,gaps:'Original segment identities retained; no lines across excluded samples.'}};
}
export async function previewSpectrum(out:string,title:string,samples:readonly SpectrumSample[],wavelengthLabel='Wavelength',valueLabel='Value',options:FigureOptions={}){
  const preview=spectrumPreviewSamples(samples),groups=new Map<string,SpectrumSample[]>();
  for(const sample of preview.samples){const key=sample.segment??'0',group=groups.get(key);if(group)group.push(sample);else groups.set(key,[sample]);}
  const rendered=await plotNumericPreview(out,{kind:'series',title:preview.sampling.drawnSamples<samples.length?`${title}\nPreview: ${preview.sampling.drawnSamples} of ${samples.length} usable samples`:title,xLabel:wavelengthLabel,yLabel:valueLabel,series:[...groups].map(([label,points])=>({label,x:points.map(point=>point.wavelength),y:points.map(point=>point.value),uncertainty:points.map(point=>point.uncertainty??null),upperLimit:points.map(point=>point.upperLimit===true)}))},options);
  await writeFile(resolve(out,'preview-sampling.json'),`${JSON.stringify(preview.sampling,null,2)}\n`);
  return {...rendered,files:[...rendered.files,'preview-sampling.json']};
}

export function describeStandaloneSpectrum(input:SpectrumDescription):ProductDescriptor{
  const samples=validateSpectrum(input.samples),uncertainty=samples.some(sample=>sample.uncertainty!==undefined),limits=samples.some(sample=>sample.upperLimit),segments=new Set(samples.map(sample=>sample.segment??'0'));
  return descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'spectrum id'),...(input.target?{target:input.target}:{}),acquisition:{kind:'repository',identity:input.member.path},producingRecord:input.producingRecord,sourceClassifications:[{term:'spectrum',vocabulary:'cssEarth observational families',version:'1',status:'mapped'}],families:['F03'],profiles:[{handlerId:'f03-spectrum',profileId:'sampled-spectrum-table@1'}]},members:[input.member],components:[{id:'spectrum',name:input.valueName,families:['F03'],locations:[{memberId:input.member.id}],representation:{kind:'table',rows:samples.length},axes:[{id:'wavelength',index:0,length:samples.length,role:'spectral',unit:input.wavelengthUnit,coordinates:{kind:'lookup',memberId:input.member.id,locator:'wavelength',binBounds:false},...(input.spectralFrame?{frame:input.spectralFrame}:{})}],columns:[{id:'sample-id',name:'id',role:'row-identity',datatype:'string',nullable:false,variableLength:false},{id:'segment',name:'segment',role:'spectral-segment',datatype:'string',nullable:segments.size===1,variableLength:false},{id:'value',name:'value',role:'measurement',datatype:'float64',...(input.valueUnit?{unit:input.valueUnit}:{}),nullable:false,variableLength:false},...(uncertainty?[{id:'uncertainty',name:'uncertainty',role:'standard-deviation',datatype:'float64',...(input.valueUnit?{unit:input.valueUnit}:{}),nullable:true,variableLength:false} as const]:[]),...(limits?[{id:'upper-limit',name:'upper_limit',role:'limit-flag',datatype:'boolean',nullable:false,variableLength:false} as const]:[])],quantity:{name:input.valueName,semantics:'Standalone sampled spectrum; gaps and segments are retained.',...(input.valueUnit?{unit:input.valueUnit}:{})},calibration:{state:'archive-calibrated',basis:input.calibrationBasis},...(uncertainty?{uncertainty:{form:'standard-deviation',columnId:'uncertainty',basis:'Per-sample supplied uncertainty.'} as const}:{}),flags:limits?[{id:'upper-limit',meaning:'The value is an upper limit.',columnId:'upper-limit',usableWhen:'Retain as a censored measurement; do not treat as a detection.'}]:[],dependencyIds:[]}],dependencies:[],issues:[...(!uncertainty?[{scope:'component' as const,identity:'spectrum',state:'missing' as const,reason:'No per-sample uncertainty is supplied.'}]:[]),...(segments.size>1?[{scope:'axis' as const,identity:'wavelength',state:'unknown' as const,reason:'The spectral axis contains explicit disjoint segments; no interpolation across gaps is permitted.'}]:[])]});
}

const operation=(componentId:string,id:string,label:string,owner:string,parameters:any[]=[]):FamilyOperation=>({id,label,handlerId:'f03-spectrum',componentId,owner:{module:'tools/objects/telescopes/families/f03-spectrum.mts',export:owner},available:true,reason:'Native samples, segment identities and censored values remain explicit.',fixedArguments:{},parameters:[...parameters,{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:['No resampling, interpolation, order stitching, or counts-to-flux conversion is implicit.']});
export const F03_SPECTRUM_HANDLER:FamilyHandler={id:'f03-spectrum',families:['F03'],profiles:[{id:'eso-sdp-spectrum@1',format:'ESO SDP single-record FITS spectrum',version:'1',families:['F03'],publicBaseline:true,evidence:[{path:'tools/objects/telescopes/families/f03-eso-spectrum.test.mts',establishes:'Native WAVE/FLUX/ERR units, quality exclusions and segment preservation.',status:'complete'}]},{id:'sampled-spectrum-table@1',format:'Sampled spectrum table or pinned structured columns',version:'1',families:['F03'],publicBaseline:true,evidence:[{path:'src/objects/mercury/source/spectrum/mascs-global-area-weighted-mean.json',establishes:'Pinned 326-sample real MESSENGER MASCS spectrum with archive digest, aggregation provenance and public range/data/preview operations.',status:'complete'}]}],recognizes:members=>members.some(member=>/spectrum.*\.(?:csv|json|fits)$/iu.test(member.path))?['sampled-spectrum-table@1']:[],operations:product=>product.components.filter(component=>component.families.includes('F03')).flatMap(component=>[operation(component.id,'spectrum-export','Export standalone spectrum','exportSpectrumCsv'),operation(component.id,'spectrum-select-range','Select spectral range','selectSpectrumRange',[{id:'range',option:'--range',kind:'number-list',required:true,count:2,description:'Inclusive native spectral-coordinate bounds.'}]),operation(component.id,'spectrum-chart-data','Prepare spectrum chart data','spectrumChartData'),operation(component.id,'spectrum-preview','Render spectrum preview','previewSpectrum')])};
