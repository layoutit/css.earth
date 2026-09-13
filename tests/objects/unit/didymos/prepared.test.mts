import { test } from 'node:test';
import { assertAsteroidPackage } from '../asteroid-contract.mts';

test('Didymos retains shape, registered DRACO photography, elevation and relative albedo on 800 raster triangles', () =>
  assertAsteroidPackage('didymos', ['shape', 'draco', 'elevation', 'albedo'], 365));
