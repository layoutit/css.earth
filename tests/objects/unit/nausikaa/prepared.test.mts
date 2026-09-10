import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Nausikaa retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('nausikaa',['shape','elevation'],47000));
