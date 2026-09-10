import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Piazzia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("piazzia", ['shape', 'elevation'], 23890.0));
