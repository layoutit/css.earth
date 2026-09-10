import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Ida preserves its measured shape, all lenses, native raster triangles and physical context',()=>assertAsteroidPackage('ida',['normal','calibrated','elevation'],16000));
