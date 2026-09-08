import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Psyche retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('psyche',['shape','elevation'],111500));
