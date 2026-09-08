import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Sylvia retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('sylvia',['shape','elevation'],137000));
