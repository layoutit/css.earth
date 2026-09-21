/** Exact sparse planetary support. This owns no gridding, interpolation, inversion, or volume construction. */
import type { CalibrationDescriptor, DescriptorMember, FrameDescriptor, ObservabilityDescriptor, ProductDescriptor, QuantityDescriptor, SupportDescriptor } from '../product-descriptor.mts';
import type { FamilyHandler, FamilyOperation } from '../family-handlers.mts';
import { pds3Values } from '../../pds3-labels.mts';
import { pds4Elements, pds4Field, pds4Number } from '../../pds-labels.mts';
import { csv, descriptor, finite, stable } from './common.mts';

export const F16_PLANETARY_COVERAGE_PROFILE='exact-sparse-planetary-coverage@1' as const;
export type SparseCoverageKind='track'|'ray'|'station'|'profile';
/** Every output a sparse support set cannot become. The limitation text and the refusal share this list. */
export type SparseCoveragePromotion='grid'|'volume'|'material-property'|'interior-model'|'interpolated-field';
export type SparseCoverageGeometry=
  |{readonly kind:'body-fixed-point';readonly x:number;readonly y:number;readonly z:number;readonly unit:string}
  |{readonly kind:'longitude-latitude';readonly longitude:number;readonly latitude:number;readonly unit:string}
  |{readonly kind:'body-fixed-ray';readonly start:readonly [number,number,number];readonly end:readonly [number,number,number];readonly unit:string};
export interface SparseCoverageSample {readonly id:string;readonly memberId:string;readonly geometry:SparseCoverageGeometry;readonly nativeCoordinate?:number;readonly nativeCoordinateUnit?:string;readonly note?:string}
export interface SparsePlanetaryCoverageInput {
  readonly id:string;readonly target:string;readonly producingRecord:string;readonly members:readonly DescriptorMember[];readonly scienceMemberIds:readonly string[];
  readonly kind:SparseCoverageKind;readonly samples:readonly SparseCoverageSample[];readonly frame:FrameDescriptor;readonly quantity:QuantityDescriptor;readonly calibration:CalibrationDescriptor;
  readonly observability:ObservabilityDescriptor;readonly unsupportedRegions:SupportDescriptor['unsupportedRegions'];readonly coverageDescription:string;
  readonly acquisition?:ProductDescriptor['dataset']['acquisition'];
}
export interface SparseCoverageInspection {readonly kind:SparseCoverageKind;readonly samples:number;readonly geometry:'body-fixed'|'located'|'mixed';readonly memberIds:readonly string[];readonly unsupportedRegions:number;readonly limitations:readonly string[]}

const domainFor:Record<SparseCoverageKind,'tracks'|'rays'|'regions'|'profiles'>={track:'tracks',ray:'rays',station:'regions',profile:'profiles'};
const coverageFor:Record<SparseCoverageKind,ObservabilityDescriptor['coverage']['kind']>={track:'tracks',ray:'rays',station:'stations',profile:'profiles'};
const LENGTH_UNITS=['m','km'] as const,ANGLE_UNITS=['deg','rad'] as const;
const REFUSED_PROMOTIONS:readonly SparseCoveragePromotion[]=['grid','volume','material-property','interior-model','interpolated-field'];
export const SPARSE_COVERAGE_LIMITATIONS:readonly string[]=[
  'Exact tracks, rays, stations, or profiles remain sparse support; no interpolation is performed.',
  'This coverage cannot be promoted to a grid, volume, material property, interior model, or interpolated field.',
];

