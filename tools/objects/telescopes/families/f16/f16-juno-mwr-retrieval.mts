/**
 * PDS3 `JNO-J-MWR-5-NH3-DISTRIBUTION-V1.0` (volume JNOMWR_2100) paired abundance
 * and 1-sigma uncertainty spreadsheets. The reader retains the archive retrieval
 * on its native pressure and planetocentric-latitude coordinates. It performs no
 * radiative-transfer inversion, no resampling, and no pressure-to-altitude
 * conversion. Every accepted fact comes from the pinned PDS3 label, the pinned
 * `^STRUCTURE` format file, or the pinned table bytes.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { sha256File } from '@cssearth/core/node';
import { basename, resolve } from 'node:path';
import { pds3Values } from '@cssearth/telescope';
import { fileSize } from '@cssearth/telescope/node';
import type { FamilyHandler, FamilyOperation } from '../../family-handlers.mts';
import type { AxisDescriptor, DescriptorIssue, DescriptorMember, ProductComponent, ProductDescriptor, UncertaintyDescriptor } from '../../product-descriptor.mts';
import { assertPlanetaryProductSemantics, planetaryOutputPolicy } from '../../planetary-depth-policy.mts';
import { JUNO_MWR_NH3_F16_PROFILE } from '../../observation-families.mts';
import { descriptor, stable } from '../common.mts';

/** Archive landing pages for facts that live in the volume rather than in a pinned file. */
export const JUNO_MWR_VOLUME_URL='https://atmos.nmsu.edu/PDS/data/jnomwr_2100/';
export const JUNO_MWR_NH3_CATALOGUE_URL='https://atmos.nmsu.edu/PDS/data/jnomwr_2100/CATALOG/DATASET_NH3_DISTRIBUTION.CAT';
/** `DATASET_NH3_DISTRIBUTION.CAT`, Processing: the retrieval algorithm is the archived LI_ETAL_2017 document. */
export const JUNO_MWR_ALGORITHM_DOCUMENT='https://atmos.nmsu.edu/PDS/data/jnomwr_2100/DOCUMENT/LI_ETAL_2017.pdf';

export type JunoMwrSpecies='NH3'|'H2O';
export type JunoMwrRole='abundance'|'uncertainty';
const ROLE_LETTER:Record<JunoMwrRole,'A'|'U'>={abundance:'A',uncertainty:'U'};
const DATA_SET_ID=/^JNO-J-MWR-5-(NH3|H2O)-DISTRIBUTION-V\d+\.\d+$/u;
/** Field 1, from the format file: `NAME = pressure_bar`, `DESCRIPTION = "Pressure levels (bar)"`. */
const PRESSURE_FIELD_NAME='pressure_bar';
const PRESSURE_DESCRIPTION=/^Pressure levels \(([A-Za-z]+)\)$/u;
/** Fields 2..N state the species, whether the column is the 1-sigma uncertainty, and the planetocentric latitude. */
const COLUMN_DESCRIPTION=/^(Ammonia|Water) abundance(?: (1) sigma uncertainty)? at planetocentric latitude ([+-]\d+(?:\.\d+)?) degree$/u;
/** Field names carry the same latitude as their description; only the sign is spelled N or S. */
const COLUMN_NAME_LATITUDE=/_lat_(\d+(?:\.\d+)?)([NS])$/u;
/** Table header cells 2..N, from the pinned spreadsheet's own first record. */
const HEADER_LATITUDE=/^PC_lat([+-]\d+(?:\.\d+)?)$/u;
const SPECIES_DESCRIPTION:Record<JunoMwrSpecies,'Ammonia'|'Water'>={NH3:'Ammonia',H2O:'Water'};

