import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("1999 FR33 retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("asteroid-1999-fr33", ['shape', 'elevation'], 2877.0));
