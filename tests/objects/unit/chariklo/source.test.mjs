import test from 'node:test';
import { checkShape } from '../centaur-shape-contract.mjs';
test('Chariklo prepared triangles and rings preserve independent occultation constraints', () => checkShape('chariklo'));
