import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('9 Metis retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('metis-9',['shape','elevation'],86500));
