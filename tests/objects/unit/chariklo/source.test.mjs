import test from 'node:test';
import { checkShape } from '../../../../docs/centaur-population/check-shape.mjs';
test('Chariklo prepared triangles and rings preserve independent occultation constraints', () => checkShape('chariklo'));
