import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Transvaalia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("transvaalia", ['shape', 'elevation'], 12729.0));
