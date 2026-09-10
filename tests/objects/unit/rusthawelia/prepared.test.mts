import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Rusthawelia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("rusthawelia", ['shape', 'elevation'], 33993.0));