const ids=(values:readonly string[],label:string)=>{if(!values.length||new Set(values).size!==values.length||values.some(value=>!value))throw new TypeError(`${label} must be nonempty and unique.`);return values;};
const point=(value:readonly number[],label:string)=>{if(value.length!==3)throw new TypeError(`${label} requires three coordinates.`);value.forEach((coordinate,index)=>finite(coordinate,`${label} coordinate ${index}`));return value;};
const geometryKind=(geometry:SparseCoverageGeometry)=>geometry.kind==='longitude-latitude'?'located':'body-fixed';
const lengthUnit=(unit:string,label:string)=>{if(!(LENGTH_UNITS as readonly string[]).includes(unit))throw new TypeError(`${label} must state a length unit (${LENGTH_UNITS.join(', ')}); the archive unit must not be relabelled.`);return unit;};
const angleUnit=(unit:string,label:string)=>{if(!(ANGLE_UNITS as readonly string[]).includes(unit))throw new TypeError(`${label} must state an angle unit (${ANGLE_UNITS.join(', ')}); the archive unit must not be relabelled.`);return unit;};
const bounded=(value:number,limit:number,label:string)=>{if(Math.abs(finite(value,label))>limit)throw new TypeError(`${label} lies outside the body's own +/-${limit} range.`);return value;};

/** Sparse support never fills the body. A product that declares no unobserved region claims coverage it does not have. */
function validateSupport(input:SparsePlanetaryCoverageInput,memberIds:ReadonlySet<string>):void{
  if(input.frame.kind!=='body-fixed')throw new TypeError(`Sparse planetary coverage requires a body-fixed frame, not ${input.frame.kind}; sparse support is not retained in a sky or inertial frame.`);
  if(!input.frame.name)throw new TypeError('Sparse planetary coverage requires the named body-fixed frame the archive states.');
  if(input.observability.coverage.kind!==coverageFor[input.kind])throw new TypeError(`Sparse ${input.kind} coverage requires observability kind ${coverageFor[input.kind]}.`);
  if(!input.observability.coverage.memberIds.length||input.observability.coverage.memberIds.some(id=>!memberIds.has(id)))throw new TypeError('Sparse coverage observability must retain exact member identities.');
  if(!input.unsupportedRegions.some(region=>region.kind==='unobserved'))throw new TypeError('Sparse planetary coverage must declare the unobserved remainder of the body as unsupported.');
  for(const region of input.unsupportedRegions)if(region.memberId&&!memberIds.has(region.memberId))throw new TypeError(`Sparse coverage unsupported region references absent member ${region.memberId}.`);
}

function validateGeometry(sample:SparseCoverageSample,kind:SparseCoverageKind):void{
  const geometry=sample.geometry,label=`Sparse coverage sample ${sample.id}`;
  if(!geometry.unit)throw new TypeError(`${label} has no geometry unit.`);
  if(kind==='ray'&&geometry.kind!=='body-fixed-ray')throw new TypeError('Sparse ray coverage requires exact body-fixed ray endpoints.');
  if(kind!=='ray'&&geometry.kind==='body-fixed-ray')throw new TypeError('Only sparse ray coverage may carry ray endpoints.');
  if(geometry.kind==='body-fixed-point'){lengthUnit(geometry.unit,`${label} geometry unit`);point([geometry.x,geometry.y,geometry.z],label);}
  if(geometry.kind==='longitude-latitude'){const unit=angleUnit(geometry.unit,`${label} geometry unit`),turn=unit==='deg'?360:2*Math.PI;bounded(geometry.longitude,turn,`${label} longitude`);bounded(geometry.latitude,turn/4,`${label} latitude`);}
  if(geometry.kind==='body-fixed-ray'){
    lengthUnit(geometry.unit,`${label} geometry unit`);point(geometry.start,`${label} ray start`);point(geometry.end,`${label} ray end`);
    if(geometry.start.every((value,index)=>value===geometry.end[index]))throw new TypeError(`${label} ray endpoints must differ.`);
  }
}