export interface JunoMwrTableInput {
  /** Spreadsheet file name; the label's `PRODUCT_ID`, `^HEADER` and `^SPREADSHEET` must all name it. */
  readonly tableName:string; readonly table:Uint8Array;
  readonly label:Uint8Array;
  /** Format file name; the label's `^STRUCTURE` must name it. */
  readonly formatName:string; readonly format:Uint8Array;
}
export interface JunoMwrRetrievalInput {readonly abundance:JunoMwrTableInput;readonly uncertainty:JunoMwrTableInput}
export interface JunoMwrTableIdentity {
  readonly role:JunoMwrRole; readonly dataSetId:string; readonly productId:string; readonly productType:string;
  readonly species:JunoMwrSpecies; readonly structure:string; readonly md5:string;
  readonly rows:number; readonly fields:number; readonly recordBytes:number; readonly fileRecords:number;
  readonly startTime:string; readonly stopTime:string; readonly clockStart:string; readonly clockStop:string;
}
export interface JunoMwrTable {
  readonly identity:JunoMwrTableIdentity; readonly pressureUnit:string;
  readonly pressureBars:readonly number[]; readonly latitudeDegrees:readonly number[];
  /** Row-major `[pressure][latitude]`, exactly as the spreadsheet stores it. */
  readonly values:readonly (readonly number[])[]; readonly minimum:number; readonly maximum:number;
  /** Format-file field names whose species prefix does not match `PRODUCT_TYPE`; the archive NH3U file has 18. */
  readonly misnamedFields:readonly string[];
}
export interface JunoMwrRetrieval {
  readonly species:JunoMwrSpecies; readonly abundance:JunoMwrTable; readonly uncertainty:JunoMwrTable;
  readonly pressureBars:readonly number[]; readonly latitudeDegrees:readonly number[];
}

const text=(bytes:Uint8Array)=>Buffer.from(bytes).toString('latin1');
const md5=(bytes:Uint8Array)=>createHash('md5').update(bytes).digest('hex');

function keyword(label:string,key:string,scope:readonly string[],context:string):string{
  const found=pds3Values(label,key,scope);
  if(!found||found.length!==1)throw new TypeError(`${context} label needs exactly one ${key}.`);
  return found[0]!;
}
function equals(actual:string,expected:string,key:string,context:string):string{
  if(actual!==expected)throw new TypeError(`${context} label ${key} must be ${expected}, not ${actual}.`);
  return actual;
}
function whole(value:string,key:string,context:string):number{
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<1)throw new TypeError(`${context} label ${key} must be a positive whole number.`);
  return number;
}
function finite(value:string,context:string):number{
  const number=Number(value);
  if(value===''||!Number.isFinite(number))throw new TypeError(`${context} must be a finite number, not ${JSON.stringify(value)}.`);
  return number;
}
function increasing(values:readonly number[],context:string):readonly number[]{
  if(values.some((value,index)=>index>0&&value<=values[index-1]!))throw new TypeError(`${context} must increase strictly, as the archive dataset catalogue states.`);
  return values;
}
/** The label's pointer values are `("<file>", <record-or-offset>)`. */
function pointer(label:string,key:string,context:string):readonly [string,string]{
  const found=pds3Values(label,key,[]);
  if(!found||found.length!==2)throw new TypeError(`${context} label needs a two-element ${key} pointer.`);
  return [found[0]!,found[1]!];
}

/** One `OBJECT = FIELD` scope per declared spreadsheet column, read with the shared PDS3 owner. */
function formatFields(format:string,context:string):readonly {readonly name:string;readonly description:string;readonly dataType:string;readonly number:number}[]{
  return [...format.matchAll(/OBJECT\s*=\s*FIELD[\s\S]*?END_OBJECT[^\r\n]*/giu)].map(match=>{
    const block=match[0];
    return {name:keyword(block,'NAME',['FIELD'],context),description:keyword(block,'DESCRIPTION',['FIELD'],context),
      dataType:keyword(block,'DATA_TYPE',['FIELD'],context),number:whole(keyword(block,'FIELD_NUMBER',['FIELD'],context),'FIELD_NUMBER',context)};
  });
}

/** Split the spreadsheet into comma-delimited records. `FIELD_DELIMITER = "COMMA"` with `ASCII_REAL` fields leaves no quoting to honour. */
function records(table:Uint8Array,fields:number,context:string):readonly (readonly string[])[] {
  const body=text(table);
  if(body.includes('"')||body.includes("'"))throw new TypeError(`${context} spreadsheet must not contain quoted text.`);
  const lines=body.replace(/(?:\r\n|\n)$/u,'').split(/\r\n|\n/u);
  return lines.map((line,index)=>{
    const row=line.split(',').map(cell=>cell.trim());
    if(row.length!==fields)throw new TypeError(`${context} spreadsheet record ${index+1} has ${row.length} fields, not the declared ${fields}.`);
    return row;
  });
}

