import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Veritas retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("veritas", ['shape', 'elevation'], 59401.5));
