/** Source-qualified planetary coordinate grids. This adapter validates and exports bytes; it owns no inversion physics. */
import {spawn} from 'node:child_process';
import {copyFile} from 'node:fs/promises';
import {requireArray,requireFiniteNumber,requireRecord,requireString} from '@cssearth/core';
import {astroqueryToolchain} from '../../../astronomy-packages/toolchain.mts';
import {fileSize} from '../../../product-record.mts';
import type {FamilyHandler,FamilyOperation} from '../../family-handlers.mts';
import {
  PLANETARY_AXIS_ROLES,
  parseDepthDescriptor,
  parseInferenceDescriptor,
  parseObservabilityDescriptor,
  parsePlanetaryPlacementDescriptor,
  parseResolutionDescriptor,
  parseSupportDescriptor,
  type AxisDerivationDescriptor,
  type CalibrationDescriptor,
  type DepthDescriptor,
  type DescriptorMember,
  type FrameDescriptor,
  type InferenceDescriptor,
  type ObservabilityDescriptor,
  type PlanetaryAxisRole,
  type PlanetaryPlacementDescriptor,
  type ProductDescriptor,
  type QuantityDescriptor,
  type ResolutionDescriptor,
  type SupportDescriptor,
  type UncertaintyDescriptor,
} from '../../product-descriptor.mts';
import {assertPlanetaryProductSemantics,planetaryOutputPolicy} from '../../planetary-depth-policy.mts';
import {descriptor,stable} from '../common.mts';

export const PLANETARY_GRID_QUALIFICATION_SCHEMA='cssearth-planetary-grid-qualification@1' as const;
type PlanetaryAxisPhysicalType='length'|'time'|'pressure'|'angle';
const physicalTypeForRole:Record<PlanetaryAxisRole,PlanetaryAxisPhysicalType>={'projected-x':'length','projected-y':'length','delay':'time','geometric-depth':'length','altitude':'length','pressure':'pressure','longitude':'angle','latitude':'angle','radius':'length','body-fixed-x':'length','body-fixed-y':'length','body-fixed-z':'length','path-distance':'length'};
export interface PlanetaryAxisQualification {readonly fitsAxis:number;readonly role:PlanetaryAxisRole;readonly physicalType:PlanetaryAxisPhysicalType;readonly unit:string;readonly reference:string;readonly derivation:AxisDerivationDescriptor}
export interface PlanetaryGridQualification {
  readonly schema:typeof PLANETARY_GRID_QUALIFICATION_SCHEMA;
  readonly source:{readonly archiveIdentity:string;readonly sourceUrl:string;readonly citation:string;readonly license:string};
  readonly sourceClassification:{readonly term:string;readonly vocabulary:string;readonly version:string;readonly status:'source'|'mapped'|'preliminary'};
  readonly frame:FrameDescriptor;readonly quantity:Required<QuantityDescriptor>;readonly calibration:CalibrationDescriptor;readonly uncertainty:UncertaintyDescriptor;
  readonly axes:readonly PlanetaryAxisQualification[];readonly support:SupportDescriptor;readonly depth:DepthDescriptor;readonly placement?:PlanetaryPlacementDescriptor;readonly observability:ObservabilityDescriptor;
  readonly resolution:ResolutionDescriptor;readonly inference?:InferenceDescriptor;
}
export interface PlanetaryGridExecutionContext {readonly quantity:string;readonly unit:string;readonly axes:readonly {readonly role:string;readonly physicalType:PlanetaryAxisPhysicalType;readonly unit:string;readonly reference:string;readonly length?:number;readonly referenceValue?:number;readonly referenceIndex?:number;readonly increment?:number}[]}
export interface PlanetaryDepthInspection {readonly shape:readonly number[];readonly axes:readonly {readonly role:string;readonly physicalType:PlanetaryAxisPhysicalType;readonly unit:string;readonly reference:string;readonly length:number;readonly referenceValue:number;readonly referenceIndex:number;readonly start:number;readonly increment:number}[];readonly quantity:string;readonly unit:string;readonly finiteSamples:number;readonly minimum:number|null;readonly maximum:number|null;readonly astropy:string}
export interface PlanetaryDepthSlice extends PlanetaryDepthInspection {readonly slice:{readonly axis:string;readonly index:number;readonly shape:readonly number[];readonly axes:readonly string[];readonly values:readonly (number|null)[];readonly valid:readonly boolean[]}}
export interface PinnedDepthFile {readonly path:string}

