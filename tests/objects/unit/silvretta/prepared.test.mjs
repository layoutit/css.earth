import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Silvretta retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("silvretta", ['shape', 'elevation'], 13196.5));
