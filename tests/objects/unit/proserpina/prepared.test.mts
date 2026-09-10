import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Proserpina retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("proserpina", ['shape', 'elevation'], 43725.0));