const exact=(value:Record<string,unknown>,keys:readonly string[],label:string)=>{for(const key of Object.keys(value))if(!keys.includes(key))throw new TypeError(`${label} has unsupported field ${key}.`);};
const whole=(value:unknown,label:string,minimum=0)=>{const number=requireFiniteNumber(value,label);if(!Number.isSafeInteger(number)||number<minimum)throw new TypeError(`${label} must be a whole number at least ${minimum}.`);return number;};
const stringList=(value:unknown,label:string)=>requireArray(value,label).map((entry,index)=>requireString(entry,`${label} ${index}`));
const optionalString=(value:unknown,label:string)=>value===undefined?undefined:requireString(value,label);

export function parsePlanetaryGridQualification(value:unknown):PlanetaryGridQualification{
  const root=requireRecord(value,'planetary grid qualification');exact(root,['schema','source','sourceClassification','frame','quantity','calibration','uncertainty','axes','support','depth','placement','observability','resolution','inference'],'planetary grid qualification');if(root.schema!==PLANETARY_GRID_QUALIFICATION_SCHEMA)throw new TypeError('Unsupported planetary grid qualification schema.');
  const source=requireRecord(root.source,'planetary source');exact(source,['archiveIdentity','sourceUrl','citation','license'],'planetary source');const sourceUrl=requireString(source.sourceUrl,'planetary source URL');if(new URL(sourceUrl).protocol!=='https:')throw new TypeError('Planetary source URL must be HTTPS.');
  const classification=requireRecord(root.sourceClassification,'planetary source classification');exact(classification,['term','vocabulary','version','status'],'planetary source classification');if(!['source','mapped','preliminary'].includes(String(classification.status)))throw new TypeError('Unsupported planetary source classification status.');
  const frame=requireRecord(root.frame,'planetary frame');exact(frame,['kind','name','referencePosition','epoch'],'planetary frame');
  const quantity=requireRecord(root.quantity,'planetary quantity');exact(quantity,['name','semantics','unit'],'planetary quantity');
  const calibration=requireRecord(root.calibration,'planetary calibration');exact(calibration,['state','basis'],'planetary calibration');if(!['raw','archive-calibrated','locally-reproduced','reconstructed','model-derived','unknown'].includes(String(calibration.state)))throw new TypeError('Unsupported planetary calibration state.');
  const uncertainty=requireRecord(root.uncertainty,'planetary uncertainty');exact(uncertainty,['form','basis'],'planetary uncertainty');if(!['standard-deviation','variance','inverse-variance','covariance','limits','unknown','none-supplied'].includes(String(uncertainty.form)))throw new TypeError('Unsupported planetary uncertainty form.');
  const axes=requireArray(root.axes,'planetary axes').map((value,index)=>{const row=requireRecord(value,`planetary axis ${index}`);exact(row,['fitsAxis','role','physicalType','unit','reference','derivation'],`planetary axis ${index}`);const role=requireString(row.role,'planetary axis role');if(!(PLANETARY_AXIS_ROLES as readonly string[]).includes(role))throw new TypeError(`Unsupported planetary axis role ${role}.`);const physicalType=requireString(row.physicalType,'planetary axis physical type');if(physicalType!==physicalTypeForRole[role as PlanetaryAxisRole])throw new TypeError(`Planetary axis ${role} requires physical type ${physicalTypeForRole[role as PlanetaryAxisRole]}.`);const derivation=requireRecord(row.derivation,'planetary axis derivation');exact(derivation,['state','assumptions'],'planetary axis derivation');if(!['observed','archive-derived','reconstruction-derived'].includes(String(derivation.state)))throw new TypeError('Unsupported planetary axis derivation state.');return{fitsAxis:whole(row.fitsAxis,'FITS axis',1),role:role as PlanetaryAxisRole,physicalType:physicalType as PlanetaryAxisPhysicalType,unit:requireString(row.unit,'planetary axis unit'),reference:requireString(row.reference,'planetary axis reference'),derivation:{state:derivation.state as AxisDerivationDescriptor['state'],assumptions:stringList(derivation.assumptions,'planetary axis assumptions')}};});
  if(axes.length<1||axes.length>3)throw new TypeError('Planetary linear grids require one to three axes.');if(new Set(axes.map(axis=>axis.role)).size!==axes.length)throw new TypeError('Planetary axis roles must be unique.');if(axes.some((axis,index)=>axis.fitsAxis!==index+1))throw new TypeError('Planetary axes must enumerate FITS axes from 1 without gaps.');
  const support=parseSupportDescriptor(root.support),depth=parseDepthDescriptor(root.depth),placement=root.placement===undefined?undefined:parsePlanetaryPlacementDescriptor(root.placement),observability=parseObservabilityDescriptor(root.observability),resolution=parseResolutionDescriptor(root.resolution),inference=root.inference===undefined?undefined:parseInferenceDescriptor(root.inference);
  if(depth.coordinate!=='none'&&!axes.some(axis=>axis.role===depth.coordinate))throw new TypeError(`Depth coordinate ${depth.coordinate} has no qualified axis.`);if(support.class!=='observed-samples'&&!inference)throw new TypeError(`${support.class} requires a retained inference method.`);
  return{schema:PLANETARY_GRID_QUALIFICATION_SCHEMA,source:{archiveIdentity:requireString(source.archiveIdentity,'archive identity'),sourceUrl,citation:requireString(source.citation,'source citation'),license:requireString(source.license,'source license')},sourceClassification:{term:requireString(classification.term,'classification term'),vocabulary:requireString(classification.vocabulary,'classification vocabulary'),version:requireString(classification.version,'classification version'),status:classification.status as PlanetaryGridQualification['sourceClassification']['status']},frame:{kind:requireString(frame.kind,'frame kind'),name:requireString(frame.name,'frame name'),...(optionalString(frame.referencePosition,'frame reference position')?{referencePosition:optionalString(frame.referencePosition,'frame reference position')}:{}),...(optionalString(frame.epoch,'frame epoch')?{epoch:optionalString(frame.epoch,'frame epoch')}:{})},quantity:{name:requireString(quantity.name,'quantity name'),semantics:requireString(quantity.semantics,'quantity semantics'),unit:requireString(quantity.unit,'quantity unit')},calibration:{state:calibration.state as CalibrationDescriptor['state'],basis:stringList(calibration.basis,'calibration basis')},uncertainty:{form:uncertainty.form as UncertaintyDescriptor['form'],basis:requireString(uncertainty.basis,'uncertainty basis')},axes,support,depth,...(placement?{placement}:{}),observability,resolution,...(inference?{inference}:{})};
}

