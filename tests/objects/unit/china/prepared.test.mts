import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("China retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("china", ['shape', 'elevation'], 13042.0));
