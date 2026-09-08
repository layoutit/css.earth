import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Educatio retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("educatio", ['shape', 'elevation'], 3293.0));
