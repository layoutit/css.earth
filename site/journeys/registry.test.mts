/** Qualification, declared exercises and coverage are enforced without a browser or build. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signature } from './qualification.mts';
import { representatives } from './representatives.journey.mts';
import { journeys, selectJourneys, type RegisteredJourney } from './registry.mts';
import { coverage, coverageGate, manifestIds, parseManifest, parseUnreachable, unreachableIds, validateExercises } from './manifest.mts';
test('defaults are qualified-only and gates refuse experimental pairs', () => {
  for (const profile of ['chromium-desktop', 'webkit-desktop']) {
    const qualified = journeys.filter(journey => journey.status[profile] === 'qualified');
    if (qualified.length) assert.deepEqual(selectJourneys(profile), qualified);
    else assert.throws(() => selectJourneys(profile), /No qualified/u);
    assert.throws(() => selectJourneys(profile, 'dione-warm-cache', true), /experimental/u);
  }
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

test('coverage requirement turns red when an exercise is deleted, or its pair loses qualification', () => {
  const fixture = { id: 'fixture', exercises: ['control:a', 'handler:b', 'capability:c'], status: { profile: 'qualified' as const }, async run() {} };
  const ids = [...fixture.exercises];
  const proof = [{ journey: fixture.id, profile: 'profile', signature: signature(fixture), observed: ids, captures: 40, evidence: 'output/fixture' }];
  assert.equal(coverageGate([fixture], ids, [], undefined, proof).passed, true);
  for (const deleted of ids) {
    const result = coverageGate([{ ...fixture, exercises: ids.filter(id => id !== deleted) }], ids, [], undefined, [{ ...proof[0]!, signature: signature({ ...fixture, exercises: ids.filter(id => id !== deleted) }), observed: ids.filter(id => id !== deleted) }]);
    assert.equal(result.passed, false); assert.deepEqual(result.missing, [deleted]);
  }
  assert.equal(coverageGate([{ ...fixture, status: { profile: 'experimental' } }], ids, []).passed, false);
});
test('exemptions refuse unknown ids and qualified overlap, including other profiles', async () => {
  const fixture = { id: 'fixture', exercises: ['control:a'], status: { other: 'qualified' as const }, async run() {} };
  assert.throws(() => coverageGate([], ['control:a'], [{ id: 'control:unknown', reason: 'Unknown' }]), /Unknown unreachable/u);
  assert.throws(() => coverageGate([fixture], ['control:a'], [{ id: 'control:a', reason: 'Reached' }], 'profile', [{ journey: fixture.id, profile: 'other', signature: signature(fixture), observed: ['control:a'], captures: 40, evidence: 'output/fixture' }]), /reaches exempt/u);
  assert.equal(coverageGate([], ['control:a'], [{ id: 'control:a', reason: 'Reviewed' }]).passed, true);
  assert.throws(() => parseUnreachable([{ id: 'control:a', reason: '' }]), /one-line/u);
  assert.throws(() => parseUnreachable([{ id: 'control:a', reason: 'two\nlines' }]), /one-line/u);
  assert.throws(() => parseUnreachable([{ id: 'control:a', reason: 'OK', extra: true }]), /one-line/u);
  assert.throws(() => parseUnreachable([{ id: 'control:a', reason: 'OK' }, { id: 'control:a', reason: 'OK' }]), /Duplicate/u);
  const exemptions = await unreachableIds();
  assert.deepEqual(exemptions.map(entry => entry.id), ['capability:ipad-import-queue']);
  const result = coverageGate(journeys.filter(journey => !representatives.some(row => row.id === journey.id)), await manifestIds(), exemptions);
  assert.equal(result.missing.length, Object.values(result.report).reduce((sum, row) => sum + row.unreached.length, 0) - 1);
});

test('all ten additional S0 representatives are registered with real settings and dataset actions', () => {
  const ids = representatives.map(row => row.id);
  assert.deepEqual(ids, ['lmc', 'neptune-system', 'beta-pictoris-system', 'asteroid-2001-sn263-system',
    'mars-system', 'observable-universe', 'abell-1689', 'centaurus-cluster', 'great-attractor', 'local-group']);
  assert.equal(new Set(ids).size, 10);
  for (const id of ids) {
    const journey = journeys.find(row => row.id === id);
    assert.ok(journey);
    assert.ok(journey.exercises.includes('control:site:components:ObjectShell:button:markup:4'));
    assert.ok(journey.exercises.includes('control:site:components:DatasetList:button:markup:1'));
  }
});

test('deleting an exercise from a real qualified journey turns its focused gate red', () => {
  const original = journeys.find(row => row.id === 'milky-way');
  assert.ok(original);
  const journey: RegisteredJourney = { ...original, status: { 'chromium-desktop': 'qualified' } };
  const ids = [...journey.exercises];
  const proof = [{ journey: journey.id, profile: 'chromium-desktop', signature: signature(journey), observed: ids, captures: 40, evidence: 'output/fixture' }];
  assert.equal(coverageGate([journey], ids, [], undefined, proof).passed, true);
  for (const deleted of ids) {
    const mutated: RegisteredJourney = { ...journey, exercises: journey.exercises.filter(id => id !== deleted) };
    assert.equal(coverageGate([mutated], ids, [], undefined, [{ ...proof[0]!, signature: signature(mutated), observed: mutated.exercises }]).passed, false);
    assert.deepEqual(coverageGate([mutated], ids, [], undefined, [{ ...proof[0]!, signature: signature(mutated), observed: mutated.exercises }]).missing, [deleted]);
  }
});

test('proposed unreachable entries never affect the gate until the owner reviews them', () => {
  const proposal = { id: 'handler:unreached', reason: 'No permitted native path', evidence: 'Exact source and native probe evidence' };
  const parsed = parseUnreachable({ reviewed: [], proposed: [proposal] });
  assert.deepEqual(parsed, []);
  assert.equal(coverageGate([], [proposal.id], parsed, undefined, []).passed, false);
  assert.equal(coverageGate([], [proposal.id], parseUnreachable({ reviewed: [proposal], proposed: [] }), undefined, []).passed, true);
  assert.throws(() => parseUnreachable({ reviewed: [{ ...proposal, evidence: '' }], proposed: [] }), /Invalid unreachable/u);
  assert.throws(() => parseUnreachable({ reviewed: [], proposed: [{ id: proposal.id, reason: proposal.reason }] }), /exact evidence/u);
});
