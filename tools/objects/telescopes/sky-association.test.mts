import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { associate, candidatesAtEpoch, epochMjd, hostedPlanetsOf, readRelativeAstrometryCsv, runAssociation } from './sky-association.mts';

const root = resolve(import.meta.dirname, '../../..');
const fixture = resolve(root, 'tests/fixtures/telescope-families/sky-association-beta-pictoris/gravity-2026.csv');
const temporary = async () => mkdtemp(resolve(tmpdir(), 'sky-association-'));

test('relative astrometry is read in the orbitize! layout and refuses what it cannot represent', async () => {
  const rows = readRelativeAstrometryCsv(await readFile(fixture, 'utf8'));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { id: 'b-2022-01-25', epochMjd: 59604.16, eastMas: 256.753, northMas: 422.165, covariance: [0.056 ** 2, -0.499 * 0.056 * 0.141, 0.141 ** 2] });
  assert.throws(() => readRelativeAstrometryCsv('epoch,sep,pa\n59604.16,494,31\n'), /raoff/u);
  assert.throws(() => readRelativeAstrometryCsv('id,epoch,raoff,decoff,raoff_err\na,1,2,3,0.1\n'), /only one offset error/u);
  assert.throws(() => readRelativeAstrometryCsv('id,epoch,raoff,decoff,raoff_err,decoff_err,radec_corr\na,1,2,3,0.1,0.2,2\n'), /correlation/u);
  assert.equal(epochMjd('2026-05-02T12:28:00'), 61162.51944444445);
  assert.equal(epochMjd('61162.5'), 61162.5);
});

test('candidates come from whereistheplanet, and a body with no published prediction is excluded rather than guessed', async () => {
  // The radio discovery of β Pic b (arXiv:2609.16720) predicted its candidates with whereistheplanet for this epoch and
  // reported their ephemeris uncertainty as at most 3 mas for b and 22 mas for c.
  const set = await candidatesAtEpoch('beta-pictoris', epochMjd('2026-05-02T12:28:00'));
  const star = set.candidates.find(candidate => candidate.kind === 'star')!;
  assert.deepEqual([star.id, star.eastMas, star.northMas], ['beta-pictoris', 0, 0]);
  const b = set.candidates.find(candidate => candidate.id === 'beta-pictoris-b')!, c = set.candidates.find(candidate => candidate.id === 'beta-pictoris-c')!;
  assert.equal(b.predictedFrom?.tool, 'whereistheplanet');
  assert.equal(b.predictedFrom?.planet, 'betapicb');
  assert.match(b.predictedFrom!.orbit, /Lacour/u);
  assert.ok(b.sigmaEastMas! < 3 && b.sigmaNorthMas! <= 3.1, `b ephemeris σ ${b.sigmaEastMas}, ${b.sigmaNorthMas} mas`);
  assert.ok(c.sigmaEastMas! < 22 && c.sigmaNorthMas! < 22, `c ephemeris σ ${c.sigmaEastMas}, ${c.sigmaNorthMas} mas`);
  assert.ok(Math.hypot(b.eastMas, b.northMas) > 400 && Math.hypot(c.eastMas, c.northMas) < 100);
  assert.deepEqual(set.excluded.map(item => item.id), ['beta-pictoris-d']);
  assert.ok(hostedPlanetsOf('beta-pictoris').includes('beta-pictoris-d' as never));
  assert.equal(set.tracks.length, 2);
  assert.ok(set.software.whereistheplanet && set.software.orbitize && set.software.scipy);
  assert.throws(() => hostedPlanetsOf('beta-pictoris-b'), /not a star/u);
});

test('each published GRAVITY position associates with its own planet and rejects the rest', async () => {
  // Table 1 of arXiv:2609.02708: GRAVITY astrometry taken after the Lacour et al. 2021 fit these orbits come from.
  const measurements = readRelativeAstrometryCsv(await readFile(fixture, 'utf8'));
  const { associations } = await associate(measurements, 'beta-pictoris');
  for (const association of associations) {
    const expected = association.measurement.id.startsWith('b-') ? 'beta-pictoris-b' : 'beta-pictoris-c';
    const closest = association.tests.find(test => test.id === association.closest)!;
    assert.equal(association.closest, expected, `${association.measurement.id} matched ${association.closest}`);
    assert.ok(closest.mahalanobis < 3, `${association.measurement.id} R ${closest.mahalanobis}`);
    for (const other of association.tests) if (other.id !== expected) assert.ok(other.mahalanobis > 20, `${association.measurement.id} vs ${other.id} R ${other.mahalanobis}`);
  }
  await assert.rejects(associate([{ id: 'no-error', epochMjd: 59604.16, eastMas: 1, northMas: 2 }], 'beta-pictoris'), /covariance/u);
});

test('the association command writes its rows, its limits and a chart for each measurement', async () => {
  const work = await temporary();
  try {
    const result = await runAssociation(fixture, 'beta-pictoris', resolve(work, 'run'));
    const record = JSON.parse(await readFile(resolve(work, 'run', 'association.json'), 'utf8'));
    assert.equal(record.schema, 'cssearth-sky-association@1');
    assert.equal(record.rows.length, 4);
    assert.ok(record.limits.some((limit: string) => /whereistheplanet/u.test(limit)));
    assert.equal(record.software.whereistheplanet, result.software.whereistheplanet);
    assert.equal((await readFile(resolve(work, 'run', result.rows[0]!.chart))).subarray(1, 4).toString(), 'PNG');
    await assert.rejects(runAssociation(fixture, 'beta-pictoris', resolve(work, 'run')), /already exists/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});
