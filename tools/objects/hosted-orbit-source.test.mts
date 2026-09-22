import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { readHostedOrbitRecord } from '../../packages/astronomy/tools/lib/generator-records.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';

const root = resolve(import.meta.dirname, '../..');
const source = resolve(root, 'tests/fixtures/hosted-orbits/trappist-1f-agol2021');
const manifest = requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')));
const qualification = requireRecord(JSON.parse(await readFile(resolve(source, 'qualification.json'), 'utf8')));
const published = requireRecord(qualification.published), conversion = requireRecord(qualification.conversion);
const close = (actual: number, expected: number, tolerance = 2e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`);
test('TRAPPIST-1f eccentric hosted-orbit evidence is pinned to the immutable author sources', async () => {
  const commit = requireString(requireRecord(manifest.publication).commit);
  assert.equal(commit, '0a417ab77425a016eed2b492efa8a556631ac152');
  for (const entry of requireArray(manifest.records)) {
    const record = requireRecord(entry), path = requireString(record.path);
    const bytes = await readFile(resolve(source, path));
    assert.equal(bytes.length, record.expectedBytes, path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.expectedSha256, path);
    assert.match(requireString(record.origin), new RegExp(commit));
  }
});

test('TRAPPIST-1f source omega maps exactly to the hosted inferior-conjunction convention', () => {
  const orbit = readHostedOrbitRecord(qualification.orbit);
  const x = requireFiniteNumber(published.eccentricityCosSourceOmega);
  const y = requireFiniteNumber(published.eccentricitySinSourceOmega);
  const sourceOmega = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  const hostedOmega = (sourceOmega - Math.PI + 2 * Math.PI) % (2 * Math.PI);
  const sourceTrueAnomaly = (1.5 * Math.PI - sourceOmega + 2 * Math.PI) % (2 * Math.PI);
  const hostedTrueAnomaly = (Math.PI / 2 - hostedOmega + 2 * Math.PI) % (2 * Math.PI);
  close(orbit.eccentricity, Math.hypot(x, y));
  close(orbit.argumentOfPeriapsisDegrees!, hostedOmega * 180 / Math.PI);
  close(sourceTrueAnomaly, hostedTrueAnomaly);
  close(sourceTrueAnomaly, requireFiniteNumber(conversion.sourceTransitTrueAnomalyRadians));

  const e = orbit.eccentricity;
  const eccentricAnomaly = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(sourceTrueAnomaly / 2), Math.sqrt(1 + e) * Math.cos(sourceTrueAnomaly / 2));
  const meanAnomaly = (eccentricAnomaly - e * Math.sin(eccentricAnomaly) + 2 * Math.PI) % (2 * Math.PI);
  const periapsis = requireFiniteNumber(published.transitEpochBjdTdb) - orbit.periodDays * meanAnomaly / (2 * Math.PI);
  close(meanAnomaly, requireFiniteNumber(conversion.transitMeanAnomalyRadians));
  close(periapsis, requireFiniteNumber(conversion.periapsisEpochBjdTdb), 1e-9);
  close((1 - e * e) / (1 + e * Math.cos(sourceTrueAnomaly)), requireFiniteNumber(conversion.transitRadiusOverSemiMajorAxis));
});
