import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { evaluatePublishedOrbit, loadBodyEpochEphemeris } from '../../packages/astronomy/tools/body-epoch-ephemeris.mts';
import { parsePublishedParameters } from '../../packages/astronomy/tools/lib/ephemeris-records.mts';
import { requireArray, requireRecord } from '../sources/source-values.mts';

const projectRoot = resolve(import.meta.dirname, '../..');
const identities = [
  { bodyId: 'hiiaka', centerBodyId: 'haumea', target: 120136108, center: 920136108, radiusRange: [50000, 55000] },
  { bodyId: 'menoetius', centerBodyId: 'patroclus', target: 120000617, center: 920000617, radiusRange: [680, 705] },
];
const epochJdTt = 2461286.5;
type ReceiptMutation = (record: Record<string, unknown>) => void;
const required = <T,>(value: T | undefined, label: string): T => { if (value === undefined) throw new TypeError(`${label} is missing.`); return value; };
const parent = (state: Awaited<ReturnType<typeof loadBodyEpochEphemeris>>) => required(state.parentHeliocentricState, 'parent heliocentric state');
const recordAt = (value: Record<string, unknown>, ...keys: string[]): Record<string, unknown> => keys.reduce<Record<string, unknown>>((current, key) => requireRecord(current[key], key), value);
const arrayAt = (value: Record<string, unknown>, ...keys: string[]): unknown[] => {
  const last = required(keys.at(-1), 'array path');
  const parent = keys.slice(0, -1).reduce<Record<string, unknown>>((current, key) => requireRecord(current[key], key), value);
  return requireArray(parent[last], last);
};
const validation = (state: Awaited<ReturnType<typeof loadBodyEpochEphemeris>>): Record<string, unknown> => recordAt(requireRecord(state.provenance, 'state provenance'), 'validation');

test('retained companion states preserve primary centers, solution gravity and independent composition', async () => {
  for (const identity of identities) {
    const bodyRoot = resolve(projectRoot, 'src/objects', identity.bodyId);
    const state = await loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity });
    const radius = Math.hypot(...state.positionKm);
    assert.ok(radius > identity.radiusRange[0] && radius < identity.radiusRange[1]);
    assert.equal(state.centerBodyId, identity.centerBodyId);
    assert.equal(parent(state).provenance.target, identity.center);
    assert.equal(parent(state).provenance.center, 10);
    await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, ...identity, epochJdTt: epochJdTt + 1 }), /epoch or convention/u);
    await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity, center: 20000617 }), /identity\/path/u);
  }
});

test('source closure rejects wrong scale, gravity, frames, altered bytes and false center composition', async t => {
  const identity = identities[1];
  const bodyRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-companion-epoch-'));
  t.after(() => rm(bodyRoot, { recursive: true, force: true }));
  await mkdir(resolve(bodyRoot, 'source/validation'), { recursive: true });
  await cp(resolve(projectRoot, 'src/objects/menoetius/source/orbit'), resolve(bodyRoot, 'source/orbit'), { recursive: true });
  await cp(resolve(projectRoot, 'src/objects/menoetius/source/validation/epoch-state.json'), resolve(bodyRoot, 'source/validation/epoch-state.json'));
  const recordPath = resolve(bodyRoot, 'source/validation/epoch-state.json');
  const original = requireRecord(JSON.parse(await readFile(recordPath, 'utf8')), 'Menoetius epoch receipt');
  const load = () => loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity });
  for (const [change, error] of [
    [(r: Record<string, unknown>) => { r.ttMinusUtcSeconds = 0; }, /epoch or convention/u],
    [(r: Record<string, unknown>) => { const v = requireArray(r.positionKm, 'position'); v[0] = Number(v[0]) * 1000; }, /relative position/u],
    [(r: Record<string, unknown>) => { recordAt(r, 'gravitationalParametersKm3PerS2').parent = .095; }, /gravity differs/u],
    [(r: Record<string, unknown>) => { const source = recordAt(r, 'sources', 'relative'); source.url = String(source.url).replace('REF_PLANE=FRAME', 'REF_PLANE=ECLIPTIC'); }, /request convention/u],
    [(r: Record<string, unknown>) => { recordAt(r, 'sources', 'relative').sha256 = '0'.repeat(64); }, /source hash\/length/u],
  ] satisfies readonly [ReceiptMutation, RegExp][]) {
    const record = structuredClone(original); change(record);
    await writeFile(recordPath, JSON.stringify(record));
    await assert.rejects(load, error);
  }
  // Even a re-pinned, plausible heliocentric source cannot bypass the independent center check.
  const record = structuredClone(original);
  const check = recordAt(record, 'sources', 'heliocentricCheck');
  const checkPath = resolve(bodyRoot, String(check.path));
  const bytes = Buffer.from((await readFile(checkPath, 'utf8')).replace('2.195297013930358E+08', '2.195297113930358E+08'));
  check.sha256 = createHash('sha256').update(bytes).digest('hex');
  check.bytes = bytes.length;
  await writeFile(checkPath, bytes);
  await writeFile(recordPath, JSON.stringify(record));
  await assert.rejects(load, /independent center composition/u);
});

