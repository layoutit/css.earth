import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Irene retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('irene',['shape','elevation'],76500));
