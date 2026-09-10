import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Sappho retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('sappho',['shape','elevation'],30500));
