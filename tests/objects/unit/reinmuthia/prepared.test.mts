import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Reinmuthia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("reinmuthia", ['shape', 'elevation'], 12190.0));
