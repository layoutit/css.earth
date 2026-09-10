import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Schorria retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("schorria", ['shape', 'elevation'], 2775.0));
