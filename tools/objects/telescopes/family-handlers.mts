/** Static observational-family registry. Handlers describe capabilities and retain their existing scientific owners. */
import type { NativeMetadata } from './native-metadata.mts';
import { parseProductDescriptor, type AxisDescriptor, type CalibrationDescriptor, type DescriptorIssue, type DescriptorMember, type FamilyId, type FrameDescriptor, type ProductComponent, type ProductDependency, type ProductDescriptor, type QuantityDescriptor, type TimeDescriptor } from './product-descriptor.mts';
import { F03_SPECTRUM_HANDLER } from './families/f03-spectrum.mts';
import { F04_SLIT_PROFILE_HANDLER } from './families/f04-slit-profile.mts';
import { F05_PHOTOMETRY_HANDLER } from './families/f05-photometry.mts';
import { F06_TIME_SERIES_HANDLER } from './families/f06-time-series.mts';
import { F07_DYNAMIC_SPECTRUM_HANDLER } from './families/f07-dynamic-spectrum.mts';
import { F08_TABLE_HANDLER } from './families/f08-table.mts';
import { F09_ASTROMETRY_HANDLER } from './families/f09-astrometry.mts';
import { F10_EVENTS_HANDLER } from './families/f10-events.mts';
import { F11_MEASUREMENT_SET_HANDLER } from './families/f11-measurement-set.mts';
import { F12_OIFITS_HANDLER } from './families/f12-oifits.mts';
import { F13_POLARIMETRY_HANDLER } from './families/f13-polarimetry.mts';
import { F14_BODY_MAP_SPHERE_HANDLER } from './families/f14-body-map-sphere.mts';
import { F02_MIXED_ND_HANDLER } from './families/f02-mixed-nd.mts';
import { F14_HEALPIX_HANDLER } from './families/f14-healpix.mts';
import { F15_RADAR_HANDLER } from './families/f15-radar.mts';
import { F16_SPATIAL_PHYSICAL_HANDLER } from './families/f16/f16-spatial-physical.mts';
import { F16_CARTESIAN_GRID_HANDLER } from './families/f16/f16-cartesian-grid.mts';
import { F16_SPHERICAL_GRID_HANDLER } from './families/f16/f16-spherical-grid.mts';
import { F16_PLANETARY_DEPTH_HANDLER } from './families/f16/f16-planetary-depth.mts';
import { F16_JUNO_MWR_RETRIEVAL_HANDLER } from './families/f16/f16-juno-mwr-retrieval.mts';
import { F16_PLANETARY_COVERAGE_HANDLER } from './families/f16/f16-planetary-coverage.mts';
import { F16_SHARAD_PDS4_HANDLER } from './families/f16/f16-sharad-pds4.mts';
import { F17_CALIBRATION_HANDLER } from './families/f17-calibration.mts';
import { F18_COMPOUND_HANDLER } from './families/f18-compound.mts';

export interface HandlerEvidenceReference {readonly path:string;readonly establishes:string;readonly status:'partial'|'complete'}
export interface FormatProfile {readonly id:string;readonly format:string;readonly version:string;readonly families:readonly FamilyId[];readonly evidence:readonly HandlerEvidenceReference[];readonly publicBaseline?:boolean}
export interface OperationParameter {
  readonly id:string;readonly option:string;readonly kind:'integer'|'number-list'|'number-list-or-choice'|'choice'|'input-path'|'output-directory';readonly required:boolean;readonly description:string;
  readonly count?:number;readonly minimum?:number;readonly choices?:readonly string[];
}
export interface FamilyOperation {
  readonly id:string;readonly label:string;readonly handlerId:string;readonly componentId:string;readonly owner:{readonly module:string;readonly export:string};
  readonly available:boolean;readonly reason:string;readonly fixedArguments:Readonly<Record<string,string|number>>;readonly parameters:readonly OperationParameter[];readonly limitations:readonly string[];
}
export interface FamilyHandler {
  readonly id:string;readonly profiles:readonly FormatProfile[];readonly families:readonly FamilyId[];
  readonly recognizes:(members:readonly {readonly path:string;readonly prefix:Uint8Array}[])=>readonly string[];
  readonly operations:(descriptor:ProductDescriptor)=>readonly FamilyOperation[];
}
export interface RasterCompatibilityInput {
  readonly dataset:{readonly id:string;readonly target?:string;readonly acquisition:ProductDescriptor['dataset']['acquisition'];readonly producingRecord:string;readonly sourceClassifications?:ProductDescriptor['dataset']['sourceClassifications']};
  readonly profile:string;readonly members:readonly DescriptorMember[];readonly scienceMemberId:string;readonly nativeMetadata:NativeMetadata;
  readonly quantity:QuantityDescriptor;readonly calibration:CalibrationDescriptor;readonly frame?:FrameDescriptor;readonly time?:TimeDescriptor;readonly dependencies?:readonly ProductDependency[];
}