function validate(input:SparsePlanetaryCoverageInput):void{
  stable(input.id,'sparse coverage id');ids(input.scienceMemberIds,'sparse coverage science members');if(!input.samples.length)throw new TypeError('Sparse planetary coverage requires at least one exact sample.');
  const memberIds=new Set(input.members.map(member=>member.id));for(const id of input.scienceMemberIds)if(!memberIds.has(id))throw new TypeError(`Sparse coverage references absent science member ${id}.`);
  validateSupport(input,memberIds);
  const sampleIds=new Set<string>();
  for(const sample of input.samples){
    stable(sample.id,'sparse coverage sample id');if(sampleIds.has(sample.id))throw new TypeError('Sparse coverage sample ids must be unique.');sampleIds.add(sample.id);
    if(!memberIds.has(sample.memberId))throw new TypeError(`Sparse coverage sample ${sample.id} references absent member ${sample.memberId}.`);
    if((sample.nativeCoordinate===undefined)!==(sample.nativeCoordinateUnit===undefined))throw new TypeError(`Sparse coverage sample ${sample.id} must retain both native coordinate and unit together.`);
    if(sample.nativeCoordinate!==undefined)finite(sample.nativeCoordinate,`Sparse coverage sample ${sample.id} native coordinate`);
    validateGeometry(sample,input.kind);
  }
}

export function inspectSparsePlanetaryCoverage(input:SparsePlanetaryCoverageInput):SparseCoverageInspection{validate(input);const kinds=new Set(input.samples.map(sample=>geometryKind(sample.geometry)));return{kind:input.kind,samples:input.samples.length,geometry:kinds.size===1?[...kinds][0]!:'mixed',memberIds:[...new Set(input.samples.map(sample=>sample.memberId))],unsupportedRegions:input.unsupportedRegions.length,limitations:[...SPARSE_COVERAGE_LIMITATIONS]};}
export function exportSparsePlanetaryCoverageCsv(input:SparsePlanetaryCoverageInput):string{inspectSparsePlanetaryCoverage(input);const head=['sample_id','member_id','geometry','unit','x_or_longitude','y_or_latitude','z','end_x','end_y','end_z','native_coordinate','native_coordinate_unit','note'];const rows=input.samples.map(sample=>{const geometry=sample.geometry;if(geometry.kind==='body-fixed-ray')return[sample.id,sample.memberId,geometry.kind,geometry.unit,...geometry.start,...geometry.end,sample.nativeCoordinate??null,sample.nativeCoordinateUnit??null,sample.note??null];if(geometry.kind==='body-fixed-point')return[sample.id,sample.memberId,geometry.kind,geometry.unit,geometry.x,geometry.y,geometry.z,null,null,null,sample.nativeCoordinate??null,sample.nativeCoordinateUnit??null,sample.note??null];return[sample.id,sample.memberId,geometry.kind,geometry.unit,geometry.longitude,geometry.latitude,null,null,null,null,sample.nativeCoordinate??null,sample.nativeCoordinateUnit??null,sample.note??null];});return csv(head,rows);}
export function exportSparsePlanetaryCoverageJson(input:SparsePlanetaryCoverageInput):string{return `${JSON.stringify({schema:'cssearth-sparse-planetary-coverage@1',inspection:inspectSparsePlanetaryCoverage(input),frame:input.frame,coverage:{kind:input.kind,description:input.coverageDescription,samples:input.samples,unsupportedRegions:input.unsupportedRegions}},null,2)}\n`;}
export function refuseSparseCoveragePromotion(output:SparseCoveragePromotion):never{if(!REFUSED_PROMOTIONS.includes(output))throw new TypeError(`${String(output)} is not a declared sparse coverage refusal.`);throw new TypeError(`Sparse planetary coverage cannot be promoted to a ${output}; retain exact support geometry or supply a separately qualified published reconstruction.`);}

