import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Interamnia retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('interamnia',['shape','elevation'],166000));
