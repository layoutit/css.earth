import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('ryugu preserves its measured shape, lenses, native raster triangles and physical context',()=>assertAsteroidPackage('ryugu',["normal","enhanced","elevation"],448));
