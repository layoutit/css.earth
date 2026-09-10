import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Hidalgo retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("hidalgo", ['shape', 'elevation'], 30700.0));
