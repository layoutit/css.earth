import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Victoria retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('victoria',['shape','elevation'],58000));