/** Read one pinned label, format file, and spreadsheet into the archive grid it declares. */
export function inspectJunoMwrTable(input:JunoMwrTableInput,role:JunoMwrRole):JunoMwrTable{
  const context=`Juno MWR ${role}`,label=text(input.label),letter=ROLE_LETTER[role];
  equals(keyword(label,'PDS_VERSION_ID',[],context),'PDS3','PDS_VERSION_ID',context);
  const dataSetId=keyword(label,'DATA_SET_ID',[],context),matched=DATA_SET_ID.exec(dataSetId);
  if(!matched)throw new TypeError(`${context} label DATA_SET_ID ${dataSetId} is not a Juno MWR level-5 distribution dataset.`);
  const species=matched[1] as JunoMwrSpecies,productType=`${species}${letter}`;
  equals(keyword(label,'PRODUCT_TYPE',[],context),productType,'PRODUCT_TYPE',context);
  equals(keyword(label,'STANDARD_DATA_PRODUCT_ID',[],context),productType,'STANDARD_DATA_PRODUCT_ID',context);
  equals(keyword(label,'INSTRUMENT_HOST_ID',[],context),'JNO','INSTRUMENT_HOST_ID',context);
  equals(keyword(label,'INSTRUMENT_ID',[],context),'MWR','INSTRUMENT_ID',context);
  equals(keyword(label,'TARGET_NAME',[],context),'JUPITER','TARGET_NAME',context);
  equals(keyword(label,'PROCESSING_LEVEL_ID',[],context),'5','PROCESSING_LEVEL_ID',context);
  equals(keyword(label,'RECORD_TYPE',[],context),'STREAM','RECORD_TYPE',context);
  const productId=equals(keyword(label,'PRODUCT_ID',[],context),basename(input.tableName),'PRODUCT_ID',context);
  for(const key of ['^HEADER','^SPREADSHEET'] as const)equals(pointer(label,key,context)[0],productId,`${key} file`,context);
  const recordBytes=whole(keyword(label,'RECORD_BYTES',[],context),'RECORD_BYTES',context),fileRecords=whole(keyword(label,'FILE_RECORDS',[],context),'FILE_RECORDS',context);
  equals(keyword(label,'BYTES',['HEADER'],context),String(recordBytes),'HEADER BYTES',context);
  equals(pointer(label,'^SPREADSHEET',context)[1],`${recordBytes+1}<BYTES>`,'^SPREADSHEET offset',context);
  const declaredMd5=keyword(label,'MD5_CHECKSUM',[],context),actualMd5=md5(input.table);
  if(declaredMd5.toLowerCase()!==actualMd5)throw new TypeError(`${context} spreadsheet MD5 ${actualMd5} does not match the label MD5_CHECKSUM ${declaredMd5}.`);
  equals(keyword(label,'FIELD_DELIMITER',['SPREADSHEET'],context),'COMMA','FIELD_DELIMITER',context);
  equals(keyword(label,'^STRUCTURE',['SPREADSHEET'],context),basename(input.formatName),'^STRUCTURE',context);
  const rows=whole(keyword(label,'ROWS',['SPREADSHEET'],context),'ROWS',context),fields=whole(keyword(label,'FIELDS',['SPREADSHEET'],context),'FIELDS',context);
  if(fields<2)throw new TypeError(`${context} label declares ${fields} fields; a pressure column and at least one latitude column are required.`);
  if(fileRecords!==rows+1)throw new TypeError(`${context} label FILE_RECORDS ${fileRecords} is not the declared ${rows} rows plus the one header record.`);

  const declared=formatFields(text(input.format),context);
  if(declared.length!==fields)throw new TypeError(`${context} format file declares ${declared.length} fields, not the label's ${fields}.`);
  if(declared.some((field,index)=>field.number!==index+1))throw new TypeError(`${context} format file FIELD_NUMBER values are not 1..${fields} in order.`);
  if(declared.some(field=>field.dataType!=='ASCII_REAL'))throw new TypeError(`${context} format file must declare every field as ASCII_REAL.`);
  const pressureField=declared[0]!;
  equals(pressureField.name,PRESSURE_FIELD_NAME,'format field 1 NAME',context);
  const pressureDescription=PRESSURE_DESCRIPTION.exec(pressureField.description);
  if(!pressureDescription)throw new TypeError(`${context} format field 1 must state its pressure unit, not ${JSON.stringify(pressureField.description)}.`);
  const pressureUnit=pressureDescription[1]!,misnamedFields:string[]=[];
  const formatLatitudes=declared.slice(1).map(field=>{
    const description=COLUMN_DESCRIPTION.exec(field.description);
    if(!description)throw new TypeError(`${context} format field ${field.number} description ${JSON.stringify(field.description)} does not state a planetocentric-latitude ${role} column.`);
    if(description[1]!==SPECIES_DESCRIPTION[species])throw new TypeError(`${context} format field ${field.number} describes ${description[1]}, not the dataset's ${SPECIES_DESCRIPTION[species]}.`);
    if((description[2]!==undefined)!==(role==='uncertainty'))throw new TypeError(`${context} format field ${field.number} must${role==='uncertainty'?'':' not'} state a 1 sigma uncertainty.`);
    const degrees=finite(description[3]!,`${context} format field ${field.number} latitude`);
    // The archive NH3U format names fields 21..38 `MH3U_...`; the column's own description and number stay correct.
    if(!field.name.startsWith(`${productType}_`))misnamedFields.push(field.name);
    const suffix=COLUMN_NAME_LATITUDE.exec(field.name);
    if(!suffix)throw new TypeError(`${context} format field ${field.number} name ${field.name} does not carry its latitude.`);
    const named=(suffix[2]==='S'?-1:1)*finite(suffix[1]!,`${context} format field ${field.number} name latitude`);
    if(named!==degrees)throw new TypeError(`${context} format field ${field.number} name states ${named} degrees and its description states ${degrees}.`);
    return degrees;
  });
  increasing(formatLatitudes,`${context} format latitudes`);

  const rowsRead=records(input.table,fields,context);
  if(rowsRead.length!==fileRecords)throw new TypeError(`${context} spreadsheet holds ${rowsRead.length} records, not the declared ${fileRecords}.`);
  const header=rowsRead[0]!;
  equals(header[0]!,PRESSURE_FIELD_NAME,'spreadsheet header field 1',context);
  const latitudeDegrees=header.slice(1).map((cell,index)=>{
    const matchedHeader=HEADER_LATITUDE.exec(cell);
    if(!matchedHeader)throw new TypeError(`${context} spreadsheet header cell ${index+2} ${JSON.stringify(cell)} is not a planetocentric-latitude column.`);
    const degrees=finite(matchedHeader[1]!,`${context} spreadsheet header latitude ${index+2}`);
    if(degrees!==formatLatitudes[index])throw new TypeError(`${context} spreadsheet header latitude ${degrees} does not match the format file's ${formatLatitudes[index]}.`);
    return degrees;
  });
  const pressureBars=increasing(rowsRead.slice(1).map((row,index)=>{
    const value=finite(row[0]!,`${context} pressure row ${index+1}`);
    if(value<=0)throw new TypeError(`${context} pressure row ${index+1} must be positive.`);
    return value;
  }),`${context} pressures`);
  const values=rowsRead.slice(1).map((row,rowIndex)=>row.slice(1).map((cell,columnIndex)=>{
    const value=finite(cell,`${context} value at row ${rowIndex+1}, column ${columnIndex+2}`);
    if(value<0)throw new TypeError(`${context} value at row ${rowIndex+1}, column ${columnIndex+2} is negative; a mixing ratio and its uncertainty cannot be.`);
    return value;
  }));
  const flat=values.flat();
  return {identity:{role,dataSetId,productId,productType,species,structure:basename(input.formatName),md5:actualMd5,rows,fields,recordBytes,fileRecords,
      startTime:keyword(label,'START_TIME',[],context),stopTime:keyword(label,'STOP_TIME',[],context),
      clockStart:keyword(label,'SPACECRAFT_CLOCK_START_COUNT',[],context),clockStop:keyword(label,'SPACECRAFT_CLOCK_STOP_COUNT',[],context)},
    pressureUnit,pressureBars,latitudeDegrees,values,minimum:Math.min(...flat),maximum:Math.max(...flat),misnamedFields};
}

