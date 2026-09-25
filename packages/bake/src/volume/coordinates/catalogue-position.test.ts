import { test } from 'vitest';
import assert from 'node:assert/strict';
import { cataloguePosition, METERS_PER_KPC } from './catalogue-position.ts';
import type { DensityVolumeFrame } from '../contracts/volume-frame.ts';
const frame: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    originM: [10 * METERS_PER_KPC, 0, 0], metersPerUnit: METERS_PER_KPC,
    localToReferenceXyzw: [0, 0, 0, 1], boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
test('measured distance and sky direction determine physical positions without rescaling', () => {
    assert.deepEqual(cataloguePosition(0, 0, 10, frame), [0, 0, 0]);
    assert.ok(Math.abs(cataloguePosition(0, 0, 12, frame)[0] - 2) < 1e-12);
    const p = cataloguePosition(90, 0, 12, frame);
    assert.ok(Math.abs(p[0] + 10) < 1e-12 && Math.abs(p[1] - 12) < 1e-12);
});
test('inverse frame orientation preserves distance and handedness', () => {
    const p = cataloguePosition(0, 0, 12, { ...frame, localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] });
    assert.ok(Math.abs(p[0]) < 1e-12 && Math.abs(p[1] + 2) < 1e-12);
});
test('rejects missing distances, invalid sky coordinates and non-unit frames', () => {
    for (const d of [0, -1, NaN])
        assert.throws(() => cataloguePosition(0, 0, d, frame));
    assert.throws(() => cataloguePosition(0, 91, 1, frame));
    assert.throws(() => cataloguePosition(360, 0, 1, frame));
    assert.throws(() => cataloguePosition(0, 0, 1, { ...frame, localToReferenceXyzw: [0, 0, 0, 2] }));
});
test('observed angular scale follows distance, not the chosen image dimensions', () => {
    const near = cataloguePosition(1, 0, 10, frame), far = cataloguePosition(1, 0, 20, frame);
    assert.ok(Math.abs(far[1] / near[1] - 2) < 1e-12);
    // Both are the same sky ray when viewed from the observer at local x=-10.
    assert.ok(Math.abs(near[1] / (near[0] + 10) - far[1] / (far[0] + 10)) < 1e-12);
});
