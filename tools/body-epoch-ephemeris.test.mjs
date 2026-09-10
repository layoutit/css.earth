import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { evaluatePublishedOrbit, loadBodyEpochEphemeris } from '../packages/astronomy/tools/body-epoch-ephemeris.mts';

const projectRoot = resolve(import.meta.dirname, '..');
const identities = [
  { bodyId: 'hiiaka', centerBodyId: 'haumea', target: 120136108, center: 920136108, radiusRange: [50000, 55000] },
  { bodyId: 'menoetius', centerBodyId: 'patroclus', target: 120000617, center: 920000617, radiusRange: [680, 705] },
];
const epochJdTt = 2461286.5;

test('retained companion states preserve primary centers, solution gravity and independent composition', async () => {
  for (const identity of identities) {
    const bodyRoot = resolve(projectRoot, 'src/planets', identity.bodyId);
    const state = await loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity });
    const radius = Math.hypot(...state.positionKm);
    assert.ok(radius > identity.radiusRange[0] && radius < identity.radiusRange[1]);
    assert.equal(state.centerBodyId, identity.centerBodyId);
    assert.equal(state.parentHeliocentricState.provenance.target, identity.center);
    assert.equal(state.parentHeliocentricState.provenance.center, 10);
    await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, ...identity, epochJdTt: epochJdTt + 1 }), /epoch or convention/u);
    await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity, center: 20000617 }), /identity\/path/u);
  }
});

test('source closure rejects wrong scale, gravity, frames, altered bytes and false center composition', async t => {
  const identity = identities[1];
  const bodyRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-companion-epoch-'));
  t.after(() => rm(bodyRoot, { recursive: true, force: true }));
  await mkdir(resolve(bodyRoot, 'source/validation'), { recursive: true });
  await cp(resolve(projectRoot, 'src/planets/menoetius/source/orbit'), resolve(bodyRoot, 'source/orbit'), { recursive: true });
  await cp(resolve(projectRoot, 'src/planets/menoetius/source/validation/epoch-state.json'), resolve(bodyRoot, 'source/validation/epoch-state.json'));
  const recordPath = resolve(bodyRoot, 'source/validation/epoch-state.json');
  const original = JSON.parse(await readFile(recordPath, 'utf8'));
  const load = () => loadBodyEpochEphemeris({ bodyRoot, epochJdTt, ...identity });
  for (const [change, error] of [
    [r => { r.ttMinusUtcSeconds = 0; }, /epoch or convention/u],
    [r => { r.positionKm[0] *= 1000; }, /relative position/u],
    [r => { r.gravitationalParametersKm3PerS2.parent = .095; }, /gravity differs/u],
    [r => { r.sources.relative.url = r.sources.relative.url.replace('REF_PLANE=FRAME', 'REF_PLANE=ECLIPTIC'); }, /request convention/u],
    [r => { r.sources.relative.sha256 = '0'.repeat(64); }, /source hash\/length/u],
  ]) {
    const record = structuredClone(original); change(record);
    await writeFile(recordPath, JSON.stringify(record));
    await assert.rejects(load, error);
  }
  // Even a re-pinned, plausible heliocentric source cannot bypass the independent center check.
  const record = structuredClone(original);
  const checkPath = resolve(bodyRoot, record.sources.heliocentricCheck.path);
  const bytes = Buffer.from((await readFile(checkPath, 'utf8')).replace('2.195297013930358E+08', '2.195297113930358E+08'));
  record.sources.heliocentricCheck.sha256 = createHash('sha256').update(bytes).digest('hex');
  record.sources.heliocentricCheck.bytes = bytes.length;
  await writeFile(checkPath, bytes);
  await writeFile(recordPath, JSON.stringify(record));
  await assert.rejects(load, /independent center composition/u);
});

test('Squannit uses its published longitude, retrograde plane and quadratic drift with an analytic velocity', async () => {
  const bodyRoot = resolve(projectRoot, 'src/planets/squannit');
  const parameters = JSON.parse(await readFile(resolve(bodyRoot, 'source/orbit/published-parameters.json'), 'utf8'));
  const state = await loadBodyEpochEphemeris({ bodyRoot, bodyId: 'squannit', centerBodyId: 'moshup', epochJdTt });
  assert.ok(Math.abs(Math.hypot(...state.positionKm) - 2.548) < 1e-12, 'published radar separation in km');
  assert.ok(state.provenance.validation.orbitalPlaneVsIndependentRadarDegrees < 2,
    'ecliptic-to-ICRF orbit plane agrees with the independent radar pole');
  assert.ok(state.provenance.validation.phaseSensitivity.sumOfComponentRangesDegrees > 55,
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
  await assert.rejects(loadBodyEpochEphemeris({ bodyRoot, bodyId: 'squannit', centerBodyId: 'moshup', epochJdTt: epochJdTt + 1 }), /epoch or convention/u);
});

test('Romulus retains its actual source projection disagreements and numbered-parent vector', async t => {
  const options = { bodyId: 'romulus', centerBodyId: 'sylvia', epochJdTt };
  const state = await loadBodyEpochEphemeris({ ...options, bodyRoot: resolve(projectRoot, 'src/planets/romulus') });
  assert.ok(Math.abs(Math.hypot(...state.positionKm) - 1340.6) < 1e-9);
  assert.equal(state.parentHeliocentricState.provenance.target, 87);
  assert.equal(state.parentHeliocentricState.provenance.targetKind, 'numbered-asteroid');
  assert.equal(state.provenance.validation.scientificPrecisionQualified, false);
  assert.ok(state.provenance.validation.maxDifferenceMas > 60, 'the rounded model does not achieve the paper fit RMS');
  assert.ok(state.provenance.validation.comparisons.find(value => value.epochJdTt === epochJdTt).skyPlaneDifferenceKm > 140);
  const bodyRoot = await mkdtemp(resolve(tmpdir(), 'cssearth-published-epoch-'));
  t.after(() => rm(bodyRoot, { recursive: true, force: true }));
  await mkdir(resolve(bodyRoot, 'source/validation'), { recursive: true });
  await cp(resolve(projectRoot, 'src/planets/romulus/source/orbit'), resolve(bodyRoot, 'source/orbit'), { recursive: true });
  const recordPath = resolve(bodyRoot, 'source/validation/epoch-state.json');
  const original = JSON.parse(await readFile(resolve(projectRoot, 'src/planets/romulus/source/validation/epoch-state.json'), 'utf8'));
  for (const [change, error] of [
    [r => { r.validation.maxDifferenceMas = 9.85; }, /projection limits/u],
    [r => { r.validation.scientificPrecisionQualified = true; }, /projection limits/u],
    [r => { r.validation.comparisons[0].publishedModelPositionMas[0] += 1; }, /source projection/u],
    [r => { r.parentHeliocentricState.positionKm[0] *= 1000; }, /published parent position/u],
    [r => { r.parentHeliocentricSource.url = r.parentHeliocentricSource.url.replace('VEC_CORR=NONE', 'VEC_CORR=LT'); }, /query convention/u],
  ]) {
    const record = structuredClone(original); change(record);
    await writeFile(recordPath, JSON.stringify(record));
    await assert.rejects(loadBodyEpochEphemeris({ ...options, bodyRoot }), error);
  }
});
