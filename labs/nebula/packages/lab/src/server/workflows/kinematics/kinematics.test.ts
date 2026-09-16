import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { calibratedValue, prepareKinematicsComparison, shellVelocities } from '@cssearth/nebula-reconstruction/methods/kinematics/forward-model';
import { readKinematicParameters, readPreparedKinematics, readSlitEvidence } from '@cssearth/nebula-reconstruction/methods/kinematics/validation';
import { createKinematicsHandler, loadKinematicEvidence } from '../../routes/kinematics.ts';
import { extractJpegFromEps } from '@cssearth/nebula-reconstruction/methods/kinematics/source-figure';

const sourcePath = 'labs/nebula/models/helix/kinematics-oiii.json';
const bytes = await readFile(sourcePath), raw: unknown = JSON.parse(bytes.toString());
const evidence = readSlitEvidence(raw), identity = createHash('sha256').update(bytes).digest('hex');
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('a sphere gives the analytical position-velocity ellipse and no emission beyond its boundary', () => {
  const p = evidence.defaults;
  for (const offset of [0, 40, 90, 120]) {
    const expected = 12.5 * Math.sqrt(1 - (offset / 120) ** 2), actual = shellVelocities(offset, p)!;
    near(actual[0], -expected); near(actual[1], expected);
  }
  assert.equal(shellVelocities(121, p), null);
});
test('spherical inclination is unidentifiable; nonspherical inclination changes the asymmetric slit tilt', () => {
  const p = evidence.defaults;
  for (const angle of [-75, 0, 37, 80]) shellVelocities(40, { ...p, inclinationDegrees: angle })!.forEach((v, i) => near(v, shellVelocities(40, p)![i]!));
  const tilted = shellVelocities(55, { ...p, depthRatio: 2, inclinationDegrees: 40 })!;
  const reflected = shellVelocities(-55, { ...p, depthRatio: 2, inclinationDegrees: 40 })!;
  near(tilted[0], -reflected[1]); near(tilted[1], -reflected[0]);
  assert.ok(Math.abs(tilted[0] + tilted[1]) > 1);
  near(shellVelocities(0, { ...p, depthRatio: 2 })![1], 25);
});
test('projected extent stays fixed under depth and inclination; speed scales physical predictions', () => {
  const p = { ...evidence.defaults, depthRatio: 2.4, inclinationDegrees: 65 };
  assert.ok(shellVelocities(120, p)); assert.equal(shellVelocities(120.01, p), null);
  const base = shellVelocities(-30, p)!, doubled = shellVelocities(-30, { ...p, expansionKmS: 25 })!;
  base.forEach((v, i) => near(doubled[i]!, 2 * v));
});
test('real source pixels calibrate to heliocentric velocities and systemic velocity is subtracted exactly once', () => {
  near(calibratedValue(719, evidence.figure.velocityCalibration), -60);
  near(calibratedValue(376, evidence.figure.offsetCalibration), 50);
  const output = prepareKinematicsComparison(evidence, evidence.defaults, identity);
  for (const [index, point] of output.chart.points.entries()) {
    const source = evidence.samples[index]!;
    near(point.heliocentricKmS, (source.pixelY - 559) * -60 / 160);
    near(point.relativeKmS, point.heliocentricKmS + 27.1);
  }
  assert.equal(output.chart.points.length, 27);
  assert.ok(output.metrics.nearestSurfaceRmsKmS! > 6, 'one inner shell must not pretend to fit all four observed components');
  assert.equal(output.metrics.comparedPoints, 27);
  const edited = prepareKinematicsComparison(evidence, { ...evidence.defaults, depthRatio: 2, inclinationDegrees: 40 }, identity);
  assert.deepEqual(output.chart.points.map(({ id, offsetArcsec, heliocentricKmS, relativeKmS }) => ({ id, offsetArcsec, heliocentricKmS, relativeKmS })),
    edited.chart.points.map(({ id, offsetArcsec, heliocentricKmS, relativeKmS }) => ({ id, offsetArcsec, heliocentricKmS, relativeKmS })));
});
test('readout uncertainty is separate from systemic uncertainty and not instrumental slit width', () => {
  const output = prepareKinematicsComparison(evidence, evidence.defaults, identity);
  near(output.metrics.offsetReadoutArcsec, 1.5 * 50 / 99); near(output.metrics.velocityReadoutKmS, .5625);
  assert.notEqual(output.metrics.velocityReadoutKmS, evidence.slit.instrumentalWidthKmS);
  near(output.chart.systemicBandHeight, 2 * evidence.systemic.uncertaintyKmS / 80 * (output.chart.bottom - output.chart.top));
});
test('external values reject corrupt calibration, unknown frames, missing observations, and nonfinite assumptions', () => {
  assert.throws(() => readSlitEvidence({ ...evidence, slit: { ...evidence.slit, velocityFrame: 'LSRK' } }));
  assert.throws(() => readSlitEvidence({ ...evidence, figure: { ...evidence.figure, velocityCalibration: [{ pixel: 1, value: 0 }, { pixel: 1, value: -20 }] } }));
  assert.throws(() => readSlitEvidence({ ...evidence, samples: [evidence.samples[0], evidence.samples[0]] }));
  for (const depthRatio of [0, Infinity, NaN, '1']) assert.throws(() => readKinematicParameters({ ...evidence.defaults, depthRatio }));
  assert.throws(() => prepareKinematicsComparison(evidence, evidence.defaults, '0'.repeat(64)));
  const output = prepareKinematicsComparison(evidence, evidence.defaults, identity);
  assert.deepEqual(readPreparedKinematics(JSON.parse(JSON.stringify(output)) as unknown), output);
  assert.throws(() => readPreparedKinematics({ ...output, chart: { ...output.chart, points: output.chart.points.slice(1) } }));
});
test('source identity follows actual recipe bytes and model routes refuse non-model input', async () => {
  const loaded = await loadKinematicEvidence(process.cwd(), sourcePath);
  assert.equal(loaded.evidenceSha256, identity);
  await assert.rejects(loadKinematicEvidence(process.cwd(), '/etc/passwd'));
  await assert.rejects(loadKinematicEvidence(process.cwd(), 'package.json'));
});
test('a real HTTP handoff returns validated measured points, recomputes slider predictions and preserves observed velocities', async t => {
  const handler = createKinematicsHandler(process.cwd());
  const server = createServer((request, response) => { void handler(request, response); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/`;
  const response = await fetch(`${url}?source=${encodeURIComponent(sourcePath)}`); assert.equal(response.status, 200);
  const initial = readPreparedKinematics(await response.json());
  const next = await fetch(url, { method: 'POST', body: JSON.stringify({ sourcePath, parameters: { ...evidence.defaults, depthRatio: 1.8, inclinationDegrees: 36 } }) });
  assert.equal(next.status, 200); const changed = readPreparedKinematics(await next.json());
  assert.notEqual(changed.chart.approachingPath, initial.chart.approachingPath);
  assert.deepEqual(changed.chart.points, initial.chart.points);
  const rejected = await fetch(url, { method: 'POST', body: JSON.stringify({ sourcePath, parameters: { ...evidence.defaults, radiusArcsec: 60 } }) });
  assert.equal(rejected.status, 400);
});
test('publisher ASCII85 decoding preserves exact JPEG bytes and rejects incomplete source streams', () => {
  const expected = Uint8Array.from([255, 216, 255, 217]);
  let number = 0xffd8ffd9; const encoded: string[] = [];
  for (let i = 0; i < 5; i++) { encoded.unshift(String.fromCharCode(number % 85 + 33)); number = Math.floor(number / 85); }
  const eps = `jpeg2ps /ASCII85Decode filter /DCTDecode filter\n} exec\n${encoded.join('')}~>`;
  assert.deepEqual(extractJpegFromEps(eps), expected);
  assert.throws(() => extractJpegFromEps(eps.replace('~>', '')));
});