/** Read the archive pair and prove it is one grid: same dataset, same interval, same coordinates, cell for cell. */
export function inspectJunoMwrRetrieval(input:JunoMwrRetrievalInput):JunoMwrRetrieval{
  const abundance=inspectJunoMwrTable(input.abundance,'abundance'),uncertainty=inspectJunoMwrTable(input.uncertainty,'uncertainty');
  const same=<T,>(left:T,right:T,label:string)=>{if(left!==right)throw new TypeError(`Juno MWR abundance and uncertainty ${label} differ: ${String(left)} and ${String(right)}.`);};
  same(abundance.identity.species,uncertainty.identity.species,'species');
  same(abundance.identity.dataSetId,uncertainty.identity.dataSetId,'DATA_SET_ID');
  same(abundance.identity.startTime,uncertainty.identity.startTime,'START_TIME');
  same(abundance.identity.stopTime,uncertainty.identity.stopTime,'STOP_TIME');
  same(abundance.identity.clockStart,uncertainty.identity.clockStart,'SPACECRAFT_CLOCK_START_COUNT');
  same(abundance.identity.clockStop,uncertainty.identity.clockStop,'SPACECRAFT_CLOCK_STOP_COUNT');
  same(abundance.pressureUnit,uncertainty.pressureUnit,'pressure unit');
  if(abundance.identity.productId===uncertainty.identity.productId)throw new TypeError('Juno MWR abundance and uncertainty name the same PRODUCT_ID.');
  const pair=(left:readonly number[],right:readonly number[],label:string)=>{
    if(left.length!==right.length||left.some((value,index)=>value!==right[index]))throw new TypeError(`Juno MWR paired ${label} coordinates differ.`);
    return left;
  };
  const pressureBars=pair(abundance.pressureBars,uncertainty.pressureBars,'pressure'),latitudeDegrees=pair(abundance.latitudeDegrees,uncertainty.latitudeDegrees,'latitude');
  if(abundance.values.some((row,index)=>row.length!==uncertainty.values[index]!.length))throw new TypeError('Juno MWR paired tables do not cover the same cells.');
  return {species:abundance.identity.species,abundance,uncertainty,pressureBars,latitudeDegrees};
}

