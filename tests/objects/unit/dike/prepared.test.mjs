import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Dike retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("dike", ['shape', 'elevation'], 33250.0));