const outputOwner={module:'tools/objects/telescopes/outputs.mts',export:'exportOutput'} as const;
const out:OperationParameter={id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'};
const integer=(id:string,description:string):OperationParameter=>({id,option:`--${id}`,kind:'integer',required:true,minimum:0,description});
const numbers=(id:string,count:number,description:string):OperationParameter=>({id,option:`--${id}`,kind:'number-list',required:true,count,description});
const choice=(id:string,choices:readonly string[],description:string):OperationParameter=>({id,option:`--${id}`,kind:'choice',required:true,choices,description});
const operation=(component:ProductComponent,id:string,label:string,available:boolean,reason:string,parameters:readonly OperationParameter[]):FamilyOperation=>({id,label,handlerId:'raster-f01-f02',componentId:component.id,owner:outputOwner,available,reason,fixedArguments:Object.fromEntries(component.locations.flatMap(location=>[...(location.hdu===undefined?[]:[['hdu',location.hdu] as const]),...(location.structure===undefined?[]:[['structure',location.structure] as const])])),parameters:[...parameters,out],limitations:[]});

function rasterOperations(descriptor:ProductDescriptor):FamilyOperation[]{
  const result:FamilyOperation[]=[];
  for(const component of descriptor.components.filter(component=>component.representation.kind==='array')){
    const shape=component.representation.kind==='array'?component.representation.shape:[],spectral=component.axes.find(axis=>axis.role==='spectral'),spatial=shape.length>=2&&shape.slice(0,-3).every(length=>length===1),separableSpectral=spectral?.index===shape.length-3;
    const image=spatial&&(spectral===undefined?(shape.length===2||shape.at(-3)===1):separableSpectral);
    result.push(operation(component,'image',shape.length>2?'Image plane':'Image',image,image?'Native image coordinates and masks are retained.':'The compatibility owner requires two spatial axes and, when present, one separable leading spectral axis.',shape.length>2?[integer('plane','Zero-based plane index.')]:[]));
    if(spectral){
      result.push(operation(component,'spectrum','Pixel spectrum',image&&separableSpectral,image&&separableSpectral?'Select one explicit spatial pixel.':'No compatible separable spectral axis.',[numbers('pixel',2,'Zero-based X,Y pixel.')]))
      const qualifiedUnit=component.quantity.unit!==undefined,edges=spectral.coordinates.kind==='native'&&spectral.coordinates.binBounds||spectral.coordinates.kind==='lookup'&&spectral.coordinates.binBounds;
      result.push(operation(component,'band-image','Band image',image&&separableSpectral&&qualifiedUnit&&edges,'Requires a compatible spectral cube, qualified units and explicit bin bounds.',[numbers('band',2,'Increasing wavelength interval.'),choice('uncertainty',['omit','independent'],'Uncertainty policy.')]));
      result.push(operation(component,'aperture-spectrum','Aperture spectrum',image&&separableSpectral&&qualifiedUnit&&edges,'Requires a compatible spectral cube, qualified units and explicit bin bounds.',[numbers('aperture',4,'X0,Y0,X1,Y1 aperture.'),{id:'background',option:'--background',kind:'number-list-or-choice',required:true,count:4,choices:['none'],description:'Disjoint background bounds, or the explicit choice none.'},choice('uncertainty',['omit','independent'],'Uncertainty policy.')]));
      result.push(operation(component,'feature-map','Feature map',image&&separableSpectral&&qualifiedUnit&&edges,'Requires a compatible spectral cube, qualified units and explicit bin bounds.',[numbers('band',2,'Feature wavelength interval.'),numbers('continuum',4,'Two bracketing continuum intervals.'),choice('uncertainty',['omit','independent'],'Uncertainty policy.')]));
    }
  }
  return result;
}

const RASTER_PROFILES:readonly FormatProfile[]=[
  {id:'fits-image-array@1',format:'FITS image HDU',version:'FITS 4.0 compatibility profile',families:['F01','F02'],publicBaseline:true,evidence:[{path:'tools/objects/telescopes/product-science.test.mts',establishes:'Pinned FITS image and spectral-cube readback and native exports.',status:'complete'},{path:'tools/objects/telescopes/cube-outputs.test.mts',establishes:'Image, spectrum and aggregate cube outputs with masks and units.',status:'complete'}]},
  {id:'pds-image-array@1',format:'PDS image array decoded by the pinned pdr boundary',version:'repository PDS compatibility profile',families:['F01','F02'],evidence:[{path:'tools/objects/telescopes/output-handoffs.test.mts',establishes:'Pinned PDS arrays and companions enter the existing output boundary.',status:'partial'}]},
  {id:'isis3-image-array@1',format:'ISIS3 numeric core',version:'repository ISIS3 compatibility profile',families:['F01','F02'],evidence:[{path:'tools/objects/telescopes/product-science.test.mts',establishes:'ISIS core metadata, masks and calibration dependency checks.',status:'partial'}]},
] as const;
export const RASTER_F01_F02_HANDLER:FamilyHandler={id:'raster-f01-f02',profiles:RASTER_PROFILES,families:['F01','F02'],recognizes:members=>members.some(member=>Buffer.from(member.prefix).subarray(0,9).toString('latin1')==='SIMPLE  =')?['fits-image-array@1']:[],operations:rasterOperations};
export const FAMILY_HANDLERS:readonly FamilyHandler[]=[RASTER_F01_F02_HANDLER,F02_MIXED_ND_HANDLER,F03_SPECTRUM_HANDLER,F04_SLIT_PROFILE_HANDLER,F05_PHOTOMETRY_HANDLER,F06_TIME_SERIES_HANDLER,F07_DYNAMIC_SPECTRUM_HANDLER,F08_TABLE_HANDLER,F09_ASTROMETRY_HANDLER,F10_EVENTS_HANDLER,F11_MEASUREMENT_SET_HANDLER,F12_OIFITS_HANDLER,F13_POLARIMETRY_HANDLER,F14_BODY_MAP_SPHERE_HANDLER,F14_HEALPIX_HANDLER,F15_RADAR_HANDLER,F16_SPATIAL_PHYSICAL_HANDLER,F16_CARTESIAN_GRID_HANDLER,F16_SPHERICAL_GRID_HANDLER,F16_PLANETARY_DEPTH_HANDLER,F16_JUNO_MWR_RETRIEVAL_HANDLER,F16_PLANETARY_COVERAGE_HANDLER,F16_SHARAD_PDS4_HANDLER,F17_CALIBRATION_HANDLER,F18_COMPOUND_HANDLER];

export function familyCoverageLedger():readonly {readonly family:FamilyId;readonly status:'unimplemented'|'partial'|'complete';readonly profiles:readonly {readonly handlerId:string;readonly profileId:string;readonly evidence:readonly HandlerEvidenceReference[]}[]}[]{
  return (['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','F17','F18'] as const).map(family=>{
    const profiles=FAMILY_HANDLERS.flatMap(handler=>handler.profiles.filter(profile=>profile.families.includes(family)).map(profile=>({handlerId:handler.id,profileId:profile.id,evidence:profile.evidence})));
    const baselines=profiles.filter(profile=>familyProfile(profile.profileId).profile.publicBaseline===true),evidence=baselines.flatMap(profile=>profile.evidence),status: 'unimplemented'|'partial'|'complete'=!profiles.length?'unimplemented':baselines.length>0&&evidence.length>0&&evidence.every(entry=>entry.status==='complete')?'complete':'partial';return {family,status,profiles};
  });
}

export function familyHandler(id:string):FamilyHandler{
  const found=FAMILY_HANDLERS.filter(handler=>handler.id===id);if(found.length!==1)throw new TypeError(`Unknown or ambiguous family handler ${id}.`);return found[0]!;
}
export function familyProfile(id:string):{readonly handler:FamilyHandler;readonly profile:FormatProfile}{
  const found=FAMILY_HANDLERS.flatMap(handler=>handler.profiles.filter(profile=>profile.id===id).map(profile=>({handler,profile})));if(found.length!==1)throw new TypeError(`Unknown or ambiguous family profile ${id}.`);return found[0]!;
}
export function operationsForDescriptor(value:unknown):readonly FamilyOperation[]{
  const descriptor=parseProductDescriptor(value),handlers=descriptor.dataset.profiles.map(entry=>{const selected=familyHandler(entry.handlerId);if(!selected.profiles.some(profile=>profile.id===entry.profileId))throw new TypeError(`Handler ${entry.handlerId} does not own profile ${entry.profileId}.`);return selected;});
  return handlers.flatMap(handler=>handler.operations(descriptor));
}
export function proposedFamilyProfiles(members:readonly {readonly path:string;readonly prefix:Uint8Array}[]):readonly {readonly handlerId:string;readonly profileId:string}[]{
  return FAMILY_HANDLERS.flatMap(handler=>handler.recognizes(members).map(profileId=>({handlerId:handler.id,profileId})));
}

const componentId=(metadata:NativeMetadata,index:number)=>metadata.fitsHdu===undefined?`structure-${index}`:`hdu-${metadata.fitsHdu}`;
function axes(metadata:NativeMetadata):AxisDescriptor[]{
  const shape=metadata.shape!;
  return shape.map((length,index)=>{const spectral=metadata.spectral?.axis===index,role=spectral?'spectral':index===shape.length-1?'x':index===shape.length-2?'y':'unknown';return {id:`axis-${index}`,index,length,role,...(spectral?{unit:'um'}:{}),coordinates:spectral?{kind:'native' as const,convention:metadata.spectral!.source,binBounds:metadata.spectral!.binEdgesMicrometres!==undefined}:{kind:'index' as const}};});
}
/** Adapt the existing F01/F02 NativeMetadata without squeezing axes or promoting limitations into facts. */
export function describeRasterCompatibility(input:RasterCompatibilityInput):ProductDescriptor{
  const profile=familyProfile(input.profile);if(profile.handler.id!==RASTER_F01_F02_HANDLER.id)throw new TypeError(`${input.profile} is not an F01/F02 raster profile.`);
  if(!input.members.some(member=>member.id===input.scienceMemberId))throw new TypeError('Raster science member is absent.');
  const structures=input.nativeMetadata.structures??[input.nativeMetadata],issues:DescriptorIssue[]=[],components:ProductComponent[]=structures.map((metadata,index)=>{
    if(!metadata.shape?.length)throw new TypeError(`Raster structure ${metadata.structure} has no qualified shape.`);
    const id=componentId(metadata,index),families:[FamilyId,...FamilyId[]]=metadata.shape.length===2?['F01']:['F02'];
    for(const reason of metadata.limitations)issues.push({scope:'component',identity:id,state:'unknown',reason});
    const uncertainty=metadata.uncertainty===undefined?undefined:{form:metadata.uncertainty.status==='validated'?'standard-deviation' as const:metadata.uncertainty.kind===null?'none-supplied' as const:'unknown' as const,basis:metadata.uncertainty.structure??'No qualified uncertainty structure.'};
    const flags=metadata.quality?[{id:'quality-mask',meaning:metadata.quality.policy,usableWhen:'Handler-owned operation policy; no universal finite-positive rule.'}]:[];
    return {id,name:metadata.structure,families,locations:[{memberId:input.scienceMemberId,...(metadata.fitsHdu===undefined?{}:{hdu:metadata.fitsHdu}),structure:metadata.structure}],representation:{kind:'array',shape:metadata.shape,storageOrder:'native'},axes:axes(metadata),columns:[],quantity:{...input.quantity,...(metadata.units?{unit:metadata.units.value}:{})},calibration:input.calibration,...(uncertainty?{uncertainty}:{}),flags,...(input.frame?{frame:input.frame}:{}),...(input.time?{time:input.time}:{}),dependencyIds:(input.dependencies??[]).map(dependency=>dependency.id)};
  });
  const families=[...new Set(components.flatMap(component=>component.families))];
  return parseProductDescriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{...input.dataset,sourceClassifications:input.dataset.sourceClassifications??[],families,profiles:[{handlerId:profile.handler.id,profileId:profile.profile.id}]},members:input.members,components,dependencies:input.dependencies??[],issues});
}
