/** Family-aware request adapter. It translates legacy telescope criteria once, then evaluates only retained descriptor facts. */
import type { CapabilityRequest, ConstraintAnswer, ConstraintVerdict } from './query.mts';
import type { AxisDescriptor, FamilyId, ProductDescriptor } from './product-descriptor.mts';
import { parseProductDescriptor } from './product-descriptor.mts';

export type FamilyCriterionName='family'|'quantity'|'time'|'spectral'|'spatial'|'table'|'polarization'|'visibility';
export interface FamilyCriteria {
  readonly quantity?: string;
  readonly time?: true;
  readonly spectral?: { readonly intervalMicrometres?: readonly [number,number] };
  readonly spatial?: true;
  readonly table?: { readonly columns:readonly string[] };
  readonly polarization?: { readonly components:readonly string[] };
  readonly visibility?: true;
}
export interface FamilyScientificRequest {readonly legacy:CapabilityRequest;readonly family?:FamilyId;readonly criteria?:FamilyCriteria}
export interface NormalizedFamilyRequest {readonly legacy:CapabilityRequest;readonly family?:FamilyId;readonly criteria:FamilyCriteria}
export interface FamilyRequestAssessment {readonly request:NormalizedFamilyRequest;readonly verdicts:Readonly<Record<FamilyCriterionName,ConstraintVerdict|undefined>>}
const verdict=(answer:ConstraintAnswer,reason:string):ConstraintVerdict=>({answer,reason});
const norm=(text:string)=>text.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu,'-').replaceAll(/^-|-$/gu,'');
const supported:Readonly<Record<FamilyCriterionName,readonly FamilyId[]>>={
  family:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  quantity:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  time:['F06','F07','F10','F11','F12','F15'], spectral:['F01','F02','F03','F05','F07','F08','F11','F12','F13','F15'], spatial:['F01','F02','F13'],
  table:['F03','F05','F06','F08','F09','F10','F11','F12','F17'], polarization:['F11','F12','F13'], visibility:['F11','F12']
};
function assertCriterionFamily(family:FamilyId|undefined,criteria:FamilyCriteria){if(!family)return;for(const key of Object.keys(criteria) as (keyof FamilyCriteria)[]){if(criteria[key]!==undefined&&!supported[key].includes(family))throw new TypeError(`${key} is physically inapplicable to ${family}.`);}}
/** Legacy wavelengths/time/resolution are translated exactly once. More specific family criteria remain optional. */
export function normalizeFamilyRequest(request:CapabilityRequest,extra:{readonly family?:FamilyId;readonly criteria?:FamilyCriteria}={}):NormalizedFamilyRequest{
  if(!request.target)throw new TypeError('Legacy request target is required.');
  const criteria:FamilyCriteria={...(extra.criteria??{}),...(extra.criteria?.spectral===undefined?{spectral:{intervalMicrometres:request.wavelengthMicrometres}}:{}),...(extra.criteria?.time===undefined&&request.time!==undefined?{time:true}:{}),...(extra.criteria?.spatial===undefined&&(request.angularResolutionArcsec!==undefined||request.surfaceResolutionKm!==undefined||request.resolutionElements!==undefined)?{spatial:true}:{})};
  if(criteria.quantity!==undefined&&!criteria.quantity.trim())throw new TypeError('Quantity criterion cannot be blank.');
  if(criteria.spectral?.intervalMicrometres!==undefined){const [a,b]=criteria.spectral.intervalMicrometres;if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<a)throw new TypeError('Spectral criterion must be an increasing positive interval.');}
  if(criteria.table?.columns.some(column=>!column.trim()))throw new TypeError('Table criterion columns cannot be blank.');
  if(criteria.polarization?.components.some(component=>!component.trim()))throw new TypeError('Polarization components cannot be blank.');
  assertCriterionFamily(extra.family,criteria);return{legacy:request,family:extra.family,criteria};
}
const hasAxes=(product:ProductDescriptor,roles:readonly string[])=>product.components.some(component=>roles.every(role=>component.axes.some(axis=>axis.role===role)));
const spectralAxis=(product:ProductDescriptor):AxisDescriptor|undefined=>product.components.flatMap(component=>component.axes).find(axis=>axis.role==='spectral');
function evaluateSpectral(product:ProductDescriptor,criterion:NonNullable<FamilyCriteria['spectral']>):ConstraintVerdict{const axis=spectralAxis(product);if(!axis)return verdict('unknown','No spectral coordinate is retained in this descriptor.');if(!criterion.intervalMicrometres)return verdict('yes','A spectral axis is retained.');if(axis.coordinates.kind!=='linear')return verdict('unknown','The retained spectral coordinate is native or lookup-based; its numeric range was not copied into the descriptor.');const [a,b]=criterion.intervalMicrometres,start=axis.coordinates.referenceValue-axis.coordinates.referenceIndex*axis.coordinates.increment,end=start+(axis.length-1)*axis.coordinates.increment,low=Math.min(start,end),high=Math.max(start,end);return a>=low&&b<=high?verdict('yes','The declared linear spectral coordinate covers the requested interval.'):verdict('no','The declared linear spectral coordinate does not cover the requested interval.');}
function evaluateQuantity(product:ProductDescriptor,quantity:string):ConstraintVerdict{const wanted=norm(quantity),matches=product.components.some(component=>norm(component.quantity.name)===wanted||norm(component.id)===wanted||norm(component.quantity.semantics).includes(wanted));return matches?verdict('yes','A retained component declares the requested quantity.'):verdict('no','No retained component declares the requested quantity.');}
function evaluateTable(product:ProductDescriptor,columns:readonly string[]):ConstraintVerdict{const tables=product.components.filter(component=>component.representation.kind==='table'||component.representation.kind==='events'||component.representation.kind==='complex-samples');if(!tables.length)return verdict('unknown','No typed table columns are retained in this descriptor.');const known=new Set(tables.flatMap(table=>table.columns.map(column=>norm(column.name))));const missing=columns.filter(column=>!known.has(norm(column)));return missing.length?verdict('no',`Retained table columns do not include ${missing.join(', ')}.`):verdict('yes','Retained typed table columns include every requested column.');}
function evaluatePolarization(product:ProductDescriptor,components:readonly string[]):ConstraintVerdict{const known=new Set(product.components.flatMap(component=>[component.id,component.name,component.quantity.name]).map(norm));const missing=components.filter(component=>!known.has(norm(component)));if(!missing.length)return verdict('yes','The requested polarization components are explicitly retained.');const explicit=product.issues.some(issue=>/stokes|polarization/i.test(issue.reason));return explicit?verdict('no',`The descriptor explicitly does not establish ${missing.join(', ')}.`):verdict('unknown',`No retained component establishes ${missing.join(', ')}.`);}
/** Assess only requested criteria. Descriptor absence is unknown unless the descriptor explicitly rules the fact out. */
export function assessFamilyRequest(input:FamilyScientificRequest,descriptorValue:unknown):FamilyRequestAssessment{
  const request=normalizeFamilyRequest(input.legacy,{family:input.family,criteria:input.criteria}),product=parseProductDescriptor(descriptorValue),out:Partial<Record<FamilyCriterionName,ConstraintVerdict>>={};
  if(request.family)out.family=product.dataset.families.includes(request.family)?verdict('yes',`Descriptor declares ${request.family}.`):verdict('no',`Descriptor families are ${product.dataset.families.join(', ')}.`);
  const c=request.criteria;
  if(c.quantity!==undefined)out.quantity=evaluateQuantity(product,c.quantity);
  if(c.time!==undefined)out.time=product.components.some(component=>component.time!==undefined)?verdict('yes','A retained component declares time metadata.'):verdict('unknown','No component retains time metadata.');
  if(c.spectral!==undefined)out.spectral=evaluateSpectral(product,c.spectral);
  if(c.spatial!==undefined)out.spatial=hasAxes(product,['x','y'])?verdict('yes','A retained component declares two spatial axes.'):verdict('unknown','No component retains both spatial axes.');
  if(c.table!==undefined)out.table=evaluateTable(product,c.table.columns);
  if(c.polarization!==undefined)out.polarization=evaluatePolarization(product,c.polarization.components);
  if(c.visibility!==undefined)out.visibility=product.components.some(component=>component.representation.kind==='complex-samples'||/visibility/i.test(component.quantity.name))?verdict('yes','A retained component declares visibility samples.'):verdict('unknown','No retained component establishes complex visibility samples.');
  return{request,verdicts:out};
}
