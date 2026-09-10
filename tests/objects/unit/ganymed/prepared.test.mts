import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Ganymed retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('ganymed',['shape','elevation'],19500));
