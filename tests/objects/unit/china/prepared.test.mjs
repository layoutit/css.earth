import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("China retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("china", ['shape', 'elevation'], 13042.0));
