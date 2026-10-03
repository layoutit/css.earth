import { ACQUISITION_PLAN_SCHEMA } from './source-schema-identifiers.ts';

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