test('Squannit uses its published longitude, retrograde plane and quadratic drift with an analytic velocity', async () => {
  const bodyRoot = resolve(projectRoot, 'src/objects/squannit');
  const parameters = parsePublishedParameters(JSON.parse(await readFile(resolve(bodyRoot, 'source/orbit/published-parameters.json'), 'utf8')));
  const state = await loadBodyEpochEphemeris({ bodyRoot, bodyId: 'squannit', centerBodyId: 'moshup', target: null, center: null, epochJdTt });
  assert.ok(Math.abs(Math.hypot(...state.positionKm) - 2.548) < 1e-12, 'published radar separation in km');
  assert.ok(Number(validation(state).orbitalPlaneVsIndependentRadarDegrees) < 2,
    'ecliptic-to-ICRF orbit plane agrees with the independent radar pole');
  assert.ok(Number(recordAt(validation(state), 'phaseSensitivity').sumOfComponentRangesDegrees) > 55,
    'the large extrapolation sensitivity must remain visible');
  const sourceEpoch = evaluatePublishedOrbit(parameters, parameters.epochJd);
  const obliquity = 84381.448 / 3600 * Math.PI / 180;
  const [x, y, z] = sourceEpoch.positionKm;
  const ecliptic = [x, y * Math.cos(obliquity) + z * Math.sin(obliquity), -y * Math.sin(obliquity) + z * Math.cos(obliquity)];
  const node = parameters.ascendingNodeDegrees * Math.PI / 180;
  const inclination = parameters.inclinationDegrees * Math.PI / 180;
  const inPlaneX = ecliptic[0] * Math.cos(node) + ecliptic[1] * Math.sin(node);
  const inPlaneY = (-ecliptic[0] * Math.sin(node) + ecliptic[1] * Math.cos(node)) * Math.cos(inclination) + ecliptic[2] * Math.sin(inclination);
  assert.ok(Math.abs(Math.atan2(inPlaneY, inPlaneX) * 180 / Math.PI + parameters.ascendingNodeDegrees - 40) < 1e-10,
    'the source longitude L0=40 degrees survives element/frame conversion');
  const withoutDrift = evaluatePublishedOrbit({ ...parameters, quadraticMeanAnomalyDegreesPerYear2: 0 }, epochJdTt);
  assert.ok(Math.hypot(...state.positionKm.map((value, i) => value - withoutDrift.positionKm[i])) > 5,
    'omitting measured orbital drift would move the body almost across its full orbit');
  const dt = .0001;
  const before = evaluatePublishedOrbit(parameters, epochJdTt - dt);
  const after = evaluatePublishedOrbit(parameters, epochJdTt + dt);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs((after.positionKm[i] - before.positionKm[i]) / (2 * dt) - state.velocityKmPerDay[i]) < .00006);
  }
  await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, bodyId: 'squannit', centerBodyId: 'moshup', target: null, center: null, epochJdTt: epochJdTt + 1 }), /epoch or convention/u);
});

