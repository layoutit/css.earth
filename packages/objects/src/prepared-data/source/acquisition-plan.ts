import { ACQUISITION_PLAN_SCHEMA } from './source-schema-identifiers.js';

interface HriiFacets extends OperationBase {kind:'hrii-facets';path:string;recipePath:string;product:'fields'|'report';}
interface SpectralBandMaps extends OperationBase {kind:'spectral-band-maps';path:string;recipePath:string;product:string;}
interface MappedComposition extends OperationBase {kind:'mapped-composition';path:string;recipePath:string;product:string;}
interface GeoTiffGrid extends OperationBase {kind:'geotiff-grid'|'geotiff-image';path:string;recipePath:string;}
interface DskMesh extends OperationBase {kind:'dsk-mesh';path:string;recipe:Record<string,unknown>;}
interface OperationBase { groups:string[]; }
interface Download extends OperationBase {kind:'download';path:string;url:string;headers?:Record<string,string>;encoding?:'gzip'|'pretty-json';expectedJsonFields?:Record<string,unknown>;}
interface RequestDownload extends OperationBase {kind:'request-download';path:string;url:string;form:Record<string,string>;fileSource?:string;trimEnd?:boolean;appendText?:string;headers?:Record<string,string>;replacements?:{pattern:string;flags?:string;replacement:string}[];requiredPrefix?:string;requiredText?:string[];numericLineCount?:number;}
interface JsonDocument extends OperationBase {kind:'json-document';path:string;value:Record<string,unknown>;}
interface ZipMember extends OperationBase {kind:'zip-member';path:string;url:string;member:string;}
/** One member of a published .tar.gz deposit, streamed out by tar so the archive never has to fit in memory. */
interface TarGzMember extends OperationBase {kind:'tar-gz-member';path:string;url:string;member:string;}
interface SatelliteCatalog extends OperationBase {kind:'satellite-catalog';path:string;recipePath:string;headers?:Record<string,string>;}
interface VerifyDownload extends OperationBase {kind:'verify-download';url:string;}
interface Mosaic extends OperationBase {kind:'tile-mosaic';path:string;url:string;tileSize:number;columns:number;rows:number;dataWidth:number;dataHeight:number;width:number;height:number;forceRgb:boolean;concurrency:number;missingCoverage?:'transparent';}
interface RequestCheck extends OperationBase {kind:'verify-request';url:string;form:Record<string,string>;fileSource?:string;expectedPath:string;selector:'trim'|'numeric-lines'|'before-marker';marker?:string;rowCount?:number;headers?:Record<string,string>;}
interface JsonCheck extends OperationBase {kind:'verify-json';url:string;expectedPath:string;fields:Record<string,string>;}
/** A pinned JPL Horizons time-list table asked for again; Horizons dates each response, so its rows are compared, not its bytes. */
interface HorizonsTimeList extends OperationBase {kind:'horizons-time-list';path:string;url:string;parameters:Record<string,string>;epochs:number[];}
export type AcquisitionOperation=GeoTiffGrid|MappedComposition|SpectralBandMaps|HriiFacets|DskMesh|Download|RequestDownload|JsonDocument|ZipMember|TarGzMember|SatelliteCatalog|VerifyDownload|Mosaic|RequestCheck|JsonCheck|HorizonsTimeList;
export interface AcquisitionPlan {schema:typeof ACQUISITION_PLAN_SCHEMA;operations:AcquisitionOperation[];}

