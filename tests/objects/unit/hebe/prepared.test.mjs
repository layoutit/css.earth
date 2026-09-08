import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Hebe retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('hebe',['shape','elevation'],97500));
