import type {FitsHeader} from '@cssearth/fits';
export type BandName='WISE3'|'WISE4'|'MIPS24'|'MIPS70';
export interface IrBand {name:BandName;data:Float32Array;variance:Float32Array;validity:Uint8Array;coarseData?:Float32Array;coarseVariance?:Float32Array;coarseValidity?:Uint8Array}
export interface IrCube {width:number;height:number;header:FitsHeader;bands:IrBand[];fcoarse:Float32Array;NHprior:Float32Array;Ustar0:Float32Array;Ustar1:Float32Array;heatingNodes?:{weights:number[];layers:[Float32Array[],Float32Array[]]}}
export interface ColumnResult {NH:Float32Array;validity:Uint8Array;metadata:Record<string,unknown>}
