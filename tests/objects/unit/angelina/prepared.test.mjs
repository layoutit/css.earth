import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Angelina retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('angelina',['shape','elevation'],26000));
