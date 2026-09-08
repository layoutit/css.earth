import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Schaber retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("schaber", ['shape', 'elevation'], 13269.0));
