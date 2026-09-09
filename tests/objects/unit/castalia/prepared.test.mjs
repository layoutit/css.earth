import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Castalia retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('castalia',['shape','elevation'],542.2379999999999));
