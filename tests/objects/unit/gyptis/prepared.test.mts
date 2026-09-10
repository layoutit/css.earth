import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Gyptis retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("gyptis", ['shape', 'elevation'], 83015.0));
