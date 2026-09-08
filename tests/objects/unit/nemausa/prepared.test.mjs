import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Nemausa retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('nemausa',['shape','elevation'],75000));
