/** Receipt credit comes from actual captures and is bound to native profile and declared observations. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signature, validateQualificationBatch } from '../qualification.mts';
import { parseTrace, json } from './trace.mts';
import { profiles } from './profiles.mts';
const journey = { id: 'fixture', exercises: ['control:a'], async run() {} };
const summary = { passed: true, repeat: 10, profile: 'chromium-desktop', signature: signature(journey), observed: ['control:a'], combinations: [] };
const capture = () => parseTrace({ schema: 'cssearth-journey@1', journey: 'fixture', profile: 'chromium-desktop', toolchain: { profile: profiles['chromium-desktop'] }, exercises: ['control:a'], observed: ['control:a'], combinations: [], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
test('qualified receipt rejects a claimed ID absent in a capture, a wrong profile and errors', () => {
  const actual = Array.from({ length: 10 }, capture);
  assert.deepEqual(validateQualificationBatch(journey, 'chromium-desktop', summary, actual).observed, ['control:a']);
  for (const mutation of ['observation', 'native-profile', 'label', 'error'] as const) {
    const changed = structuredClone(actual);
    if (mutation === 'observation') changed[9]!.observed = [];
    if (mutation === 'native-profile') changed[9]!.toolchain = json({ profile: profiles['webkit-desktop']! });
    if (mutation === 'label') changed[9]!.profile = 'webkit-desktop';
    if (mutation === 'error') changed[9]!.observations.errors.push({ sequence: 0, step: 'direct', data: { source: 'pageerror', message: 'stable error' } });
    assert.throws(() => validateQualificationBatch(journey, 'chromium-desktop', summary, changed));
  }
  assert.throws(() => validateQualificationBatch(journey, 'chromium-desktop', { ...summary, observed: ['control:a', 'handler:invented'] }, actual), /summary differs/u);
  assert.throws(() => validateQualificationBatch(journey, 'chromium-desktop', { ...summary, profile: 'webkit-desktop' }, actual), /Missing exact/u);
  assert.throws(() => validateQualificationBatch(journey, 'chromium-desktop', summary, actual.slice(1)), /ten-capture/u);
});
