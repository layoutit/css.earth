export type {GetSfInput} from '@cssearth/nebula-reconstruction/methods/getsf/prepare';
import {prepareGetSfBenchmark as prepare,type GetSfInput} from '@cssearth/nebula-reconstruction/methods/getsf/prepare';
import {encodeFits} from '@cssearth/fits/node';
import {float32LittleEndian} from '../float32-little-endian.ts';
export function prepareGetSfBenchmark(options:GetSfInput){return prepare(options,{encodeFits,float32LittleEndian},'SMASH display-image structure benchmark');}
