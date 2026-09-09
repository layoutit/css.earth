import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('bennu preserves its measured shape, lenses, native raster triangles and physical context',()=>assertAsteroidPackage('bennu',["normal","surface","spectral","elevation"],241));
