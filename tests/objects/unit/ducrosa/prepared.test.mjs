import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Ducrosa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("ducrosa", ['shape', 'elevation'], 17050.0));
