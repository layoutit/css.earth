/** Evidence-backed advice for a fetched source. A name, a field position and a detection are different claims. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import type { NativeMetadata } from './native-metadata.mts';
import type { OutputChoice } from './outputs.mts';
import type { ProductDescriptor } from './product-descriptor.mts';
import { PRODUCT_KINDS } from './query.mts';
import { parseSkyTarget } from './sky/target.mts';
import { parseRegion } from './vo/contracts.mts';

type Verdict = { readonly status:'supported'|'unsupported'|'unknown'|'not-requested';readonly reason:string };
export interface SourceQuestion {
  readonly target:string;
  readonly archiveTargetName?:string;
  readonly kind?:string;
  readonly wavelengthMicrometres?:readonly [number,number];
  readonly family?:string;
  readonly position?:{ readonly raDegrees:number;readonly decDegrees:number;readonly basis:'SIMBAD position'|'requested ICRS circle centre' };
}
export interface SourceRelevance {
  readonly target:string;
  readonly archiveTarget:{readonly status:'named'|'unknown';readonly name?:string;readonly reason:string};
  readonly field:{readonly status:'in-field'|'outside-field'|'unknown';readonly basis?:string;readonly reason:string};
  readonly detection:{readonly status:'unassessed';readonly reason:string};
  readonly requested:{readonly kind?:string;readonly wavelengthMicrometres?:readonly [number,number];readonly family?:string};
  readonly fit:{readonly kind:Verdict;readonly wavelength:Verdict;readonly family:Verdict};
  readonly contents:readonly {readonly structure:string;readonly shape?:readonly number[];readonly usableSamples?:number;readonly unit?:string;readonly mask?:string;readonly uncertainty?:string;readonly calibration:readonly string[];readonly wavelength?:readonly [number,number];readonly field?:NativeMetadata['skyPosition']}[];
  readonly next:string;
}

/** Both files are in the verified product output closure before this is called. */
export async function readSourceQuestion(root:string):Promise<SourceQuestion>{
  const source=requireRecord(JSON.parse(await readFile(resolve(root,'source.json'),'utf8')),'pinned archive source');
  if(source.schema!=='cssearth-archive-source@1'&&source.schema!=='cssearth-keck-source@1')throw new TypeError('Unsupported archive source evidence');
  const exploration=requireRecord(JSON.parse(await readFile(resolve(root,'explore.json'),'utf8')),'pinned exploration');
  const answer=requireRecord(exploration.answer,'exploration answer'),request=requireRecord(answer.request,'exploration request');
  const target=requireString(source.target,'source target');
  if(target!==exploration.target||target!==answer.target||target!==request.target)throw new TypeError('Source and exploration targets disagree');
  const discovery=source.discovery===undefined?undefined:requireRecord(source.discovery,'source discovery');
  const selected=source.selected===undefined?undefined:requireRecord(source.selected,'selected source');
  const archiveTargetName=[selected?.targetName,discovery?.targetName,discovery?.opusTarget].find(value=>typeof value==='string'&&value.trim());
  const wavelength=request.wavelengthMicrometres===undefined?undefined:requireArray(request.wavelengthMicrometres,'requested wavelength').map(value=>requireFiniteNumber(value,'requested wavelength'));
  if(wavelength&&(wavelength.length!==2||wavelength[0]!<=0||wavelength[1]!<wavelength[0]!))throw new TypeError('Invalid saved wavelength request');
  const sky=request.skyTarget===undefined?undefined:parseSkyTarget(request.skyTarget);
  const circle=request.region===undefined?undefined:parseRegion(request.region);
  const point=sky??circle;
  const position=point?{raDegrees:requireFiniteNumber(point.raDegrees,'position RA'),decDegrees:requireFiniteNumber(point.decDegrees,'position Dec'),basis:sky?'SIMBAD position' as const:'requested ICRS circle centre' as const}:undefined;
  if(position&&(position.raDegrees<0||position.raDegrees>=360||position.decDegrees < -90||position.decDegrees>90))throw new TypeError('Invalid saved sky position');
  if(request.kind!==undefined&&!(PRODUCT_KINDS as readonly string[]).includes(requireString(request.kind,'requested kind')))throw new TypeError('Invalid saved product kind');
  return {target,...(typeof archiveTargetName==='string'?{archiveTargetName}:{}),
    ...(typeof request.kind==='string'?{kind:request.kind}:{}),...(wavelength?{wavelengthMicrometres:wavelength as [number,number]}:{}),
    ...(typeof request.family==='string'?{family:request.family}:{}),...(position?{position}:{})};
}