export type SparseCoverageCell=string|number|null;
export interface SparseCoverageRow {readonly [column:string]:SparseCoverageCell}
/** Names the archive columns that already hold the support geometry. Nothing here computes a coordinate, completes an endpoint, or fills a gap. */
export interface SparseCoverageColumnMap {
  readonly memberId:string;readonly idColumn:string;readonly idPrefix:string;readonly unit:string;
  readonly geometry:
    |{readonly kind:'body-fixed-point';readonly x:string;readonly y:string;readonly z:string}
    |{readonly kind:'longitude-latitude';readonly longitude:string;readonly latitude:string}
    |{readonly kind:'body-fixed-ray';readonly start:readonly [string,string,string];readonly end:readonly [string,string,string]};
  readonly nativeCoordinate?:{readonly column:string;readonly unit:string};
  readonly noteColumn?:string;
}
const cell=(row:SparseCoverageRow,column:string,index:number)=>{if(!(column in row))throw new TypeError(`Archive row ${index} has no column ${column}; sparse coverage refuses an absent support coordinate.`);const value=row[column];if(value===null)throw new TypeError(`Archive row ${index} column ${column} is null; sparse coverage refuses to fill a missing support coordinate.`);if(typeof value!=='number')throw new TypeError(`Archive row ${index} column ${column} is not numeric.`);return finite(value,`Archive row ${index} column ${column}`);};
const identity=(row:SparseCoverageRow,map:SparseCoverageColumnMap,index:number)=>{if(!(map.idColumn in row))throw new TypeError(`Archive row ${index} has no identity column ${map.idColumn}.`);const value=row[map.idColumn];if(value===null)throw new TypeError(`Archive row ${index} has no identity value.`);return stable(`${map.idPrefix}-${String(value).trim().replaceAll(/[^A-Za-z0-9._:-]+/gu,'-')}`,'sparse coverage sample id');};
const note=(row:SparseCoverageRow,column:string|undefined)=>{if(column===undefined)return undefined;const value=row[column];return value===null||value===undefined?undefined:String(value).trim()||undefined;};
/** Transport: retain named archive columns as exact samples. A row missing any named column is refused, never completed. */
export function sparseCoverageSamples(rows:readonly SparseCoverageRow[],map:SparseCoverageColumnMap):SparseCoverageSample[]{
  if(!rows.length)throw new TypeError('Sparse coverage needs at least one archive row.');
  const geometry=map.geometry;
  return rows.map((row,index)=>{
    const shape:SparseCoverageGeometry=geometry.kind==='body-fixed-point'
      ?{kind:'body-fixed-point',x:cell(row,geometry.x,index),y:cell(row,geometry.y,index),z:cell(row,geometry.z,index),unit:map.unit}
      :geometry.kind==='longitude-latitude'
        ?{kind:'longitude-latitude',longitude:cell(row,geometry.longitude,index),latitude:cell(row,geometry.latitude,index),unit:map.unit}
        :{kind:'body-fixed-ray',start:[cell(row,geometry.start[0],index),cell(row,geometry.start[1],index),cell(row,geometry.start[2],index)],end:[cell(row,geometry.end[0],index),cell(row,geometry.end[1],index),cell(row,geometry.end[2],index)],unit:map.unit};
    const native=map.nativeCoordinate===undefined?{}:{nativeCoordinate:cell(row,map.nativeCoordinate.column,index),nativeCoordinateUnit:map.nativeCoordinate.unit};
    const comment=note(row,map.noteColumn);
    return {id:identity(row,map,index),memberId:map.memberId,geometry:shape,...native,...(comment?{note:comment}:{})};
  });
}

/* Bounded PDS3 fixed-length ASCII table reading. `pds3Values` owns the label's unambiguous scalars; repeated COLUMN
   objects are outside what it can select, so only their declared extents are read here. Nothing is decoded beyond
   the columns the caller names. */
