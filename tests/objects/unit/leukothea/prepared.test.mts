import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Leukothea retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("leukothea", ['shape', 'elevation'], 55740.0));
