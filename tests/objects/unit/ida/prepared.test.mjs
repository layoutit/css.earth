import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Ida preserves its measured shape, both lenses, native raster triangles and physical context',()=>assertAsteroidPackage('ida',['normal','elevation'],16000));
