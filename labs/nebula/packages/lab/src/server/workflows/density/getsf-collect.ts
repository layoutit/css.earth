import {collectGetSfBenchmark as collect} from '@cssearth/nebula-reconstruction/methods/getsf/collect';
import {decodeFits,float32LittleEndian} from '../../../adapters/application/fits.ts';
export function collectGetSfBenchmark(options:Parameters<typeof collect>[0]){return collect(options,{decodeFits,float32LittleEndian},process.cwd());}
