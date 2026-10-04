import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { PitchCalibration } from '@cssearth/core';

const fixture: PitchCalibration = {
  defaultControlPitchDegrees: 0, maximumControlPitchDegrees: 90,
  initialScenePitchDegrees: 0, maximumScenePitchDegrees: 90,
};
test('core owns the only pitch calibration definition; entry re-exports preserve consumers', () => {
  assert.equal(fixture.maximumScenePitchDegrees, 90);
  const files = ['pitch-calibration.ts', '../../engine/src/navigation/math-types.ts',
    '../../objects/src/prepared-data/runtime-camera-types.ts'];
  const sources = files.map(file => readFileSync(new URL(file, import.meta.url), 'utf8'));
  assert.equal(sources.filter(source => /(?:interface|type) PitchCalibration\s*(?:\{|=)/u.test(source)).length, 1);
  assert.match(sources[0], /export interface PitchCalibration/u);
  for (const source of sources.slice(1)) assert.match(source, /export type \{ PitchCalibration \} from '@cssearth\/core'/u);
});
