import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Panopaea retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('panopaea',['shape','elevation'],64000));