export interface Pds3TableColumn {readonly name:string;readonly dataType:string;readonly startByte:number;readonly bytes:number;readonly unit?:string}
export interface Pds3AsciiTable {readonly dataSetId:string;readonly productId:string;readonly rows:number;readonly rowBytes:number;readonly recordBytes:number;readonly columns:readonly Pds3TableColumn[]}
const COLUMN_BLOCK=/OBJECT\s*=\s*COLUMN\b([\s\S]*?)END_OBJECT\s*=\s*COLUMN\b/gu;
const NUMERIC_TYPES=['ASCII_REAL','ASCII_INTEGER'];
const PDS3_UNITS:Readonly<Record<string,string>>={KILOMETER:'km',METER:'m',DEGREE:'deg',DEG:'deg',RADIAN:'rad'};
/** Read the geometry unit the archive column states. An unlisted unit is refused rather than assumed. */
export const pds3GeometryUnit=(column:Pds3TableColumn)=>{const unit=column.unit===undefined?undefined:PDS3_UNITS[column.unit.toUpperCase()];if(!unit)throw new TypeError(`PDS3 column ${column.name} states no supported geometry unit (${String(column.unit)}).`);return unit;};
const UTC_TEXT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u;
const labelField=(label:string,key:string)=>{const value=pds3Values(label,key);if(!value||value.length!==1||!value[0])throw new TypeError(`PDS3 label lacks a single ${key}.`);return value[0];};
const blockField=(block:string,key:string)=>{const match=new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*"?([^"\\r\\n]*)"?[ \\t]*$`,'mu').exec(block);return match?match[1]!.trim():undefined;};
const required=(block:string,key:string,index:number)=>{const value=blockField(block,key);if(!value)throw new TypeError(`PDS3 column ${index} lacks ${key}.`);return value;};
const positive=(value:string,label:string)=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<1)throw new TypeError(`PDS3 ${label} must be a positive whole number.`);return number;};
export function readPds3AsciiTable(label:string):Pds3AsciiTable{
  if(labelField(label,'RECORD_TYPE')!=='FIXED_LENGTH')throw new TypeError('Sparse coverage reads only fixed-length PDS3 tables.');
  if(labelField(label,'INTERCHANGE_FORMAT')!=='ASCII')throw new TypeError('Sparse coverage reads only ASCII PDS3 tables.');
  const rows=positive(labelField(label,'ROWS'),'ROWS'),rowBytes=positive(labelField(label,'ROW_BYTES'),'ROW_BYTES'),recordBytes=positive(labelField(label,'RECORD_BYTES'),'RECORD_BYTES'),declared=positive(labelField(label,'COLUMNS'),'COLUMNS');
  if(rowBytes>recordBytes)throw new TypeError('PDS3 ROW_BYTES exceeds RECORD_BYTES.');
  const columns=[...label.matchAll(COLUMN_BLOCK)].map((match,index)=>{
    const block=match[1]!,startByte=positive(required(block,'START_BYTE',index),`column ${index} START_BYTE`),bytes=positive(required(block,'BYTES',index),`column ${index} BYTES`),unit=blockField(block,'UNIT');
    if(startByte+bytes-1>rowBytes)throw new TypeError(`PDS3 column ${index} extends past ROW_BYTES.`);
    return {name:required(block,'NAME',index),dataType:required(block,'DATA_TYPE',index),startByte,bytes,...(unit?{unit}:{})};
  });
  if(columns.length!==declared)throw new TypeError(`PDS3 label declares ${declared} columns and defines ${columns.length}.`);
  if(new Set(columns.map(column=>column.name)).size!==columns.length)throw new TypeError('PDS3 column names must be unique.');
  return {dataSetId:labelField(label,'DATA_SET_ID'),productId:labelField(label,'PRODUCT_ID'),rows,rowBytes,recordBytes,columns};
}
/** Read only the named columns. A numeric column must parse finitely; nothing is filled in for a blank cell. */
export function pds3AsciiRows(table:Pds3AsciiTable,bytes:Uint8Array,names:readonly string[]):SparseCoverageRow[]{
  if(bytes.byteLength!==table.rows*table.recordBytes)throw new TypeError(`PDS3 table is ${bytes.byteLength} bytes and its label declares ${table.rows*table.recordBytes}.`);
  const selected=names.map(name=>{const column=table.columns.find(entry=>entry.name===name);if(!column)throw new TypeError(`PDS3 table has no column ${name}.`);return column;});
  const text=Buffer.from(bytes).toString('latin1');
  return Array.from({length:table.rows},(_,row)=>Object.fromEntries(selected.map(column=>{
    const start=row*table.recordBytes+column.startByte-1,cell=text.slice(start,start+column.bytes).trim();
    if(!cell)throw new TypeError(`PDS3 row ${row} column ${column.name} is blank; sparse coverage refuses to fill it.`);
    if(!NUMERIC_TYPES.includes(column.dataType))return[column.name,cell];
    const value=Number(cell);if(!Number.isFinite(value))throw new TypeError(`PDS3 row ${row} column ${column.name} is not a finite number.`);
    return[column.name,value];
  })));
}
export interface Pds3RowSide {readonly prefix:string;readonly rows:readonly SparseCoverageRow[]}
/** ASSUMED pairing, checked: the two archive tables list one row per measurement point in the same order. Row i is
    paired with row i only when both declared UTC columns agree within the caller's stated tolerance. */
