import test from 'node:test';
import { checkShape } from '../centaur-shape-contract.mjs';
test('Bienor prepared triangles preserve the independent occultation ellipsoid', () => checkShape('bienor'));
