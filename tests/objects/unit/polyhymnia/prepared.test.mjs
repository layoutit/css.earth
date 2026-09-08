import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Polyhymnia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("polyhymnia", ['shape', 'elevation'], 26990.0));