export interface JunoMwrRetrievalMembers {
  readonly abundance:DescriptorMember; readonly uncertainty:DescriptorMember;
  readonly abundanceLabel:DescriptorMember; readonly uncertaintyLabel:DescriptorMember;
  readonly abundanceFormat:DescriptorMember; readonly uncertaintyFormat:DescriptorMember;
}

/** Publish the retained pair. Pressure stays pressure and the uncertainty stays paired to its abundance. */
export function describeJunoMwrRetrieval(input:{readonly id:string;readonly retrieval:JunoMwrRetrieval;readonly members:JunoMwrRetrievalMembers;readonly producingRecord:string}):ProductDescriptor{
  const {retrieval,members}=input,{species}=retrieval,samples=retrieval.pressureBars.length*retrieval.latitudeDegrees.length;
  const labelMembers=[members.abundanceLabel.id,members.uncertaintyLabel.id],formatMembers=[members.abundanceFormat.id,members.uncertaintyFormat.id];
  const dataMembers=[members.abundance.id,members.uncertainty.id],allMembers=[...dataMembers,...labelMembers,...formatMembers];
  const table=(role:JunoMwrRole)=>role==='abundance'?retrieval.abundance:retrieval.uncertainty;
  const dataMember=(role:JunoMwrRole)=>role==='abundance'?members.abundance:members.uncertainty;
  const formatMember=(role:JunoMwrRole)=>role==='abundance'?members.abundanceFormat:members.uncertaintyFormat;

  const axes=(role:JunoMwrRole):readonly AxisDescriptor[]=>[
    {id:'pressure',index:0,length:retrieval.pressureBars.length,role:'pressure',physicalType:'pressure',unit:table(role).pressureUnit,
      coordinates:{kind:'lookup',memberId:dataMember(role).id,locator:'Spreadsheet field 1 (pressure_bar), one value per data record',binBounds:false},
      frame:'Archive pressure levels',reference:`Retrieval pressure levels in ${table(role).pressureUnit}, from format field 1`,
      derivation:{state:'reconstruction-derived',assumptions:['The pressure levels are the archive retrieval\'s own vertical grid; they are not converted to altitude or radius.']}},
    {id:'latitude',index:1,length:retrieval.latitudeDegrees.length,role:'latitude',physicalType:'angle',unit:'deg',
      coordinates:{kind:'lookup',memberId:dataMember(role).id,locator:'Spreadsheet header record fields 2..N (PC_lat<signed degrees>)',binBounds:false},
      frame:'Jupiter planetocentric latitude',reference:'Planetocentric latitude in degrees, stated by every format field description',
      derivation:{state:'archive-derived',assumptions:[`The dataset catalogue states the recorded planetocentric latitude is determined with SPICE: ${JUNO_MWR_NH3_CATALOGUE_URL}`]}},
  ];

  const component=(role:JunoMwrRole,uncertainty:UncertaintyDescriptor):ProductComponent=>({
    id:role,name:`${species} ${role==='abundance'?'abundance':'abundance 1-sigma uncertainty'}`,families:['F16'],
    locations:[{memberId:dataMember(role).id,structure:table(role).identity.structure}],
    representation:{kind:'physical-field',topology:'grid',samples},axes:axes(role),columns:[],
    quantity:{name:`${species} ${role==='abundance'?'abundance':'abundance standard uncertainty'}`,unit:'1',
      semantics:`Archive-published ${species} ${role==='abundance'?'abundance':'1-sigma abundance uncertainty'} on the retained pressure and planetocentric-latitude grid of ${table(role).identity.productId}. The label and format file state no unit; the archive's cited retrieval algorithm reports volume mixing ratios, so the values are carried as dimensionless. Retained range ${table(role).minimum} to ${table(role).maximum}.`},
    calibration:{state:'reconstructed',basis:[`PDS3 ${table(role).identity.dataSetId}, PROCESSING_LEVEL_ID 5; the archive retrieval is retained, not reproduced.`,
      `Label MD5_CHECKSUM ${table(role).identity.md5} verified against the pinned spreadsheet bytes.`]},
    uncertainty,flags:[],
    time:{scale:'UTC',format:'PDS3 START_TIME and STOP_TIME',referenceEpoch:table(role).identity.startTime,
      exposure:`Archived interval ${table(role).identity.startTime} to ${table(role).identity.stopTime}. The dataset catalogue describes a nonaccumulating dataset derived from high-rate perijove data, not one exposure.`},
    frame:{kind:'planetocentric-pressure',name:'Jupiter planetocentric latitude and archive pressure levels'},
    support:{class:'published-reconstruction',
      domain:{kind:'full-grid',description:`Every one of the ${samples} declared pressure and planetocentric-latitude cells carries a finite value in both pinned spreadsheets. The archive publishes no longitude coordinate and no cell beyond ${retrieval.latitudeDegrees[0]} to ${retrieval.latitudeDegrees.at(-1)} degrees or ${retrieval.pressureBars[0]} to ${retrieval.pressureBars.at(-1)} ${table(role).pressureUnit}.`,memberIds:dataMembers},
      unsupportedRegions:[]},
    depth:{coordinate:'pressure',positiveDirection:'down',
      datum:`Archive pressure levels in ${table(role).pressureUnit}; the product supplies no altitude, radius, or hydrostatic model.`,
      conversion:{state:'native',parameters:[],uncertainty:'Pressure is retained natively. No geometric-depth mapping is supplied, so none is published.'}},
    observability:{measurementOperator:'microwave-radiative-transfer',
      coverage:{kind:'profiles',description:`One archive-published pressure profile per stated planetocentric latitude; the format file names all ${retrieval.latitudeDegrees.length} of them. Per-channel microwave support stays in the antenna- and brightness-temperature datasets of the same volume, not in this product.`,memberIds:formatMembers},
      localization:'inversion-dependent'},
    sampling:{axes:[
      {axisId:'pressure',kind:'irregular',memberId:dataMember(role).id,basis:'Pressure levels read from spreadsheet field 1. The archive spacing is geometric in pressure; this is sampling, not retrieval resolution.'},
      {axisId:'latitude',kind:'irregular',memberId:formatMember(role).id,basis:'Planetocentric latitudes read from the format field descriptions and the spreadsheet header. This is sampling, not retrieval resolution.'}]},
    resolution:{state:'unknown',elements:[],
      basis:`The dataset catalogue leaves Parameters, Data Coverage and Quality, and the Confidence Level Overview at TBD, so no retrieval resolution is stated: ${JUNO_MWR_NH3_CATALOGUE_URL}`,memberIds:[]},
    inference:{kind:'archive-published',
      method:`${table(role).identity.dataSetId} derived ${table(role).identity.productType} product. The dataset catalogue names the archived LI_ETAL_2017 document as the algorithm: ${JUNO_MWR_ALGORITHM_DOCUMENT}`,
      assumptions:['The archive grid is retained exactly as supplied; no cell is interpolated, resampled, or filled.',
        'Pressure is retained as pressure; it is not converted to altitude, radius, or a body attachment.',
        'The abundance unit is not stated by the label or format file. It is carried as dimensionless because the archive\'s cited algorithm document reports volume mixing ratios.',
        'Brightness temperature, channel identity, and observing geometry are not in this product and are not inferred from it.'],
      validation:`Label PDS_VERSION_ID, DATA_SET_ID, PRODUCT_TYPE, STANDARD_DATA_PRODUCT_ID, instrument, target and processing level; PRODUCT_ID, ^HEADER, ^SPREADSHEET and ^STRUCTURE pointer closure; RECORD_BYTES against the HEADER object and the ^SPREADSHEET offset; FILE_RECORDS against ROWS plus one header record; MD5_CHECKSUM against the spreadsheet bytes; FIELDS against the format file's field count, order and ASCII_REAL types; every format field description read for species, 1-sigma role and planetocentric latitude, cross-checked against the field name and the spreadsheet header; strictly increasing pressures and latitudes, as the dataset catalogue states (${JUNO_MWR_NH3_CATALOGUE_URL}); finite nonnegative values; and identical dataset, interval, clock counts and coordinates across the pair.`,
      memberIds:[...labelMembers,...formatMembers]},
    dependencyIds:['paired-retrieval-closure']});

  const issues:DescriptorIssue[]=[
    {scope:'component',identity:'abundance',state:'missing',
      reason:`Neither the PDS3 label nor ${retrieval.abundance.identity.structure} states a unit for the abundance columns, and the dataset catalogue's Parameters section reads TBD. The values are carried as dimensionless on the strength of the cited algorithm document's volume mixing ratios (${JUNO_MWR_ALGORITHM_DOCUMENT}); that unit is inferred, not archived.`},
    {scope:'component',identity:'abundance',state:'unknown',
      reason:`The dataset catalogue leaves the Confidence Level Overview and Data Coverage and Quality at TBD and records no known limitations, so the archive supplies no per-cell quality flag, retrieval-support mask, or resolution for this grid: ${JUNO_MWR_NH3_CATALOGUE_URL}`},
    ...(retrieval.uncertainty.misnamedFields.length?[{scope:'member' as const,identity:members.uncertaintyFormat.id,state:'conflicting' as const,
      reason:`${retrieval.uncertainty.identity.structure} names ${retrieval.uncertainty.misnamedFields.length} of its ${retrieval.uncertainty.identity.fields-1} latitude fields with a species prefix that is not ${retrieval.uncertainty.identity.productType} (for example ${retrieval.uncertainty.misnamedFields[0]}). Columns are taken from FIELD_NUMBER and DESCRIPTION, which stay consistent with the spreadsheet header.`}]:[]),
    ...(retrieval.abundance.misnamedFields.length?[{scope:'member' as const,identity:members.abundanceFormat.id,state:'conflicting' as const,
      reason:`${retrieval.abundance.identity.structure} names ${retrieval.abundance.misnamedFields.length} of its latitude fields with a species prefix that is not ${retrieval.abundance.identity.productType} (for example ${retrieval.abundance.misnamedFields[0]}).`}]:[]),
  ];

  const value=descriptor({schema:'cssearth-telescope-product-descriptor@1',
    dataset:{id:stable(input.id,'Juno MWR retrieval id'),target:'jupiter',
      acquisition:{kind:'archive',identity:retrieval.abundance.identity.dataSetId},producingRecord:input.producingRecord,
      sourceClassifications:[{term:`Juno Jupiter MWR ${species} distribution, derived abundance and 1-sigma uncertainty on pressure levels`,
        vocabulary:'NASA PDS3 DATA_SET_ID',version:retrieval.abundance.identity.dataSetId,status:'source'}],
      families:['F16'],profiles:[{handlerId:'f16-juno-mwr-retrieval',profileId:JUNO_MWR_NH3_F16_PROFILE}]},
    members:[members.abundance,members.uncertainty,members.abundanceLabel,members.uncertaintyLabel,members.abundanceFormat,members.uncertaintyFormat],
    components:[
      component('abundance',{form:'standard-deviation',componentId:'uncertainty',
        basis:`Paired ${retrieval.uncertainty.identity.productId}; ${retrieval.uncertainty.identity.structure} states every column is the 1 sigma uncertainty of the matching abundance column.`}),
      component('uncertainty',{form:'none-supplied',basis:'The archive supplies no uncertainty of the uncertainty table.'}),
    ],
    dependencies:[{id:'paired-retrieval-closure',
      role:'Paired PDS3 labels, format files, native spreadsheet coordinates, and archive retrieval identity',
      memberIds:allMembers,componentIds:['abundance','uncertainty'],
      requiredFor:['juno-mwr-retrieval-inspect','juno-mwr-retrieval-native'],
      evidence:`${retrieval.abundance.identity.dataSetId}; ${retrieval.abundance.identity.productId} MD5 ${retrieval.abundance.identity.md5}; ${retrieval.uncertainty.identity.productId} MD5 ${retrieval.uncertainty.identity.md5}; ${JUNO_MWR_VOLUME_URL}`}],
    issues});
  for(const published of value.components)assertPlanetaryProductSemantics(published);
  return value;
}

