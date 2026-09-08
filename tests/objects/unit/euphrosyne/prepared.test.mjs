import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Euphrosyne retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('euphrosyne',['shape','elevation'],134000));
