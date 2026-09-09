import test from 'node:test';
import { checkShape } from '../../../../docs/centaur-population/check-shape.mjs';
test('Bienor prepared triangles preserve the independent occultation ellipsoid', () => checkShape('bienor'));
