import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Hermione retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('hermione',['shape','elevation'],100000));