const python=String.raw`import json,sys,numpy as np,astropy
from astropy.io import fits
from astropy import units as u
from astropy.wcs import WCS
r=json.load(sys.stdin);c=r['context']
with fits.open(r['path'],memmap=True) as h:
 d=np.asarray(h[0].data);hdr=h[0].header
 if d.ndim<1 or d.ndim>3:raise ValueError('Planetary linear grid requires a one-, two-, or three-dimensional primary array')
 if len(c['axes'])!=d.ndim:raise ValueError('Qualified axis count differs from the FITS array rank')
 w=WCS(hdr,naxis=d.ndim)
 if w.pixel_n_dim!=d.ndim or w.world_n_dim!=d.ndim:raise ValueError('Planetary linear grid requires one independent WCS world axis per FITS axis')
 if getattr(w,'has_distortion',False):raise ValueError('Planetary linear grid refuses distorted WCS coordinates')
 ctype=[str(value).strip().upper() for value in w.wcs.ctype]
 if any(value not in ('','LINEAR') for value in ctype):raise ValueError('Planetary linear grid refuses nonlinear or unsupported WCS CTYPE coordinates')
 matrix=np.asarray(w.pixel_scale_matrix,dtype=float)
 if matrix.shape!=(d.ndim,d.ndim) or not np.all(np.isfinite(matrix)):raise ValueError('Planetary linear grid has an invalid WCS coordinate matrix')
 if np.any(matrix[~np.eye(d.ndim,dtype=bool)]!=0.):raise ValueError('Planetary linear grid refuses coupled WCS coordinate axes')
 pixels=np.vstack([np.zeros(d.ndim),np.eye(d.ndim)])
 world=np.asarray(w.all_pix2world(pixels,0),dtype=float)
 if world.shape!=(d.ndim+1,d.ndim) or not np.all(np.isfinite(world)):raise ValueError('Planetary linear grid has non-finite WCS coordinates')
 axes=[]
 for i,expected in enumerate(c['axes'],start=1):
  unit=str(w.world_axis_units[i-1]).strip()
  try:
   native_unit=u.Unit(unit);qualified_unit=u.Unit(expected['unit']);physical_unit={'length':u.m,'time':u.s,'pressure':u.Pa,'angle':u.rad}[expected['physicalType']]
  except Exception as error:raise ValueError('Planetary grid axis has an invalid physical unit at axis '+str(i)) from error
  if not qualified_unit.is_equivalent(physical_unit):raise ValueError('Qualified planetary axis unit has a different physical dimension from its role at axis '+str(i))
  if not native_unit.is_equivalent(physical_unit):raise ValueError('FITS axis unit has a different physical dimension from its role at axis '+str(i))
  if not native_unit.is_equivalent(qualified_unit):raise ValueError('FITS axis unit has a different physical dimension from the qualified planetary semantics at axis '+str(i))
  scale=native_unit.to(qualified_unit)
  length=int(hdr['NAXIS'+str(i)]);reference_value=float(world[0,i-1]*scale);reference_index=0.;increment=float((world[i,i-1]-world[0,i-1])*scale);start=reference_value
  if not np.isfinite(increment) or increment==0.:raise ValueError('Planetary linear grid has a zero or invalid WCS coordinate increment at axis '+str(i))
  for key,actual in [('length',length),('referenceValue',reference_value),('referenceIndex',reference_index),('increment',increment)]:
   if key in expected and expected[key] is not None and not np.isclose(actual,expected[key],rtol=0.,atol=1e-12):raise ValueError('FITS coordinate changed from the retained descriptor at axis '+str(i)+' field '+key)
  axes.append({'role':expected['role'],'physicalType':expected['physicalType'],'unit':expected['unit'],'reference':expected['reference'],'length':length,'referenceValue':reference_value,'referenceIndex':reference_index,'start':start,'increment':increment})
 if str(hdr.get('BUNIT','')).strip()!=c['unit']:raise ValueError('FITS quantity unit differs from the qualified planetary semantics')
 v=d[np.isfinite(d)];answer={'shape':[a['length'] for a in axes],'axes':axes,'quantity':c['quantity'],'unit':c['unit'],'finiteSamples':int(v.size),'minimum':float(v.min()) if v.size else None,'maximum':float(v.max()) if v.size else None,'astropy':astropy.__version__}
 if r['operation']=='slice':
  if d.ndim<2:raise ValueError('Planetary slice requires at least two qualified axes')
  role=r['axis'];index=r['index'];fits_axis=next((i for i,a in enumerate(axes) if a['role']==role),None)
  if fits_axis is None or not isinstance(index,int) or index<0 or index>=axes[fits_axis]['length']:raise ValueError('Planetary slice is outside the selected semantic axis')
  plane=np.take(d,index,axis=d.ndim-1-fits_axis);ordered=np.transpose(plane) if plane.ndim>1 else plane;remaining=[a for i,a in enumerate(axes) if i!=fits_axis]
  flat=np.asarray(ordered,dtype=float).ravel();valid=np.isfinite(flat);answer['slice']={'axis':role,'index':index,'shape':[int(v) for v in ordered.shape],'axes':[a['role'] for a in remaining],'values':[float(value) if ok else None for value,ok in zip(flat,valid)],'valid':[bool(value) for value in valid]}
json.dump(answer,sys.stdout,allow_nan=False)`;
async function run(pin:PinnedDepthFile,context:PlanetaryGridExecutionContext,operation:'inspect'|'slice',axis?:string,index?:number):Promise<any>{const toolchain=await astroqueryToolchain();return new Promise((resolveResult,reject)=>{const child=spawn(toolchain.python,['-c',python],{env:{...process.env,...toolchain.env},stdio:['pipe','pipe','pipe']});let text='',error='';child.stdout.setEncoding('utf8').on('data',value=>text+=value);child.stderr.setEncoding('utf8').on('data',value=>error+=value);child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error(`Astropy planetary-grid owner failed: ${error.slice(-1000)}`));try{resolveResult(JSON.parse(text));}catch(cause){reject(cause);}});child.stdin.end(JSON.stringify({path:pin.path,context,operation,axis,index}));});}
const contextFromQualification=(qualification:PlanetaryGridQualification):PlanetaryGridExecutionContext=>({quantity:qualification.quantity.name,unit:qualification.quantity.unit,axes:qualification.axes.map(axis=>({role:axis.role,physicalType:axis.physicalType,unit:axis.unit,reference:axis.reference}))});
export const inspectPlanetaryDepthGrid=(pin:PinnedDepthFile,context:PlanetaryGridExecutionContext|PlanetaryGridQualification):Promise<PlanetaryDepthInspection>=>run(pin,'schema'in context?contextFromQualification(context):context,'inspect');
export const slicePlanetaryDepthGrid=(pin:PinnedDepthFile,context:PlanetaryGridExecutionContext,axis:string,index:number):Promise<PlanetaryDepthSlice>=>run(pin,context,'slice',axis,index);
export async function exportPlanetaryDepthNative(pin:PinnedDepthFile,output:string){await copyFile(pin.path,output);return{path:output,...await fileSize(output)};}

