import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { llorriFieldTargets, requireLlorriTarget } from './llorri-geo.mts';

test('a L\'LORRI camera may name any body its frame lists in the field of view, and no other', () => {
  assert.deepEqual(llorriFieldTargets({ TRGFOVN: 1, TRGFOV1: "'DONALDJOHANSON'" }), ['DONALDJOHANSON']);
  assert.deepEqual(llorriFieldTargets({ TRGFOVN: 2, TRGFOV1: "'DINKINESH'", TRGFOV2: "'SELAM'" }), ['DINKINESH', 'SELAM']);
  assert.equal(requireLlorriTarget({ TRGFOVN: 2, TRGFOV1: "'DINKINESH'", TRGFOV2: "'SELAM'" }, 'SELAM'), 'SELAM');
  assert.throws(() => requireLlorriTarget({ TRGFOVN: 1, TRGFOV1: "'DINKINESH'" }, 'DONALDJOHANSON'), /not in the frame's field of view \(DINKINESH\)/);
  assert.throws(() => llorriFieldTargets({ TRGFOVN: 0 }), /no field-of-view target/);
  assert.throws(() => llorriFieldTargets({ TRGFOV1: "'DINKINESH'" }), /no field-of-view target/);
  assert.throws(() => llorriFieldTargets({ TRGFOVN: 2, TRGFOV1: "'DINKINESH'" }), /missing TRGFOV2/);
});
