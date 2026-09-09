import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Doris retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('doris',['shape','elevation'],105000));
