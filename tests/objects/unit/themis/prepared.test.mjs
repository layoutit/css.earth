import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Themis retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('themis',['shape','elevation'],104000));
