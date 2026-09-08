import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Alphonsina retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('alphonsina',['shape','elevation'],29000));