export function pairPds3AsciiRows(left:Pds3RowSide,right:Pds3RowSide,options:{readonly utcColumn:string;readonly toleranceMs:number}):SparseCoverageRow[]{
  if(!left.rows.length||left.rows.length!==right.rows.length)throw new TypeError('Paired PDS3 tables must have the same nonempty row count.');
  if(left.prefix===right.prefix)throw new TypeError('Paired PDS3 tables need distinct column prefixes.');
  if(!(options.toleranceMs>=0)||!Number.isFinite(options.toleranceMs))throw new TypeError('A paired PDS3 UTC tolerance must be stated as a finite, non-negative number of milliseconds.');
  const instant=(row:SparseCoverageRow,side:string,index:number)=>{
    const value=row[options.utcColumn];if(typeof value!=='string'||!UTC_TEXT.test(value))throw new TypeError(`${side} row ${index} has no ${options.utcColumn} value in the archive's declared UTC form.`);
    return Date.parse(`${value}Z`);
  };
  return left.rows.map((row,index)=>{
    const other=right.rows[index]!,difference=Math.abs(instant(row,left.prefix,index)-instant(other,right.prefix,index));
    if(difference>options.toleranceMs)throw new TypeError(`Paired PDS3 rows ${index} differ by ${difference} ms, beyond the stated ${options.toleranceMs} ms; the pairing is refused rather than adjusted.`);
    return Object.fromEntries([...Object.entries(row).map(([name,value])=>[`${left.prefix}_${name}`,value] as const),...Object.entries(other).map(([name,value])=>[`${right.prefix}_${name}`,value] as const)]);
  });
}

/* FDSN StationXML station rows. The shared PDS4 element readers own the tag spellings; the per-channel repetitions
   are removed first so each station's own coordinates stay unambiguous. Instrument response is not read. */
const CHANNEL_BLOCK=/<Channel(?:\s[^>]*)?>[\s\S]*?<\/Channel>/gu;
const STATION_CODE=/^<Station\s[^>]*\bcode="([^"]+)"/u;
export function readFdsnStationRows(xml:string):SparseCoverageRow[]{
  const network=pds4Elements(xml,'Network');if(network.length!==1)throw new TypeError('StationXML must declare exactly one network.');
  const code=/\bcode="([^"]+)"/u.exec(network[0]!.tag);if(!code)throw new TypeError('StationXML network has no code.');
  const stations=pds4Elements(network[0]!.content,'Station');if(!stations.length)throw new TypeError('StationXML declares no station.');
  return stations.map(station=>{
    const identity=STATION_CODE.exec(station.tag);if(!identity)throw new TypeError('StationXML station has no code.');
    const header=station.content.replace(CHANNEL_BLOCK,'');
    return {NETWORK:code[1]!,STATION:identity[1]!,SITE_NAME:pds4Field(header,'Name'),
      LATITUDE:pds4Number(header,'Latitude','DEGREES'),LONGITUDE:pds4Number(header,'Longitude','DEGREES'),ELEVATION:pds4Number(header,'Elevation')};
  });
}

