import {collectGetSfBenchmark as collect} from '@cssearth/nebula-reconstruction/methods/getsf/collect';
import {decodeFits} from '@cssearth/fits';
import {float32LittleEndian} from '../float32-little-endian.ts';
export function collectGetSfBenchmark(options:Parameters<typeof collect>[0]){return collect(options,{decodeFits,float32LittleEndian},process.cwd());}
