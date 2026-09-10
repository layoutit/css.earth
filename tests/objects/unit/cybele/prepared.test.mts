import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Cybele retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('cybele',['shape','elevation'],156500));
