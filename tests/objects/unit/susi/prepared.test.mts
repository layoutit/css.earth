import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Susi retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("susi", ['shape', 'elevation'], 10910.0));
