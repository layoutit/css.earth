/** Versioned semantic description of pinned observational bytes. Data remain in members; this file only describes them. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';

export const PRODUCT_DESCRIPTOR_SCHEMA='cssearth-telescope-product-descriptor@1' as const;
export const FAMILY_IDS=['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'] as const;
export type FamilyId=typeof FAMILY_IDS[number];
export type CalibrationState='raw'|'archive-calibrated'|'locally-reproduced'|'reconstructed'|'model-derived'|'unknown';
export type MemberRole='science'|'support'|'label'|'coordinates'|'quality'|'uncertainty'|'calibration'|'response'|'provenance';

export interface DescriptorMember {readonly id:string;readonly path:string;readonly role:MemberRole;readonly bytes:number;readonly sha256:string;readonly mediaType?:string}
export type CoordinateDescriptor=
  |{readonly kind:'index'}
  |{readonly kind:'linear';readonly referenceValue:number;readonly referenceIndex:number;readonly increment:number}
  |{readonly kind:'native';readonly convention:string;readonly coupledGroup?:string;readonly binBounds:boolean}
  |{readonly kind:'lookup';readonly memberId:string;readonly locator:string;readonly binBounds:boolean};
export interface AxisDescriptor {readonly id:string;readonly index:number;readonly length:number;readonly role:string;readonly unit?:string;readonly coordinates:CoordinateDescriptor;readonly frame?:string}
export interface ColumnDescriptor {readonly id:string;readonly name:string;readonly role:string;readonly datatype:string;readonly unit?:string;readonly nullable:boolean;readonly variableLength:boolean;readonly shape?:readonly number[]}
export type RepresentationDescriptor=
  |{readonly kind:'array';readonly shape:readonly number[];readonly storageOrder:'row-major'|'column-major'|'native'}
  |{readonly kind:'table'|'events'|'complex-samples';readonly rows:number|null}
  |{readonly kind:'physical-field';readonly topology:'points'|'grid'|'mesh'|'other';readonly samples:number|null}
  |{readonly kind:'collection';readonly componentIds:readonly string[]};
export interface ComponentLocator {readonly memberId:string;readonly path?:string;readonly hdu?:number;readonly structure?:string}
export interface QuantityDescriptor {readonly name:string;readonly semantics:string;readonly unit?:string}
export interface CalibrationDescriptor {readonly state:CalibrationState;readonly basis:readonly string[]}
export interface UncertaintyDescriptor {readonly form:'standard-deviation'|'variance'|'inverse-variance'|'covariance'|'limits'|'unknown'|'none-supplied';readonly componentId?:string;readonly columnId?:string;readonly basis:string}
export interface FlagDescriptor {readonly id:string;readonly meaning:string;readonly componentId?:string;readonly columnId?:string;readonly usableWhen?:string}
export interface TimeDescriptor {readonly scale:string;readonly format:string;readonly referenceEpoch?:string;readonly observer?:string;readonly exposure?:string}
export interface FrameDescriptor {readonly kind:string;readonly name:string;readonly referencePosition?:string;readonly epoch?:string}
export interface ProductComponent {
  readonly id:string;readonly name:string;readonly families:readonly FamilyId[];readonly locations:readonly ComponentLocator[];
  readonly representation:RepresentationDescriptor;readonly axes:readonly AxisDescriptor[];readonly columns:readonly ColumnDescriptor[];
  readonly quantity:QuantityDescriptor;readonly calibration:CalibrationDescriptor;readonly uncertainty?:UncertaintyDescriptor;
  readonly flags:readonly FlagDescriptor[];readonly time?:TimeDescriptor;readonly frame?:FrameDescriptor;readonly dependencyIds:readonly string[];
}
export interface ProductDependency {readonly id:string;readonly role:string;readonly memberIds:readonly string[];readonly componentIds:readonly string[];readonly requiredFor:readonly string[];readonly evidence?:string}
export interface DescriptorIssue {readonly scope:'dataset'|'member'|'component'|'axis'|'column'|'dependency';readonly identity:string;readonly state:'missing'|'conflicting'|'unsupported'|'unknown';readonly reason:string}
export interface ProductDescriptor {
  readonly schema:typeof PRODUCT_DESCRIPTOR_SCHEMA;
  readonly dataset:{readonly id:string;readonly target?:string;readonly acquisition:{readonly kind:'archive'|'local-import'|'repository';readonly identity:string};readonly producingRecord:string;readonly sourceClassifications:readonly {readonly term:string;readonly vocabulary:string;readonly version:string;readonly status:'source'|'mapped'|'preliminary'}[];readonly families:readonly FamilyId[];readonly profiles:readonly {readonly handlerId:string;readonly profileId:string}[]};
  readonly members:readonly DescriptorMember[];readonly components:readonly ProductComponent[];readonly dependencies:readonly ProductDependency[];readonly issues:readonly DescriptorIssue[];
}

const HEX=/^[a-f0-9]{64}$/u,ID=/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/u;
const exact=(value:Record<string,unknown>,keys:readonly string[],label:string)=>{for(const key of Object.keys(value))if(!keys.includes(key))throw new TypeError(`${label} has unsupported field ${key}.`);};
const id=(value:unknown,label:string)=>{const text=requireString(value,label);if(!ID.test(text))throw new TypeError(`${label} must be a stable identifier.`);return text;};
const list=(value:unknown,label:string)=>requireArray(value,label).map((entry,index)=>requireString(entry,`${label} ${index}`));
const finite=(value:unknown,label:string)=>requireFiniteNumber(value,label);
const whole=(value:unknown,label:string,minimum=0)=>{const number=finite(value,label);if(!Number.isSafeInteger(number)||number<minimum)throw new TypeError(`${label} must be a whole number at least ${minimum}.`);return number;};
const family=(value:unknown,label:string)=>{const name=requireString(value,label);if(!(FAMILY_IDS as readonly string[]).includes(name))throw new TypeError(`${label} is not an observational family.`);return name as FamilyId;};
const unique=<T,>(values:readonly T[],label:string)=>{if(new Set(values).size!==values.length)throw new TypeError(`${label} must be unique.`);return values;};
const nonemptyUnique=<T,>(values:readonly T[],label:string)=>{if(!values.length)throw new TypeError(`${label} must be nonempty.`);return unique(values,label);};
const optional=(value:unknown,label:string)=>value===undefined?undefined:requireString(value,label);

function parseCoordinate(value:unknown):CoordinateDescriptor{
  const row=requireRecord(value,'axis coordinates'),kind=requireString(row.kind,'coordinate kind');
  if(kind==='index'){exact(row,['kind'],'index coordinates');return {kind};}
  if(kind==='linear'){exact(row,['kind','referenceValue','referenceIndex','increment'],'linear coordinates');const increment=finite(row.increment,'coordinate increment');if(increment===0)throw new TypeError('Coordinate increment cannot be zero.');return {kind,referenceValue:finite(row.referenceValue,'coordinate reference value'),referenceIndex:finite(row.referenceIndex,'coordinate reference index'),increment};}
  if(kind==='native'){exact(row,['kind','convention','coupledGroup','binBounds'],'native coordinates');if(typeof row.binBounds!=='boolean')throw new TypeError('Native binBounds must be boolean.');return {kind,convention:requireString(row.convention,'native coordinate convention'),binBounds:row.binBounds,...(row.coupledGroup===undefined?{}:{coupledGroup:id(row.coupledGroup,'coupled coordinate group')})};}
  if(kind==='lookup'){exact(row,['kind','memberId','locator','binBounds'],'lookup coordinates');if(typeof row.binBounds!=='boolean')throw new TypeError('Lookup binBounds must be boolean.');return {kind,memberId:id(row.memberId,'coordinate member'),locator:requireString(row.locator,'coordinate locator'),binBounds:row.binBounds};}
  throw new TypeError(`Unsupported coordinate representation ${kind}.`);
}
function parseRepresentation(value:unknown):RepresentationDescriptor{
  const row=requireRecord(value,'representation'),kind=requireString(row.kind,'representation kind');
  if(kind==='array'){exact(row,['kind','shape','storageOrder'],'array representation');const shape=requireArray(row.shape,'array shape').map((n,index)=>whole(n,`shape ${index}`,1));if(!shape.length)throw new TypeError('Array shape cannot be empty.');if(!['row-major','column-major','native'].includes(String(row.storageOrder)))throw new TypeError('Unsupported array storage order.');return {kind,shape,storageOrder:row.storageOrder as 'row-major'|'column-major'|'native'};}
  if(kind==='table'||kind==='events'||kind==='complex-samples'){exact(row,['kind','rows'],`${kind} representation`);return {kind,rows:row.rows===null?null:whole(row.rows,'row count')};}
  if(kind==='physical-field'){exact(row,['kind','topology','samples'],'physical field representation');if(!['points','grid','mesh','other'].includes(String(row.topology)))throw new TypeError('Unsupported physical topology.');return {kind,topology:row.topology as 'points'|'grid'|'mesh'|'other',samples:row.samples===null?null:whole(row.samples,'sample count')};}
  if(kind==='collection'){exact(row,['kind','componentIds'],'collection representation');return {kind,componentIds:nonemptyUnique(list(row.componentIds,'collection components').map((entry,index)=>id(entry,`collection component ${index}`)),'collection components')};}
  throw new TypeError(`Unsupported representation ${kind}.`);
}
function parseAxis(value:unknown):AxisDescriptor{
  const row=requireRecord(value,'axis');exact(row,['id','index','length','role','unit','coordinates','frame'],'axis');
  return {id:id(row.id,'axis id'),index:whole(row.index,'axis index'),length:whole(row.length,'axis length',1),role:requireString(row.role,'axis role'),coordinates:parseCoordinate(row.coordinates),...(optional(row.unit,'axis unit')?{unit:optional(row.unit,'axis unit')}:{}),...(optional(row.frame,'axis frame')?{frame:optional(row.frame,'axis frame')}: {})};
}
function parseColumn(value:unknown):ColumnDescriptor{
  const row=requireRecord(value,'column');exact(row,['id','name','role','datatype','unit','nullable','variableLength','shape'],'column');
  if(typeof row.nullable!=='boolean'||typeof row.variableLength!=='boolean')throw new TypeError('Column nullable and variableLength must be boolean.');
  return {id:id(row.id,'column id'),name:requireString(row.name,'column name'),role:requireString(row.role,'column role'),datatype:requireString(row.datatype,'column datatype'),nullable:row.nullable,variableLength:row.variableLength,...(optional(row.unit,'column unit')?{unit:optional(row.unit,'column unit')}:{}),...(row.shape===undefined?{}:{shape:requireArray(row.shape,'column shape').map((n,index)=>whole(n,`column shape ${index}`,1))})};
}
function parseComponent(value:unknown):ProductComponent{
  const row=requireRecord(value,'component');exact(row,['id','name','families','locations','representation','axes','columns','quantity','calibration','uncertainty','flags','time','frame','dependencyIds'],'component');
  const representation=parseRepresentation(row.representation),axes=requireArray(row.axes,'component axes').map(parseAxis),columns=requireArray(row.columns,'component columns').map(parseColumn);
  unique(axes.map(axis=>axis.id),'axis ids');if(new Set(axes.map(axis=>axis.index)).size!==axes.length)throw new TypeError('Axis indices must be unique.');
  if(representation.kind==='array'&&(axes.length!==representation.shape.length||axes.some(axis=>representation.shape[axis.index]!==axis.length)))throw new TypeError('Array axes must cover the declared shape exactly.');
  unique(columns.map(column=>column.id),'column ids');
  const locations=requireArray(row.locations,'component locations').map(raw=>{const at=requireRecord(raw,'component location');exact(at,['memberId','path','hdu','structure'],'component location');return {memberId:id(at.memberId,'location member'),...(optional(at.path,'location path')?{path:optional(at.path,'location path')}:{}),...(at.hdu===undefined?{}:{hdu:whole(at.hdu,'location HDU')}),...(optional(at.structure,'location structure')?{structure:optional(at.structure,'location structure')}: {})};});
  const quantity=requireRecord(row.quantity,'quantity');exact(quantity,['name','semantics','unit'],'quantity');
  const calibration=requireRecord(row.calibration,'calibration');exact(calibration,['state','basis'],'calibration');if(!['raw','archive-calibrated','locally-reproduced','reconstructed','model-derived','unknown'].includes(String(calibration.state)))throw new TypeError('Unsupported calibration state.');
  let uncertainty:UncertaintyDescriptor|undefined;if(row.uncertainty!==undefined){const raw=requireRecord(row.uncertainty,'uncertainty');exact(raw,['form','componentId','columnId','basis'],'uncertainty');if(!['standard-deviation','variance','inverse-variance','covariance','limits','unknown','none-supplied'].includes(String(raw.form)))throw new TypeError('Unsupported uncertainty form.');uncertainty={form:raw.form as UncertaintyDescriptor['form'],basis:requireString(raw.basis,'uncertainty basis'),...(raw.componentId===undefined?{}:{componentId:id(raw.componentId,'uncertainty component')}),...(raw.columnId===undefined?{}:{columnId:id(raw.columnId,'uncertainty column')})};}
  const flags=requireArray(row.flags,'flags').map(raw=>{const flag=requireRecord(raw,'flag');exact(flag,['id','meaning','componentId','columnId','usableWhen'],'flag');return {id:id(flag.id,'flag id'),meaning:requireString(flag.meaning,'flag meaning'),...(flag.componentId===undefined?{}:{componentId:id(flag.componentId,'flag component')}),...(flag.columnId===undefined?{}:{columnId:id(flag.columnId,'flag column')}),...(optional(flag.usableWhen,'flag policy')?{usableWhen:optional(flag.usableWhen,'flag policy')}: {})};});
  const time=row.time===undefined?undefined:requireRecord(row.time,'time'),frame=row.frame===undefined?undefined:requireRecord(row.frame,'frame');
  if(time)exact(time,['scale','format','referenceEpoch','observer','exposure'],'time');if(frame)exact(frame,['kind','name','referencePosition','epoch'],'frame');
  return {id:id(row.id,'component id'),name:requireString(row.name,'component name'),families:nonemptyUnique(requireArray(row.families,'component families').map((entry,index)=>family(entry,`component family ${index}`)),'component families'),locations:nonemptyUnique(locations.map(location=>JSON.stringify(location)),'component locations').map(text=>JSON.parse(text) as ComponentLocator),representation,axes,columns,
    quantity:{name:requireString(quantity.name,'quantity name'),semantics:requireString(quantity.semantics,'quantity semantics'),...(optional(quantity.unit,'quantity unit')?{unit:optional(quantity.unit,'quantity unit')}: {})},calibration:{state:calibration.state as CalibrationState,basis:list(calibration.basis,'calibration basis')},...(uncertainty?{uncertainty}:{}),flags,
    ...(time?{time:{scale:requireString(time.scale,'time scale'),format:requireString(time.format,'time format'),...(optional(time.referenceEpoch,'time epoch')?{referenceEpoch:optional(time.referenceEpoch,'time epoch')}:{}),...(optional(time.observer,'time observer')?{observer:optional(time.observer,'time observer')}:{}),...(optional(time.exposure,'exposure')?{exposure:optional(time.exposure,'exposure')}: {})}}:{}),
    ...(frame?{frame:{kind:requireString(frame.kind,'frame kind'),name:requireString(frame.name,'frame name'),...(optional(frame.referencePosition,'reference position')?{referencePosition:optional(frame.referencePosition,'reference position')}:{}),...(optional(frame.epoch,'frame epoch')?{epoch:optional(frame.epoch,'frame epoch')}: {})}}:{}),dependencyIds:list(row.dependencyIds,'component dependencies').map((entry,index)=>id(entry,`component dependency ${index}`))};
}

export function parseProductDescriptor(value:unknown):ProductDescriptor{
  const root=requireRecord(value,'product descriptor');exact(root,['schema','dataset','members','components','dependencies','issues'],'product descriptor');if(root.schema!==PRODUCT_DESCRIPTOR_SCHEMA)throw new TypeError(`Unsupported product descriptor schema ${String(root.schema)}.`);
  const dataset=requireRecord(root.dataset,'dataset');exact(dataset,['id','target','acquisition','producingRecord','sourceClassifications','families','profiles'],'dataset');const acquisition=requireRecord(dataset.acquisition,'acquisition');exact(acquisition,['kind','identity'],'acquisition');if(!['archive','local-import','repository'].includes(String(acquisition.kind)))throw new TypeError('Unsupported acquisition kind.');
  const members=requireArray(root.members,'members').map(raw=>{const row=requireRecord(raw,'member');exact(row,['id','path','role','bytes','sha256','mediaType'],'member');const bytes=whole(row.bytes,'member bytes'),sha256=requireString(row.sha256,'member sha256'),role=requireString(row.role,'member role');if(!HEX.test(sha256)||!['science','support','label','coordinates','quality','uncertainty','calibration','response','provenance'].includes(role))throw new TypeError('Invalid member pin or role.');return {id:id(row.id,'member id'),path:requireString(row.path,'member path'),role:role as MemberRole,bytes,sha256,...(optional(row.mediaType,'member media type')?{mediaType:optional(row.mediaType,'member media type')}: {})};});
  nonemptyUnique(members.map(member=>member.id),'member ids');const memberIds=new Set(members.map(member=>member.id));
  const components=requireArray(root.components,'components').map(parseComponent);nonemptyUnique(components.map(component=>component.id),'component ids');const componentIds=new Set(components.map(component=>component.id));
  const dependencies=requireArray(root.dependencies,'dependencies').map(raw=>{const row=requireRecord(raw,'dependency');exact(row,['id','role','memberIds','componentIds','requiredFor','evidence'],'dependency');return {id:id(row.id,'dependency id'),role:requireString(row.role,'dependency role'),memberIds:list(row.memberIds,'dependency members').map((entry,index)=>id(entry,`dependency member ${index}`)),componentIds:list(row.componentIds,'dependency components').map((entry,index)=>id(entry,`dependency component ${index}`)),requiredFor:list(row.requiredFor,'dependency operations'),...(optional(row.evidence,'dependency evidence')?{evidence:optional(row.evidence,'dependency evidence')}: {})};});
  unique(dependencies.map(dependency=>dependency.id),'dependency ids');const dependencyIds=new Set(dependencies.map(dependency=>dependency.id));
  for(const component of components){
    for(const location of component.locations)if(!memberIds.has(location.memberId))throw new TypeError(`Component ${component.id} references missing member ${location.memberId}.`);
    for(const axis of component.axes)if(axis.coordinates.kind==='lookup'&&!memberIds.has(axis.coordinates.memberId))throw new TypeError(`Axis ${axis.id} references missing member ${axis.coordinates.memberId}.`);
    for(const dependency of component.dependencyIds)if(!dependencyIds.has(dependency))throw new TypeError(`Component ${component.id} references missing dependency ${dependency}.`);
    if(component.uncertainty?.componentId&&!componentIds.has(component.uncertainty.componentId))throw new TypeError(`Component ${component.id} uncertainty references missing component ${component.uncertainty.componentId}.`);
    if(component.uncertainty?.columnId&&!component.columns.some(column=>column.id===component.uncertainty!.columnId))throw new TypeError(`Component ${component.id} uncertainty references missing column ${component.uncertainty.columnId}.`);
    for(const flag of component.flags){if(flag.componentId&&!componentIds.has(flag.componentId))throw new TypeError(`Flag ${flag.id} references missing component ${flag.componentId}.`);if(flag.columnId&&!component.columns.some(column=>column.id===flag.columnId))throw new TypeError(`Flag ${flag.id} references missing column ${flag.columnId}.`);}
    if(component.representation.kind==='collection')for(const child of component.representation.componentIds)if(!componentIds.has(child)||child===component.id)throw new TypeError(`Collection ${component.id} has an invalid child ${child}.`);
  }
  for(const dependency of dependencies){for(const member of dependency.memberIds)if(!memberIds.has(member))throw new TypeError(`Dependency ${dependency.id} references missing member ${member}.`);for(const component of dependency.componentIds)if(!componentIds.has(component))throw new TypeError(`Dependency ${dependency.id} references missing component ${component}.`);}
  const classifications=requireArray(dataset.sourceClassifications,'source classifications').map(raw=>{const row=requireRecord(raw,'source classification');exact(row,['term','vocabulary','version','status'],'source classification');if(!['source','mapped','preliminary'].includes(String(row.status)))throw new TypeError('Invalid classification status.');return {term:requireString(row.term,'classification term'),vocabulary:requireString(row.vocabulary,'classification vocabulary'),version:requireString(row.version,'classification version'),status:row.status as 'source'|'mapped'|'preliminary'};});
  const families=nonemptyUnique(requireArray(dataset.families,'dataset families').map((entry,index)=>family(entry,`dataset family ${index}`)),'dataset families');for(const component of components)for(const found of component.families)if(!families.includes(found))throw new TypeError(`Component ${component.id} family ${found} is absent from the dataset.`);
  const profiles=requireArray(dataset.profiles,'validated profiles').map((raw,index)=>{const row=requireRecord(raw,`validated profile ${index}`);exact(row,['handlerId','profileId'],`validated profile ${index}`);return {handlerId:id(row.handlerId,'profile handler'),profileId:id(row.profileId,'profile id')};});nonemptyUnique(profiles.map(profile=>`${profile.handlerId}:${profile.profileId}`),'validated profiles');
  const issues=requireArray(root.issues,'issues').map(raw=>{const row=requireRecord(raw,'issue');exact(row,['scope','identity','state','reason'],'issue');if(!['dataset','member','component','axis','column','dependency'].includes(String(row.scope))||!['missing','conflicting','unsupported','unknown'].includes(String(row.state)))throw new TypeError('Invalid descriptor issue.');return {scope:row.scope as DescriptorIssue['scope'],identity:requireString(row.identity,'issue identity'),state:row.state as DescriptorIssue['state'],reason:requireString(row.reason,'issue reason')};});
  return {schema:PRODUCT_DESCRIPTOR_SCHEMA,dataset:{id:id(dataset.id,'dataset id'),...(optional(dataset.target,'dataset target')?{target:optional(dataset.target,'dataset target')}:{}),acquisition:{kind:acquisition.kind as 'archive'|'local-import'|'repository',identity:requireString(acquisition.identity,'acquisition identity')},producingRecord:requireString(dataset.producingRecord,'producing record'),sourceClassifications:classifications,families,profiles},members,components,dependencies,issues};
}
