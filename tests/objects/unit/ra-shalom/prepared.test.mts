import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Ra-Shalom retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('ra-shalom',['shape','elevation'],1150));
