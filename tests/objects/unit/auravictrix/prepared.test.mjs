import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Auravictrix retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("auravictrix", ['shape', 'elevation'], 8210.5));
