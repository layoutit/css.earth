import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redClumpDistanceKpc, unambiguousMatch, validateRedClumpCalibration } from './red-clump-distance.ts';
const calibration = { referenceDistanceKpc: 61, referenceMagnitude: 17.304, extinctionPerReddening: 0.443 };
test('explicit reference and negative reddening floor preserve published calculation', () => {
    assert.equal(redClumpDistanceKpc(17.304, 0, calibration), 61);
    assert.equal(redClumpDistanceKpc(17.304, -0.1, calibration), 61);
    assert.ok(Math.abs(redClumpDistanceKpc(17.304 + 0.443 * 0.2, 0.2, calibration) - 61) < 1e-10);
    assert.ok(Math.abs(redClumpDistanceKpc(22.304, 0, calibration) - 610) < 1e-9);
    for (const ks of [16, 17.304, 19]) for (const e of [-0.1, 0, 0.15, 1])
        assert.equal(redClumpDistanceKpc(ks, e, calibration), 61 * 10 ** ((ks - 0.443 * Math.max(0, e) - 17.304) / 5));
});
test('calibration is required, validated and controls the reference distance', () => {
    const other = { referenceDistanceKpc: 12, referenceMagnitude: 11, extinctionPerReddening: 0.2 };
    assert.equal(redClumpDistanceKpc(11, 0, other), 12);
    for (const invalid of [undefined, null, {}, { ...other, referenceDistanceKpc: 0 }, { ...other, referenceMagnitude: NaN }, { ...other, extinctionPerReddening: -1 }]) assert.throws(() => validateRedClumpCalibration(invalid));
    assert.throws(() => redClumpDistanceKpc(11, 0, { ...other, referenceDistanceKpc: Infinity }));
});
test('reject invalid photometry and ambiguous/outside matches', () => {
    assert.throws(() => redClumpDistanceKpc(NaN, 0, calibration));
    assert.throws(() => redClumpDistanceKpc(17, Infinity, calibration));
    assert.throws(() => redClumpDistanceKpc(-1, 0, calibration));
    assert.equal(unambiguousMatch(.1, .12), false);
    assert.equal(unambiguousMatch(.51, Infinity), false);
    assert.equal(unambiguousMatch(.1, .2), true);
    assert.equal(unambiguousMatch(.1, Infinity), true);
});
