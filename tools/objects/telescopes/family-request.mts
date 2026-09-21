/** Family-aware request adapter. It translates legacy telescope criteria once, then evaluates only retained descriptor facts. */
import type { CapabilityRequest, ConstraintAnswer, ConstraintVerdict } from './query.mts';
import type { AxisDescriptor, FamilyId, ProductDescriptor } from './product-descriptor.mts';
import { parseProductDescriptor } from './product-descriptor.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { requireArray, requireFiniteNumber } from '../../source-values.mts';

export type FamilyCriterionName='target'|'family'|'quantity'|'time'|'spectral'|'spatial'|'table'|'polarization'|'visibility';
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
export interface FamilyRequestAssessment {readonly scope:'descriptor-compatibility';readonly request:NormalizedFamilyRequest;readonly verdicts:Readonly<Partial<Record<FamilyCriterionName,ConstraintVerdict>>>}
const verdict=(answer:ConstraintAnswer,reason:string):ConstraintVerdict=>({answer,reason});
const norm=(text:string)=>text.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu,'-').replaceAll(/^-|-$/gu,'');
const supported:Readonly<Record<FamilyCriterionName,readonly FamilyId[]>>={
  target:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  family:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  quantity:['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  time:['F06','F07','F10','F11','F12','F15'], spectral:['F01','F02','F03','F05','F07','F08','F11','F12','F13','F15'], spatial:['F01','F02','F13'],
  table:['F03','F05','F06','F08','F09','F10','F11','F12','F17'], polarization:['F11','F12','F13'], visibility:['F11','F12']
};
function assertCriterionFamily(family:FamilyId|undefined,criteria:FamilyCriteria){if(!family)return;for(const key of Object.keys(criteria) as (keyof FamilyCriteria)[]){if(criteria[key]!==undefined&&!supported[key].includes(family))throw new TypeError(`${key} is physically inapplicable to ${family}.`);}}
/** Legacy wavelengths/time/resolution are translated exactly once. More specific family criteria remain optional. */
export function normalizeFamilyRequest(request:CapabilityRequest,extra:{readonly family?:FamilyId;readonly criteria?:FamilyCriteria}={}):NormalizedFamilyRequest{
  if(!request.target)throw new TypeError('Legacy request target is required.');
  const applies=(criterion:FamilyCriterionName)=>extra.family===undefined||supported[criterion].includes(extra.family);
  const criteria:FamilyCriteria={...(extra.criteria??{}),...(extra.criteria?.spectral===undefined&&applies('spectral')?{spectral:{intervalMicrometres:request.wavelengthMicrometres}}:{}),...(extra.criteria?.time===undefined&&request.time!==undefined&&applies('time')?{time:true}:{}),...(extra.criteria?.spatial===undefined&&(request.angularResolutionArcsec!==undefined||request.surfaceResolutionKm!==undefined||request.resolutionElements!==undefined)&&applies('spatial')?{spatial:true}:{})};
  if(criteria.quantity!==undefined&&!criteria.quantity.trim())throw new TypeError('Quantity criterion cannot be blank.');
  if(criteria.spectral?.intervalMicrometres!==undefined){const [a,b]=criteria.spectral.intervalMicrometres;if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<a)throw new TypeError('Spectral criterion must be an increasing positive interval.');}
  if(criteria.table?.columns.some(column=>!column.trim()))throw new TypeError('Table criterion columns cannot be blank.');
  if(criteria.polarization?.components.some(component=>!component.trim()))throw new TypeError('Polarization components cannot be blank.');
  assertCriterionFamily(extra.family,criteria);return{legacy:request,family:extra.family,criteria};
}
const hasAxes=(product:ProductDescriptor,roles:readonly string[])=>product.components.some(component=>roles.every(role=>component.axes.some(axis=>axis.role===role)));
async function spectralRange(axis:AxisDescriptor):Promise<readonly[number,number]|null>{if(axis.coordinates.kind!=='linear'||!axis.unit)return null;const start=axis.coordinates.referenceValue-axis.coordinates.referenceIndex*axis.coordinates.increment,end=start+(axis.length-1)*axis.coordinates.increment,result=await sciencePackage({operation:'spectral-convert',values:[start,end],unit:axis.unit}),values=requireArray(result.valuesMicrometres,'converted spectral values').map((value,index)=>requireFiniteNumber(value,`converted spectral value ${index}`));return[Math.min(values[0]!,values[1]!),Math.max(values[0]!,values[1]!)];}
async function evaluateSpectral(product:ProductDescriptor,criterion:NonNullable<FamilyCriteria['spectral']>):Promise<ConstraintVerdict>{const candidates=product.components.flatMap(component=>component.axes.filter(axis=>axis.role==='spectral').map(axis=>({component:component.id,axis})));if(!candidates.length)return verdict('unknown','No spectral coordinate is retained in this descriptor.');if(!criterion.intervalMicrometres)return verdict('yes',`A spectral axis is retained by component ${candidates[0]!.component}.`);const decisions:ConstraintVerdict[]=[];for(const candidate of candidates){let range:readonly[number,number]|null;try{range=await spectralRange(candidate.axis);}catch(error){decisions.push(verdict('unknown',`Component ${candidate.component} spectral unit cannot be normalized by Astropy: ${error instanceof Error?error.message:String(error)}`));continue;}if(!range){decisions.push(verdict('unknown',`Component ${candidate.component} does not retain a linear spectral coordinate with a supported unit.`));continue;}const[a,b]=criterion.intervalMicrometres;decisions.push(a>=range[0]&&b<=range[1]?verdict('yes',`Component ${candidate.component} covers the requested interval after Astropy unit conversion.`):verdict('no',`Component ${candidate.component} does not cover the requested interval after Astropy unit conversion.`));}return decisions.find(item=>item.answer==='yes')??(decisions.every(item=>item.answer==='no')?verdict('no','No spectral component covers the requested interval after Astropy unit conversion.'):verdict('unknown','No spectral component has enough supported coordinate evidence to establish the requested interval.'));}
function evaluateQuantity(product:ProductDescriptor,quantity:string):ConstraintVerdict{const wanted=norm(quantity),matches=product.components.some(component=>norm(component.quantity.name)===wanted||norm(component.id)===wanted||norm(component.quantity.semantics).includes(wanted));return matches?verdict('yes','A retained component declares the requested quantity.'):verdict('no','No retained component declares the requested quantity.');}
function evaluateTable(product:ProductDescriptor,columns:readonly string[]):ConstraintVerdict{const tables=product.components.filter(component=>component.representation.kind==='table'||component.representation.kind==='events'||component.representation.kind==='complex-samples');if(!tables.length)return verdict('unknown','No typed table columns are retained in this descriptor.');const known=new Set(tables.flatMap(table=>table.columns.map(column=>norm(column.name))));const missing=columns.filter(column=>!known.has(norm(column)));return missing.length?verdict('no',`Retained table columns do not include ${missing.join(', ')}.`):verdict('yes','Retained typed table columns include every requested column.');}
function evaluatePolarization(product:ProductDescriptor,components:readonly string[]):ConstraintVerdict{const known=new Set(product.components.flatMap(component=>[component.id,component.name,component.quantity.name]).map(norm));const missing=components.filter(component=>!known.has(norm(component)));if(!missing.length)return verdict('yes','The requested polarization components are explicitly retained.');const explicit=product.issues.some(issue=>/stokes|polarization/i.test(issue.reason));return explicit?verdict('no',`The descriptor explicitly does not establish ${missing.join(', ')}.`):verdict('unknown',`No retained component establishes ${missing.join(', ')}.`);}
/** Assess only requested criteria. Descriptor absence is unknown unless the descriptor explicitly rules the fact out. */
export async function assessFamilyRequest(input:FamilyScientificRequest,descriptorValue:unknown):Promise<FamilyRequestAssessment>{
  const request=normalizeFamilyRequest(input.legacy,{family:input.family,criteria:input.criteria}),product=parseProductDescriptor(descriptorValue),out:Partial<Record<FamilyCriterionName,ConstraintVerdict>>={};
  out.target=product.dataset.target===undefined?verdict('unknown','The descriptor does not declare a target.'):norm(product.dataset.target)===norm(request.legacy.target)?verdict('yes','Descriptor target matches the requested target.'):verdict('no',`Descriptor target ${product.dataset.target} does not match requested target ${request.legacy.target}.`);
  if(request.family)out.family=product.dataset.families.includes(request.family)?verdict('yes',`Descriptor declares ${request.family}.`):verdict('no',`Descriptor families are ${product.dataset.families.join(', ')}.`);
  const c=request.criteria;
  if(c.quantity!==undefined)out.quantity=evaluateQuantity(product,c.quantity);
  if(c.time!==undefined)out.time=request.legacy.time&&!('any'in request.legacy.time)?verdict('unknown','The descriptor does not retain observation bounds that can satisfy the requested interval.'):product.components.some(component=>component.time!==undefined)?verdict('yes','A retained component declares time metadata.'):verdict('unknown','No component retains time metadata.');
  if(c.spectral!==undefined)out.spectral=await evaluateSpectral(product,c.spectral);
  if(c.spatial!==undefined)out.spatial=request.legacy.angularResolutionArcsec!==undefined||request.legacy.surfaceResolutionKm!==undefined||request.legacy.resolutionElements!==undefined?verdict('unknown','Spatial axes do not establish measured resolution evidence for the requested threshold.'):hasAxes(product,['x','y'])?verdict('yes','A retained component declares two spatial axes.'):verdict('unknown','No component retains both spatial axes.');
  if(c.table!==undefined)out.table=evaluateTable(product,c.table.columns);
  if(c.polarization!==undefined)out.polarization=evaluatePolarization(product,c.polarization.components);
  if(c.visibility!==undefined)out.visibility=product.components.some(component=>component.representation.kind==='complex-samples'||/visibility/i.test(component.quantity.name))?verdict('yes','A retained component declares visibility samples.'):verdict('unknown','No retained component establishes complex visibility samples.');
  return{scope:'descriptor-compatibility',request,verdicts:out};
}