export interface PinnedJunoMwrFile {readonly path:string}
/** Copy the archive files unchanged into a new directory, measuring every one. */
export async function exportJunoMwrRetrievalNative(pins:readonly PinnedJunoMwrFile[],output:string):Promise<readonly {readonly path:string;readonly bytes:number;readonly sha256:string}[]>{
  if(!pins.length)throw new TypeError('Native Juno MWR export needs the pinned archive files.');
  const directory=resolve(output);await mkdir(directory,{recursive:true});
  const written:{path:string;bytes:number;sha256:string}[]=[];
  for(const pin of pins){
    const actual=await sha256File(pin.path);
    const destination=resolve(directory,basename(pin.path));
    if(written.some(entry=>entry.path===destination))throw new TypeError(`Native Juno MWR export would overwrite ${basename(pin.path)}.`);
    await copyFile(pin.path,destination);written.push({path:destination,...actual});
  }
  return written;
}

const OUT={id:'out',option:'--out',kind:'output-directory' as const,required:true,description:'New output directory.'};
const operation=(id:'juno-mwr-retrieval-inspect'|'juno-mwr-retrieval-native',label:string,componentId:string,available:boolean,reason:string):FamilyOperation=>({
  id,label,handlerId:'f16-juno-mwr-retrieval',componentId,
  owner:{module:'tools/objects/telescopes/families/f16/f16-juno-mwr-retrieval.mts',export:id==='juno-mwr-retrieval-inspect'?'inspectJunoMwrRetrieval':'exportJunoMwrRetrievalNative'},
  available,reason,fixedArguments:{},parameters:[OUT],
  limitations:['No radiative-transfer inversion, resampling, interpolation, pressure-to-altitude conversion, body attachment, or longitude structure is produced.',
    'Coordinate spacing is sampling; the archive states no retrieval resolution.']});

