import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('666 Desdemona retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('desdemona-666',['shape','elevation'],14200));