export interface AcquisitionValidationPolicy { containedPath(path: string): unknown; validateDskMeshRecipe(value: unknown): unknown }
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};
export function parseAcquisitionPlan(value:unknown, policy: AcquisitionValidationPolicy):AcquisitionPlan {
 // An empty plan is legal: a body whose every declared source input is already
 // tracked needs no reacquisition operation at all (e.g. eris, haumea, makemake).
 const plan=record(value);if(plan.schema!==ACQUISITION_PLAN_SCHEMA||!Array.isArray(plan.operations))throw new TypeError('Invalid acquisition plan.');
 for(const value of plan.operations){const step=record(value);if(!['geotiff-grid','geotiff-image','json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','satellite-catalog','zip-member','tar-gz-member'].includes(String(step.kind))&&(typeof step.url!=='string'||!/^https?:\/\//.test(step.url))||!Array.isArray(step.groups)||!step.groups.length||step.groups.some(group=>typeof group!=='string'))throw new TypeError('Acquisition URL or groups are missing.');
  if(!['geotiff-grid','geotiff-image','download','request-download','json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','zip-member','tar-gz-member','satellite-catalog','verify-download','tile-mosaic','verify-request','verify-json','horizons-time-list'].includes(String(step.kind)))throw new TypeError('Unknown acquisition operator.');
  for(const key of ['path','expectedPath','fileSource','recipePath','member'])if(step[key]!==undefined){if(typeof step[key]!=='string')throw new TypeError('Invalid acquisition path.');policy.containedPath(step[key]);}
  if(['geotiff-grid','geotiff-image','download','request-download','json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','zip-member','tar-gz-member','satellite-catalog','tile-mosaic','horizons-time-list'].includes(String(step.kind)))if(typeof step.path!=='string')throw new TypeError('Acquisition destination is missing.');
  if(step.kind==='horizons-time-list'){const parameters=record(step.parameters);if(Object.values(parameters).some(value=>typeof value!=='string')||'TLIST' in parameters||!Array.isArray(step.epochs)||!step.epochs.length||step.epochs.some(epoch=>typeof epoch!=='number'||!Number.isFinite(epoch)))throw new TypeError('Invalid Horizons time list.');}
  if(step.kind==='tar-gz-member'&&(typeof step.url!=='string'||!/^https:\/\//.test(step.url)||typeof step.member!=='string'||!/^[A-Za-z0-9_. /-]+$/.test(step.member)||step.member.startsWith('-')||step.member.split('/').includes('..')))throw new TypeError('Invalid tar.gz member.');
  if(step.kind==='zip-member'&&(typeof step.url!=='string'||!/^https:\/\//.test(step.url)||typeof step.member!=='string'||!/^[A-Za-z0-9_. /-]+$/.test(step.member)||step.member.startsWith('-')))throw new TypeError('Invalid ZIP member.');
  if(step.headers!==undefined){const headers=record(step.headers);if(Object.values(headers).some(value=>typeof value!=='string'))throw new TypeError('Acquisition headers must be text.');}
  if(step.kind==='request-download'||step.kind==='verify-request'){const form=record(step.form);if(Object.values(form).some(value=>typeof value!=='string'))throw new TypeError('Acquisition form values must be text.');}
  if(step.kind==='request-download'&&(step.trimEnd!==undefined&&typeof step.trimEnd!=='boolean'||step.appendText!==undefined&&typeof step.appendText!=='string'))throw new TypeError('Invalid response text transformation.');
  if(step.kind==='download'&&step.encoding!==undefined&&!['gzip','pretty-json'].includes(String(step.encoding)))throw new TypeError('Unknown source download encoding.');
  if(step.kind==='download'&&step.expectedJsonFields!==undefined)record(step.expectedJsonFields);
  if(step.kind==='request-download'&&(step.requiredPrefix!==undefined&&typeof step.requiredPrefix!=='string'||step.requiredText!==undefined&&(!Array.isArray(step.requiredText)||step.requiredText.some(value=>typeof value!=='string'))||step.numericLineCount!==undefined&&(!Number.isSafeInteger(step.numericLineCount)||Number(step.numericLineCount)<1)))throw new TypeError('Invalid source response checks.');
  if(step.kind==='request-download'&&step.replacements!==undefined){if(!Array.isArray(step.replacements))throw new TypeError('Response replacements must be an array.');for(const value of step.replacements){const replacement=record(value);if(typeof replacement.pattern!=='string'||typeof replacement.replacement!=='string'||replacement.flags!==undefined&&(typeof replacement.flags!=='string'||!/^[gimu]*$/.test(replacement.flags)))throw new TypeError('Invalid response text replacement.');new RegExp(replacement.pattern,replacement.flags as string|undefined);}}
  if(step.kind==='json-document')record(step.value);
  if(step.kind==='hrii-facets'&&(typeof step.recipePath!=='string'||!['fields','report'].includes(String(step.product))))throw new TypeError('Invalid HRII facet acquisition.');
  if(['geotiff-grid','geotiff-image'].includes(String(step.kind))&&typeof step.recipePath!=='string')throw new TypeError('GeoTIFF grid recipe is missing.');
  if(['spectral-band-maps','mapped-composition'].includes(String(step.kind))&&(typeof step.recipePath!=='string'||typeof step.product!=='string'||!/^[a-z][a-z0-9-]*$/.test(step.product)))throw new TypeError('Invalid numeric-map acquisition.');
  if(step.kind==='dsk-mesh')policy.validateDskMeshRecipe(step.recipe);
  if(step.kind==='satellite-catalog'&&typeof step.recipePath!=='string')throw new TypeError('Satellite catalog recipe is missing.');
  if(step.kind==='tile-mosaic')for(const key of ['tileSize','columns','rows','dataWidth','dataHeight','width','height','concurrency'])if(typeof step[key]!=='number'||!Number.isSafeInteger(step[key])||step[key]<=0)throw new TypeError(`Invalid mosaic ${key}.`);
  if(step.kind==='tile-mosaic'&&step.missingCoverage!==undefined&&(step.missingCoverage!=='transparent'||step.dataWidth!==step.width||step.dataHeight!==step.height))throw new TypeError(`${String(step.path)}: missingCoverage must be "transparent" and needs the mosaic kept at its data size, not ${String(step.missingCoverage)} at ${String(step.dataWidth)}x${String(step.dataHeight)} to ${String(step.width)}x${String(step.height)}.`);
  if(step.kind==='verify-request'){record(step.form);if(typeof step.expectedPath!=='string'||!['trim','numeric-lines','before-marker'].includes(String(step.selector)))throw new TypeError('Invalid source response comparator.');if(step.selector==='before-marker'&&typeof step.marker!=='string')throw new TypeError('Source marker is missing.');}
  if(step.kind==='verify-json')record(step.fields);
 }
 return plan as unknown as AcquisitionPlan;
}
