import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('itokawa preserves its measured shape, lenses, native raster triangles and physical context',()=>assertAsteroidPackage('itokawa',["amica","elevation"],165));