/** Archive pins for the one real station product this adapter is proven against. */
export const APOLLO_PSE_STATIONS={
  bundleId:'urn:nasa:pds:apollo_pse',
  productLid:'urn:nasa:pds:apollo_pse:data_table:stationxml.xa.0',
  bundleUrl:'https://pds-geosciences.wustl.edu/lunar/urn-nasa-pds-apollo_pse/',
  stationXmlUrl:'https://pds-geosciences.wustl.edu/lunar/urn-nasa-pds-apollo_pse/data/xa/metadata/stationxml.xa.0.sxml',
  labelUrl:'https://pds-geosciences.wustl.edu/lunar/urn-nasa-pds-apollo_pse/data/xa/metadata/stationxml.xa.0.xml',
  stationXmlSha256:'c712de6a38934ec4e82b08fefe8cc8cb10475c49c164ebc8ae2801f8caef88cb',
  labelSha256:'e96464245c87e9ce98d19691ad3081ed32240ca0ac941c79ebfc6d35d101cffe',
  frame:{kind:'body-fixed',name:'DE421 Mean Earth / Rotation Axis'},
  /** apollo_pse_description.pdf section 3.3.4 Coordinate Systems states the frame; StationXML itself never names one. */
  frameEvidence:'https://pds-geosciences.wustl.edu/lunar/urn-nasa-pds-apollo_pse/document/apollo_pse_description.pdf',
  /** FDSN StationXML defines Elevation in metres; the element carries no unit attribute, so the unit is the schema's. */
  elevationUnit:'m',
  elevationEvidence:'http://www.fdsn.org/xml/station/',
} as const;

/** Archive pins for the one real ray product this adapter is proven against. The frame is the archive's own words. */
export const CONSERT_67P_FSS_RANGING={
  dataSetId:'RO/RL-C-CONSERT-4-FSS-V1.0',
  datasetUrl:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/',
  frame:{kind:'body-fixed',name:'Comet Fixed Frame'},
  frameEvidence:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/catalog/dataset.cat',
  orbiter:{productId:'CN_G_O_FSSRNG_F',
    labelUrl:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/geometry/cn_g_o_fssrng_f.lbl',
    tableUrl:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/geometry/cn_g_o_fssrng_f.tab',
    labelSha256:'7575a78a7b9a7cca84f8f1e0549d1a113a02f77a69a93dc997ab29e1b2464d91',tableSha256:'5286b4985aa342abee7c3f3437334101293a79ccfefb4bde1235b1ad19d16b7c'},
  lander:{productId:'CN_G_L_FSSRNG_F',
    labelUrl:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/geometry/cn_g_l_fssrng_f.lbl',
    tableUrl:'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/geometry/cn_g_l_fssrng_f.tab',
    labelSha256:'2b972f28765e131a29de6c6e4f2d5a9d97c9c4a8f2381b7f031cda8dc3739636',tableSha256:'04fe8bc3adfd3441ee3ceb2ec97bd5f3b6e8717b8fa1c9d3fe7b208d91cae00f'},
  positionColumns:['UTC','SC_POS_X','SC_POS_Y','SC_POS_Z'] as const,
  /** The archive unit each position column states; `pds3GeometryUnit` maps it, it is never assumed. */
  positionArchiveUnit:'KILOMETER',
  /** Both tables round the same measurement instant to their own millisecond, so the checked pairing allows 1 ms. */
  pairingToleranceMs:1,
} as const;

