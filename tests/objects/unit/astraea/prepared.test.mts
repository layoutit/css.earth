import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Astraea retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('astraea',['shape','elevation'],56000));
