import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('eros preserves its measured shape, lenses, native raster triangles and physical context',()=>assertAsteroidPackage('eros',["normal","infrared","elevation"],8420));
