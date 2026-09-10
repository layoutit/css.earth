import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Betulia retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('betulia',['shape','elevation'],2695));