const verdict=(status:Verdict['status'],reason:string):Verdict=>({status,reason});
function covers(intervals:readonly (readonly [number,number])[],requested:readonly [number,number]):Verdict{
  if(!intervals.length)return verdict('unknown','No usable native wavelength-bin edges establish continuous coverage.');
  const sorted=intervals.slice().sort((a,b)=>a[0]-b[0]);
  if(!sorted.some(([a,b])=>a<=requested[1]&&b>=requested[0]))return verdict('unsupported','Qualified native wavelength bins do not intersect the requested interval.');
  let edge=requested[0];
  for(const [start,end] of sorted)if(start<=edge+1e-10*Math.max(1,Math.abs(edge)))edge=Math.max(edge,end);
  return edge>=requested[1]-1e-10*Math.max(1,Math.abs(edge))
    ?verdict('supported','Usable native wavelength-bin edges cover the requested interval.')
    :verdict('unknown','Native wavelength bins overlap the request but do not establish complete coverage.');
}

export function assessSourceRelevance(question:SourceQuestion,metadata:readonly NativeMetadata[],outputs:readonly OutputChoice[],descriptor?:ProductDescriptor):SourceRelevance{
  const represented=descriptor?.components.map(component=>component.representation.kind)??[];
  const descriptorArrays=descriptor?.components.filter(component=>component.representation.kind==='array')??[];
  const contents:SourceRelevance['contents'][number][]=metadata.map(item=>{
    const centers=item.spectral?.centersMicrometres;
    return {structure:item.structure,...(item.shape?{shape:item.shape}:{}),...(item.quality?{usableSamples:item.quality.usable}:{}),
      unit:item.units?.value??'not recorded',mask:item.quality?.mask??'none identified',
      uncertainty:item.uncertainty?.status==='validated'?item.uncertainty.kind??'validated':'not validated',
      calibration:item.calibration.map(row=>`${row.field}: ${row.value}`),
      ...(centers?.length?{wavelength:[Math.min(centers[0]!,centers.at(-1)!),Math.max(centers[0]!,centers.at(-1)!)] as [number,number]}:{}),
      ...(item.skyPosition?{field:item.skyPosition}:{})};
  });
  for(const component of descriptor?.components??[])contents.push({structure:`${component.id} (${component.representation.kind})`,
    ...(component.representation.kind==='array'?{shape:component.representation.shape}:{}),
    ...(component.quantity.unit?{unit:component.quantity.unit}:{}),
    uncertainty:component.uncertainty?.form??'unknown',calibration:[`${component.calibration.state}: ${component.calibration.basis.join('; ')}`]});
  const known=metadata.length>0||represented.length>0;
  let kind:Verdict;
  if(!question.kind)kind=verdict('not-requested','No product kind was requested.');
  else if(!known)kind=verdict('unknown','No supported native science structure was identified in these pinned bytes.');
  else {
    const cube=metadata.some(item=>item.shape&&item.shape.length===3&&item.shape[0]!>1&&!!item.quality?.usable);
    const offered=question.kind==='cube'?metadata.some(item=>item.shape&&item.shape.length===3&&item.shape[0]!>1&&!!item.quality?.usable&&item.spectral?.axis===0)
      :question.kind==='image'?outputs.some(choice=>choice.kind==='image'&&choice.available)||descriptorArrays.some(component=>component.representation.kind==='array'&&component.representation.shape.length===2)
      :question.kind==='spectrum'?outputs.some(choice=>choice.kind==='spectrum'&&choice.available)||descriptor?.components.some(component=>component.families.includes('F03'))
      :question.kind==='events'?represented.includes('events')
      :question.kind==='table'?represented.includes('table')
      :question.kind==='photometry'?descriptor?.components.some(component=>component.families.includes('F05'))
      :question.kind==='strips'?descriptor?.components.some(component=>component.families.includes('F04')):false;
    kind=question.kind==='cube'&&(cube||descriptorArrays.some(component=>component.representation.kind==='array'&&component.representation.shape.length===3))&&!offered
      ?verdict('unknown','A three-dimensional array is present, but its spectral axis is not qualified by this inspection.')
      :verdict(offered?'supported':'unsupported',offered?'A verified native structure or available operation supports the requested kind.':'This fetched source has no verified structure or operation for the requested kind.');
  }
  const intervals=metadata.map(item=>{
    const edges=item.spectral?.binEdgesMicrometres,usable=item.spectral?.usableBands;
    return edges?.slice(0,-1).flatMap((edge,index)=>usable?.[index]===false?[]:[[Math.min(edge,edges[index+1]!),Math.max(edge,edges[index+1]!)] as [number,number]])??[];
  });
  const wavelength=!question.wavelengthMicrometres?verdict('not-requested','No wavelength interval was requested.')
    :intervals.some(rows=>covers(rows,question.wavelengthMicrometres!).status==='supported')
      ?verdict('supported','One usable native science structure has wavelength-bin edges covering the requested interval.')
      :intervals.length>0&&intervals.every(rows=>rows.length>0)&&covers(intervals.flat(),question.wavelengthMicrometres).status==='unsupported'
        ?verdict('unsupported','No usable native wavelength bin intersects the requested interval.')
        :verdict('unknown','Native wavelength coordinates do not establish complete coverage in one usable science structure.');
  const family=question.family?descriptor?verdict(descriptor.dataset.families.some(id=>id===question.family)?'supported':'unsupported',
    descriptor.dataset.families.some(id=>id===question.family)?'The pinned descriptor names the requested family.':'The pinned descriptor does not name the requested family.')
    :verdict('unknown','No pinned family descriptor establishes this source family.'):verdict('not-requested','No family was requested.');
  const positions=metadata.map(item=>item.skyPosition).filter((item):item is NonNullable<typeof item>=>!!item);
  const field:SourceRelevance['field']=!question.position?{status:'unknown',reason:'No saved ICRS position was available for a native field check.'}
    :positions.some(item=>item.status==='in-field')?{status:'in-field',basis:question.position.basis,reason:'Astropy projected the saved position inside a two-dimensional science image grid; this does not prove a usable sample or detection.'}
    :positions.length&&positions.every(item=>item.status==='outside-field')?{status:'outside-field',basis:question.position.basis,reason:'Astropy projected the saved position outside every supported two-dimensional science image grid.'}
    :{status:'unknown',basis:question.position.basis,reason:'The native product has no conclusive two-dimensional celestial WCS for this position.'};
  const available=outputs.filter(output=>output.available).map(output=>output.kind);
  const next=kind.status==='unsupported'||wavelength.status==='unsupported'||family.status==='unsupported'||field.status==='outside-field'
    ?'Choose another source or revise the request; this file does not support at least one requested constraint.'
    :available.length?`Inspect the available ${[...new Set(available)].join(', ')} operation(s) below and choose explicit selectors; source fitness remains unassessed.`
    :descriptor?.components.length?'Inspect the family operations below; this descriptor does not itself establish target detection or scientific fitness.'
    :'No supported science output route recognizes these pinned bytes; inspect the original archive files or add a qualified native decoder.';
  return {target:question.target,archiveTarget:question.archiveTargetName?{status:'named',name:question.archiveTargetName,reason:'The archive supplied this name; naming does not establish field coverage or detection.'}:{status:'unknown',reason:'The pinned archive lead supplies no separate target name.'},
    field,detection:{status:'unassessed',reason:'Source inspection does not measure or identify the requested target in the data.'},
    requested:{...(question.kind?{kind:question.kind}:{}),...(question.wavelengthMicrometres?{wavelengthMicrometres:question.wavelengthMicrometres}:{}),...(question.family?{family:question.family}:{})},
    fit:{kind,wavelength,family},contents,next};
}
