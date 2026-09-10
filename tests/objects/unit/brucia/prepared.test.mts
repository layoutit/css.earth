import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Brucia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("brucia", ['shape', 'elevation'], 18645.0));
