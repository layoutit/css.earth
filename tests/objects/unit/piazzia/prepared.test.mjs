import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Piazzia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("piazzia", ['shape', 'elevation'], 23890.0));
