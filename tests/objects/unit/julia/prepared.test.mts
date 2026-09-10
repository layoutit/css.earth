import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Julia retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('julia',['shape','elevation'],70000));
