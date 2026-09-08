import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Eunomia retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('eunomia',['shape','elevation'],135000));
