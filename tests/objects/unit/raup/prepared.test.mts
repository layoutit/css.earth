import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Raup retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("raup", ['shape', 'elevation'], 2419.5));
