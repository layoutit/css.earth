/** Every placed star's rotation record is the sky-plane orientation computed from its own star record, never a hand-typed
 * number: a star without a measured axis has its display axis on sky north (position angle 0); a star with a measured
 * position angle (Betelgeuse's ALMA axis) has that angle, and in both the display meridian turns longitude 0 to the Earth. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { directionFromRaDec, skyBasis, skyPlaneOrientation } from '@cssearth/astronomy';
import { isRecord, requireFiniteNumber, requireRecord } from '../sources/source-values.mts';

const root = resolve(import.meta.dirname, '../..');
const DEGREE = Math.PI / 180;

test('each placed star rotation record is the sky-plane orientation of its star record', async () => {
  const stars: string[] = [];
  for (const file of (await readdir(resolve(root, 'packages/astronomy/data/bodies'))).sort()) {
    const record = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', file), 'utf8')) as unknown);
    if (!isRecord(record.star)) continue;
    const id = String(record.id), star = { rightAscensionDegrees: requireFiniteNumber(record.star.rightAscensionDegrees), declinationDegrees: requireFiniteNumber(record.star.declinationDegrees) };
    const rotation = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', id, 'source/preparation/rotation.json'), 'utf8')) as unknown);
    const pole = directionFromRaDec(requireFiniteNumber(rotation.rightAscensionDegrees), requireFiniteNumber(rotation.declinationDegrees));
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees);
    const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
    assert.ok(Math.abs(dot(pole, directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees))) < 1e-9, `${id}: the axis lies in the plane of the sky`);
    const positionAngle = Math.atan2(dot(pole, east), dot(pole, north)) / DEGREE;
    if (rotation.schema === 'cssearth-display-orientation@1') assert.ok(Math.abs(positionAngle) < 1e-6, `${id}: an unmeasured axis is sky north, got position angle ${positionAngle}`);
    const expected = skyPlaneOrientation(star, positionAngle);
    const wrap = (degrees: number) => ((degrees + 540) % 360) - 180;
    assert.ok(Math.abs(wrap(expected.rightAscensionDegrees - requireFiniteNumber(rotation.rightAscensionDegrees))) < 1e-6, `${id}: right ascension ${rotation.rightAscensionDegrees}, expected ${expected.rightAscensionDegrees}`);
    assert.ok(Math.abs(expected.declinationDegrees - requireFiniteNumber(rotation.declinationDegrees)) < 1e-6, `${id}: declination ${rotation.declinationDegrees}, expected ${expected.declinationDegrees}`);
    assert.ok(Math.abs(wrap(expected.displayMeridianDegrees - requireFiniteNumber(rotation.displayMeridianDegrees))) < 1e-5, `${id}: display meridian ${rotation.displayMeridianDegrees}, expected ${expected.displayMeridianDegrees}`);
    stars.push(id);
  }
  assert.ok(stars.length >= 4, `placed stars checked: ${stars.join(', ')}`);
});
