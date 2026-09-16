export type {GetSfInput} from '@cssearth/nebula-reconstruction/methods/getsf/prepare';
import {prepareGetSfBenchmark as prepare,type GetSfInput} from '@cssearth/nebula-reconstruction/methods/getsf/prepare';
import {encodeFits,float32LittleEndian} from '../../../adapters/application/fits.ts';
export function prepareGetSfBenchmark(options:GetSfInput){return prepare(options,{encodeFits,float32LittleEndian},'SMASH display-image structure benchmark');}