const resolveRoleMembers=(ids:readonly string[],members:readonly DescriptorMember[])=>ids.flatMap(value=>value.startsWith('role:')?members.filter(member=>member.role===value.slice(5)).map(member=>member.id):[value]);
export function contextFromPlanetaryDepthDescriptor(product:ProductDescriptor):PlanetaryGridExecutionContext{const component=product.components.find(value=>value.id==='planetary-grid');if(!component)throw new TypeError('Planetary grid descriptor lacks its scientific component.');assertPlanetaryProductSemantics(component);if(!component.quantity.unit)throw new TypeError('Planetary grid quantity unit is absent.');const axes=[...component.axes].sort((a,b)=>a.index-b.index).map(axis=>{if(axis.coordinates.kind!=='linear'||!axis.unit||!axis.reference||!axis.physicalType)throw new TypeError(`Planetary grid axis ${axis.id} is not a qualified linear physical coordinate.`);return{role:axis.role,physicalType:axis.physicalType as PlanetaryAxisPhysicalType,unit:axis.unit,reference:axis.reference,length:axis.length,referenceValue:axis.coordinates.referenceValue,referenceIndex:axis.coordinates.referenceIndex,increment:axis.coordinates.increment};});return{quantity:component.quantity.name,unit:component.quantity.unit,axes};}
export function describePlanetaryDepthGrid(input:{readonly id:string;readonly members:readonly DescriptorMember[];readonly scienceMemberId:string;readonly qualification:unknown;readonly inspection:PlanetaryDepthInspection;readonly producingRecord:string;readonly target:string;readonly acquisition?:ProductDescriptor['dataset']['acquisition']}):ProductDescriptor{
  const qualification=parsePlanetaryGridQualification(input.qualification),science=input.members.find(member=>member.id===input.scienceMemberId);if(!science)throw new TypeError('Planetary grid science member is absent.');if(qualification.axes.length!==input.inspection.axes.length)throw new TypeError('Planetary inspection rank differs from the qualification.');
  const resolve=(ids:readonly string[])=>resolveRoleMembers(ids,input.members),memberIds=new Set(input.members.map(member=>member.id)),support={...qualification.support,domain:{...qualification.support.domain,memberIds:resolve(qualification.support.domain.memberIds)},unsupportedRegions:qualification.support.unsupportedRegions.map(region=>region.memberId?{...region,memberId:resolve([region.memberId])[0]}:region)},observability={...qualification.observability,coverage:{...qualification.observability.coverage,memberIds:resolve(qualification.observability.coverage.memberIds)}},resolution={...qualification.resolution,memberIds:resolve(qualification.resolution.memberIds)},inference=qualification.inference?{...qualification.inference,memberIds:resolve(qualification.inference.memberIds)}:undefined;
  for(const id of [...support.domain.memberIds,...support.unsupportedRegions.flatMap(region=>region.memberId?[region.memberId]:[]),...observability.coverage.memberIds,...resolution.memberIds,...(inference?.memberIds??[])])if(!id||!memberIds.has(id))throw new TypeError(`Planetary qualification references missing member ${String(id)}.`);
  const axes=input.inspection.axes.map((axis,index)=>({id:axis.role,index,length:axis.length,role:axis.role,physicalType:axis.physicalType,unit:axis.unit,coordinates:{kind:'linear' as const,referenceValue:axis.referenceValue,referenceIndex:axis.referenceIndex,increment:axis.increment},frame:qualification.frame.name,reference:axis.reference,derivation:qualification.axes[index]!.derivation})),sampling={axes:axes.map(axis=>({axisId:axis.id,kind:'regular' as const,interval:Math.abs(axis.coordinates.increment),unit:axis.unit,basis:'FITS linear coordinate metadata; this is sampling, not resolution.'}))};
  const value=descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'planetary grid id'),target:input.target,acquisition:input.acquisition??{kind:'archive',identity:qualification.source.archiveIdentity},producingRecord:input.producingRecord,sourceClassifications:[qualification.sourceClassification],families:['F16'],profiles:[{handlerId:'f16-planetary-depth',profileId:'astropy-planetary-linear-grid@1'}]},members:input.members,components:[{id:'planetary-grid',name:`${input.target} ${qualification.quantity.name}`,families:['F16'],locations:[{memberId:science.id,hdu:0}],representation:{kind:'physical-field',topology:'grid',samples:input.inspection.shape.reduce((a,b)=>a*b,1)},axes,columns:[],quantity:qualification.quantity,calibration:qualification.calibration,uncertainty:qualification.uncertainty,flags:[],frame:qualification.frame,support,depth:qualification.depth,...(qualification.placement?{placement:qualification.placement}:{}),observability,sampling,resolution,...(inference?{inference}:{}),dependencyIds:['archive-closure']}],dependencies:[{id:'archive-closure',role:'archive identity, semantic mapping, support, and method closure',memberIds:input.members.filter(member=>member.id!==science.id).map(member=>member.id),componentIds:['planetary-grid'],requiredFor:['depth-grid-inspect','depth-grid-native','depth-grid-slice'],evidence:`${qualification.source.archiveIdentity}; ${qualification.source.sourceUrl}; ${qualification.source.citation}; ${qualification.source.license}`}],issues:[...(qualification.depth.conversion.state==='unavailable'?[{scope:'axis' as const,identity:qualification.depth.coordinate,state:'unsupported' as const,reason:'No qualified coordinate conversion is available; the native coordinate must not be relabelled.'}]:[]),...(qualification.resolution.state==='unknown'?[{scope:'component' as const,identity:'planetary-grid',state:'unknown' as const,reason:'No resolution evidence is supplied; retained coordinate intervals are sampling only.'}]:[])]});
  assertPlanetaryProductSemantics(value.components[0]!);return value;
}
const operation=(id:'depth-grid-inspect'|'depth-grid-native'|'depth-grid-slice',label:string,componentId:string,available:boolean,reason:string,parameters:any[]):FamilyOperation=>({id,label,handlerId:'f16-planetary-depth',componentId,owner:{module:'tools/objects/telescopes/families/f16/f16-planetary-depth.mts',export:id==='depth-grid-inspect'?'inspectPlanetaryDepthGrid':id==='depth-grid-native'?'exportPlanetaryDepthNative':'slicePlanetaryDepthGrid'},available,reason,fixedArguments:{},parameters:[...parameters,{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:['Delay, geometric depth, pressure, altitude, and radius remain distinct. Sampling never establishes resolution. Inversion-derived fields remain labelled as inference.']});
export const F16_PLANETARY_DEPTH_HANDLER:FamilyHandler={id:'f16-planetary-depth',families:['F16'],profiles:[{id:'astropy-planetary-linear-grid@1',format:'Source-qualified one- to three-dimensional FITS planetary coordinate grid',version:'1',families:['F16'],evidence:[{path:'tools/objects/telescopes/families/f16/f16-planetary-depth.test.mts',establishes:'Synthetic FITS contract validation, semantic descriptor publication, operation policy, and mismatch refusal.',status:'complete'}]}],recognizes:()=>[],operations:product=>{const component=product.components.find(value=>value.id==='planetary-grid');if(!component)return[];const policy=planetaryOutputPolicy(component),native=policy.find(value=>value.output==='native')!,slice=policy.find(value=>value.output==='slice')!,choices=component.axes.map(axis=>axis.role),scienceIds=new Set(component.locations.map(location=>location.memberId)),support=component.support,domainUnavailable=support!==undefined&&(support.domain.kind!=='full-grid'||support.domain.memberIds.some(memberId=>!scienceIds.has(memberId))),maskUnavailable=(support?.unsupportedRegions.length??0)>0,sliceAvailable=slice.available&&!domainUnavailable&&!maskUnavailable,sliceReason=domainUnavailable?'This FITS slice owner cannot apply support-domain geometry or members; use native export until an adapter supplies a support-aware operation.':maskUnavailable?'This FITS slice owner cannot apply unsupported support or mask geometry; use native export until an adapter supplies a mask-aware operation.':slice.reason;return[operation('depth-grid-inspect','Inspect planetary coordinate grid',component.id,native.available,native.reason,[]),operation('depth-grid-native','Export native planetary coordinate grid',component.id,native.available,native.reason,[]),operation('depth-grid-slice','Extract a semantic coordinate slice',component.id,sliceAvailable,sliceReason,[{id:'axis',option:'--axis',kind:'choice',required:true,choices,description:'Exact retained coordinate role.'},{id:'index',option:'--index',kind:'integer',required:true,minimum:0,description:'Zero-based coordinate index.'}])]}};
