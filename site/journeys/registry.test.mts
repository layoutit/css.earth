/** Qualification, declared exercises and coverage are enforced without a browser or build. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journeys, selectJourneys } from './registry.mts';
import { coverage, manifestIds, parseManifest, validateExercises } from './manifest.mts';
test('defaults are qualified-only and gates refuse experimental pairs', () => {
  for (const profile of ['chromium-desktop', 'webkit-desktop']) {
    assert.ok(selectJourneys(profile).length >= 8);
    assert.ok(selectJourneys(profile).every(journey => journey.status[profile] === 'qualified'));
    assert.equal(journeys.find(journey => journey.id === 'dione-navigation')?.status[profile], 'experimental');
  }
  assert.throws(() => selectJourneys('webkit-desktop', 'dione-navigation', true), /experimental/u);
  assert.throws(() => selectJourneys('chromium-desktop', 'unknown'), /Unknown/u);
  assert.throws(() => selectJourneys('tablet', undefined, true), /No qualified/u);
});
test('all exercises resolve against the preserved 319 manifest ids', async () => {
  const ids = await manifestIds(); assert.equal(ids.length, 319); validateExercises(journeys, ids);
  assert.throws(() => validateExercises([{ id: 'invalid', exercises: ['control:invented'] }], ids), /unknown manifest/u);
  assert.throws(() => parseManifest({ schema: 'plan7-s0-w2-manifest@1', ids: ['control:a', 'control:a'] }), /Duplicate/u);
});
test('coverage never credits an experimental journey', () => {
  const report = coverage([{ id: 'fixture', exercises: ['control:a'], status: { profile: 'experimental' }, async run() {} }], ['control:a'], 'profile');
  assert.deepEqual(report.control, { reached: [], unreached: ['control:a'] });
});