test('Romulus retains its actual source projection disagreements and numbered-parent vector', async t => {
  const options = { bodyId: 'romulus', centerBodyId: 'sylvia', target: null, center: null, epochJdTt };
  const state = await loadBodyEpochEphemeris({ ...options, bodyRoot: resolve(projectRoot, 'src/objects/romulus') });
  assert.ok(Math.abs(Math.hypot(...state.positionKm) - 1340.6) < 1e-9);
  assert.equal(parent(state).provenance.target, 87);
  assert.equal(requireRecord(parent(state).provenance, 'Romulus parent provenance').targetKind, 'numbered-asteroid');
  assert.equal(validation(state).scientificPrecisionQualified, false);
  assert.ok(Number(validation(state).maxDifferenceMas) > 60, 'the rounded model does not achieve the paper fit RMS');
  const comparison = required(arrayAt(validation(state), 'comparisons').map(value => requireRecord(value, 'Romulus comparison')).find(value => value.epochJdTt === epochJdTt), 'prepared-epoch Romulus comparison');
  assert.ok(Number(comparison.skyPlaneDifferenceKm) > 140);
  const bodyRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-published-epoch-'));
  t.after(() => rm(bodyRoot, { recursive: true, force: true }));
  await mkdir(resolve(bodyRoot, 'source/validation'), { recursive: true });
  await cp(resolve(projectRoot, 'src/objects/romulus/source/orbit'), resolve(bodyRoot, 'source/orbit'), { recursive: true });
  const recordPath = resolve(bodyRoot, 'source/validation/epoch-state.json');
  const original = requireRecord(JSON.parse(await readFile(resolve(projectRoot, 'src/objects/romulus/source/validation/epoch-state.json'), 'utf8')), 'Romulus epoch receipt');
  for (const [change, error] of [
    [(r: Record<string, unknown>) => { recordAt(r, 'validation').maxDifferenceMas = 9.85; }, /projection limits/u],
    [(r: Record<string, unknown>) => { recordAt(r, 'validation').scientificPrecisionQualified = true; }, /projection limits/u],
    [(r: Record<string, unknown>) => { const comparison = requireRecord(required(requireArray(recordAt(r, 'validation').comparisons, 'comparisons')[0], 'comparison'), 'comparison'); const position = requireArray(comparison.publishedModelPositionMas, 'published position'); position[0] = Number(position[0]) + 1; }, /source projection/u],
    [(r: Record<string, unknown>) => { const position = requireArray(recordAt(r, 'parentHeliocentricState').positionKm, 'parent position'); position[0] = Number(position[0]) * 1000; }, /published parent position/u],
    [(r: Record<string, unknown>) => { const source = recordAt(r, 'parentHeliocentricSource'); source.url = String(source.url).replace('VEC_CORR=NONE', 'VEC_CORR=LT'); }, /query convention/u],
  ] satisfies readonly [ReceiptMutation, RegExp][]) {
    const record = structuredClone(original); change(record);
    await writeFile(recordPath, JSON.stringify(record));
    await assert.rejects(loadBodyEpochEphemeris({ ...options, bodyRoot }), error);
  }
});

test('SN263 source snapshots retain the outer/inner identities and the independent epoch anchors', async () => {
  const roots = ['sn263-beta', 'sn263-gamma'].map(bodyId => ({
    bodyId, centerBodyId: 'asteroid-2001-sn263', bodyRoot: resolve(projectRoot, 'src/objects', bodyId), target: null, center: null, epochJdTt,
  }));
  const states: Awaited<ReturnType<typeof loadBodyEpochEphemeris>>[] = [];
  for (const options of roots) {
    // The loader compares JavaScript rotations with the Python plane-basis anchors
    // in each source receipt, at both the original and prepared epochs.
    const state = await loadBodyEpochEphemeris(options);
    states.push(state);
    assert.equal(parent(state).provenance.target, 153591);
    assert.equal(validation(state).scientificPrecisionQualified, false);
    assert.ok(Number(validation(state).periodUncertaintyLinearPhaseScaleDegrees) > 360,
      'the source period ranges do not preserve a known current phase');
    await assert.rejects(loadBodyEpochEphemeris({ ...options, epochJdTt: epochJdTt + 1 }), /epoch or convention/u);
  }
  assert.ok(Math.hypot(...required(states[0], 'SN263 Beta').positionKm) > Math.hypot(...required(states[1], 'SN263 Gamma').positionKm),
    'Beta is the outer satellite; unnamed JPL physical fields cannot swap the two');
});