export function describeSparsePlanetaryCoverage(input:SparsePlanetaryCoverageInput):ProductDescriptor{const inspection=inspectSparsePlanetaryCoverage(input),memberIds=[...new Set(input.samples.map(sample=>sample.memberId))],componentId='sparse-coverage',support={class:'observed-samples' as const,domain:{kind:domainFor[input.kind],description:input.coverageDescription,memberIds},unsupportedRegions:input.unsupportedRegions},observability={...input.observability,coverage:{...input.observability.coverage,memberIds:[...input.observability.coverage.memberIds]}};return descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'sparse coverage id'),target:input.target,acquisition:input.acquisition??{kind:'archive',identity:input.producingRecord},producingRecord:input.producingRecord,sourceClassifications:[{term:'exact sparse planetary coverage',vocabulary:'cssEarth telescope semantics',version:'1',status:'mapped'}],families:['F16'],profiles:[{handlerId:'f16-planetary-coverage',profileId:F16_PLANETARY_COVERAGE_PROFILE}]},members:input.members,components:[{id:componentId,name:`${input.target} exact ${input.kind} coverage`,families:['F16'],locations:input.scienceMemberIds.map(memberId=>({memberId})),representation:{kind:'physical-field',topology:'points',samples:inspection.samples},axes:[],columns:[{id:'sample-id',name:'sample id',role:'identity',datatype:'string',nullable:false,variableLength:false},{id:'geometry',name:'exact support geometry',role:'body-fixed-or-located-support',datatype:'structured',nullable:false,variableLength:false},{id:'native-coordinate',name:'native coordinate',role:'native-support-coordinate',datatype:'float64',nullable:true,variableLength:false}],quantity:{...input.quantity,semantics:`${input.quantity.semantics} Exact sparse ${input.kind} support only; no grid or volume is implied.`},calibration:input.calibration,flags:[],frame:input.frame,support,observability,dependencyIds:['exact-support-closure']}],dependencies:[{id:'exact-support-closure',role:'exact sample geometry and measurement-member closure',memberIds:[...new Set([...input.scienceMemberIds,...memberIds,...observability.coverage.memberIds])],componentIds:[componentId],requiredFor:['coverage-inspect','coverage-native-csv','coverage-json'],evidence:'Every emitted support sample retains its source member and declared body-fixed or located geometry.'}],issues:[{scope:'component',identity:componentId,state:'unsupported',reason:'Sparse tracks, rays, stations, and profiles are not gridded or volumetric support.'}]});}

const owner=(name:string)=>({module:'tools/objects/telescopes/families/f16-planetary-coverage.mts',export:name});
const operation=(id:string,label:string,componentId:string,available:boolean,reason:string,exported:string):FamilyOperation=>
  ({id,label,handlerId:'f16-planetary-coverage',componentId,owner:owner(exported),available,reason,fixedArguments:{},parameters:[{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:[...SPARSE_COVERAGE_LIMITATIONS]});
/** The only owner registered for a grid or volume output is the refusal, so the operation ledger states the refusal instead of hiding it. */
export const F16_PLANETARY_COVERAGE_HANDLER:FamilyHandler={
  id:'f16-planetary-coverage',families:['F16'],
  profiles:[{id:F16_PLANETARY_COVERAGE_PROFILE,format:'Exact sparse planetary support: archive tracks, body-fixed rays, located stations and profiles',version:'1',families:['F16'],
    evidence:[{path:'tools/objects/telescopes/families/f16-planetary-coverage.test.mts',establishes:'Real archive support geometry is retained sample for sample, and every grid, volume, material-property, interior-model and interpolation promotion is refused.',status:'complete'}]}],
  recognizes:()=>[],
  operations:product=>{
    const component=product.components.find(value=>value.id==='sparse-coverage');if(!component)return[];
    const kind=component.support?.domain.kind??'sparse';
    return [
      operation('coverage-inspect','Inspect exact sparse coverage',component.id,true,`Exact ${kind} support and its unsupported regions are retained.`,'inspectSparsePlanetaryCoverage'),
      operation('coverage-native-csv','Export exact sparse coverage samples',component.id,true,'Every sample keeps its source member, archive unit and native coordinate.','exportSparsePlanetaryCoverageCsv'),
      operation('coverage-json','Export exact sparse coverage geometry',component.id,true,'Support geometry and unsupported regions are exported together.','exportSparsePlanetaryCoverageJson'),
      ...REFUSED_PROMOTIONS.map(promotion=>operation(`coverage-${promotion}`,`Refused: ${promotion} from sparse coverage`,component.id,false,
        `Sparse planetary coverage cannot be promoted to a ${promotion}; retain exact support geometry or supply a separately qualified published reconstruction.`,'refuseSparseCoveragePromotion')),
    ];
  },
};
