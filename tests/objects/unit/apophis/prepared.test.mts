import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Apophis retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('apophis',['shape','elevation'],170));
