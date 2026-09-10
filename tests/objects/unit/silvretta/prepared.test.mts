import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Silvretta retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("silvretta", ['shape', 'elevation'], 13196.5));
