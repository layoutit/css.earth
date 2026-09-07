import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('itokawa preserves its measured shape, lenses, native raster triangles and physical context',()=>assertAsteroidPackage('itokawa',["elevation"],165));
