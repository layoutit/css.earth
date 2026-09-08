import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Bertha retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("bertha", ['shape', 'elevation'], 92915.0));
