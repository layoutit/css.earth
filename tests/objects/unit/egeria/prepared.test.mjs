import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Egeria retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('egeria',['shape','elevation'],101000));
