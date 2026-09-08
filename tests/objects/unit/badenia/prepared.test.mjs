import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Badenia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("badenia", ['shape', 'elevation'], 34865.0));
