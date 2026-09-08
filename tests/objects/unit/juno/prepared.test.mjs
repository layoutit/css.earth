import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Juno retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('juno',['shape','elevation'],127000));