export const F16_JUNO_MWR_RETRIEVAL_HANDLER:FamilyHandler={id:'f16-juno-mwr-retrieval',families:['F16'],
  profiles:[{id:JUNO_MWR_NH3_F16_PROFILE,format:'Paired PDS3 Juno MWR level-5 distribution labels, format files, and abundance/uncertainty spreadsheets',
    version:'JNO-J-MWR-5-NH3-DISTRIBUTION-V1.0',families:['F16'],
    evidence:[{path:'tools/objects/telescopes/families/f16/f16-juno-mwr-retrieval.test.mts',
      establishes:'Label, format-file and spreadsheet closure on synthetic archive-shaped bytes, published descriptor semantics, output policy, and refusal of broken pointers, checksums, coordinates and roles.',status:'complete'}]}],
  recognizes:members=>members.some(member=>/MWR(?:NH3|H2O)A[^/\\]*\.LBL$/iu.test(member.path))&&members.some(member=>/MWR(?:NH3|H2O)U[^/\\]*\.LBL$/iu.test(member.path))?[JUNO_MWR_NH3_F16_PROFILE]:[],
  operations:product=>product.components.filter(component=>component.families.includes('F16')&&(component.id==='abundance'||component.id==='uncertainty')).flatMap(component=>{
    const native=planetaryOutputPolicy(component).find(verdict=>verdict.output==='native')!;
    return [operation('juno-mwr-retrieval-inspect',`Inspect the paired archive ${component.id} grid`,component.id,native.available,native.reason),
      operation('juno-mwr-retrieval-native','Export the native paired archive tables',component.id,native.available,native.reason)];
  })};
