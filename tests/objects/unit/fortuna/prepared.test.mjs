import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Fortuna retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('fortuna',['shape','elevation'],105500));
