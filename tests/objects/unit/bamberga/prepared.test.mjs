import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Bamberga retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('bamberga',['shape','elevation'],113500));
