import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Astraea retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('astraea',['shape','elevation'],56000));
