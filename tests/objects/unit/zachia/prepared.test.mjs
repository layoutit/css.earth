import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Zachia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("zachia", ['shape', 'elevation'], 8424.0));
