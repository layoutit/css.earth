import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { associate, candidatesAtEpoch, epochMjd, hostedPlanetsOf, readRelativeAstrometryCsv, runAssociation } from './association.mts';

const root = resolve(import.meta.dirname, '../../../..');
const fixture = resolve(root, 'tests/fixtures/telescope-families/sky-association-beta-pictoris/gravity-2026.csv');
const temporary = async () => mkdtemp(resolve(tmpdir(), 'sky-association-'));

test('relative astrometry is read in the orbitize! layout and refuses what it cannot represent', async () => {
  const rows = readRelativeAstrometryCsv(await readFile(fixture, 'utf8'));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { id: 'b-2022-01-25', epochMjd: 59604.16, eastMas: 256.753, northMas: 422.165, body: 'beta-pictoris-b', covariance: [0.056 ** 2, -0.499 * 0.056 * 0.141, 0.141 ** 2] });
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

/**
 * The oracle: *A Candidate Innermost Fifth Planet in the HR 8799 System Revealed by JWST NIRISS Aperture Masking
 * Interferometry* (arXiv:2609.10507) publishes both halves of a sky association. Its Table 2 measures the four known
 * planets and a candidate fifth source on 2023 August 3; its Table 3 predicts the known planets for that date with
 * whereistheplanet and judges each axis against the measurement's own error bars.
 */
const HR_8799 = resolve(root, 'tests/fixtures/telescope-families/sky-association-hr-8799/niriss-ami-2023.csv');
const PAPER_PREDICTION = { 'hr-8799-b': [1635.41, 532.42], 'hr-8799-c': [-288.59, 909.70], 'hr-8799-d': [-606.14, -345.32], 'hr-8799-e': [-231.65, 325.88] } as Record<string, [number, number]>;
/**
 * Table 3's checks: how many of its own sigma the paper needs before each axis agrees. Its declination cell for e is
 * marked outside 2σ, but its own printed values give 302.2 ± 13.3 against 325.88, which is 1.78σ, so this expects the
 * arithmetic of the table rather than the mark.
 */
const PAPER_AGREES_WITHIN = { 'hr-8799-b': [1, 1], 'hr-8799-c': [1, 1], 'hr-8799-d': [3, 2], 'hr-8799-e': [1, 2] } as Record<string, [number, number]>;

test('the HR 8799 predictions this repository returns are the ones its discovery paper printed', async () => {
  const set = await candidatesAtEpoch('hr-8799', 60159);
  for (const [id, [east, north]] of Object.entries(PAPER_PREDICTION)) {
    const candidate = set.candidates.find(item => item.id === id)!;
    assert.ok(Math.abs(candidate.eastMas - east) < 0.15, `${id} east ${candidate.eastMas} vs published ${east}`);
    assert.ok(Math.abs(candidate.northMas - north) < 0.15, `${id} north ${candidate.northMas} vs published ${north}`);
    assert.ok(candidate.sigmaEastMas! < 3 && candidate.sigmaNorthMas! < 3, `${id} prediction error above the paper's stated 2 mas`);
  }
  assert.equal(set.candidates.filter(candidate => candidate.kind === 'planet').length, 4);
});

test('the HR 8799 measurements match their own planets, and the candidate fifth source matches none of them', async () => {
  const measurements = readRelativeAstrometryCsv(await readFile(HR_8799, 'utf8'));
  const { associations } = await associate(measurements, 'hr-8799');
  for (const association of associations) {
    const letter = association.measurement.id[0]!, closest = association.tests.find(test => test.id === association.closest)!;
    if (letter === 'f') {
      // The paper's candidate planet: every known companion has to be far from it, or it would be one of them.
      for (const test of association.tests) if (test.id !== 'hr-8799') assert.ok(test.mahalanobis > 6, `candidate f sits R ${test.mahalanobis} from ${test.id}`);
      continue;
    }
    assert.equal(association.closest, `hr-8799-${letter}`);
    assert.ok(closest.mahalanobis < 3, `${association.measurement.id} R ${closest.mahalanobis}`);
    for (const test of association.tests) if (test.id !== association.closest) assert.ok(test.mahalanobis > 25, `${association.measurement.id} vs ${test.id} R ${test.mahalanobis}`);
    // Table 3's per-axis verdict, by the rule the paper states: its own error bars, without the prediction errors.
    const covariance = association.measurement.covariance!, sigma = [Math.sqrt(covariance[0]), Math.sqrt(covariance[2])];
    const within = closest.offsetMas.map((offset, axis) => Math.ceil(Math.abs(offset) / sigma[axis]!));
    assert.deepEqual(within, PAPER_AGREES_WITHIN[association.closest], `${association.measurement.id} per-axis agreement`);
  }
});

test('the system chart carries the orbit draws, the archival astrometry and the newest predictions', async () => {
  const work = await temporary();
  try {
    const result = await runAssociation(HR_8799, 'hr-8799', resolve(work, 'run'), { orbitDraws: 4, fitAstrometry: true });
    const record = JSON.parse(await readFile(resolve(work, 'run', 'association.json'), 'utf8'));
    assert.equal(record.chart, 'system/preview.png');
    assert.equal((await readFile(resolve(work, 'run', 'system', 'preview.png'))).subarray(1, 4).toString(), 'PNG');
    // The tool ships the astrometry its own fit was made from: 74 rows over 2004 to 2022, of which 65 are offsets.
    // The other nine are separation and position angle, which this route refuses to convert.
    const archival = result.rows.filter(row => row.association.measurement.id.includes('@'));
    assert.equal(archival.length, 65);
    assert.ok(archival.every(row => row.association.closest === row.association.measurement.body), 'every archival row matches the planet it was measured for');
    const epochs = result.rows.map(row => row.association.measurement.epochMjd);
    assert.ok(Math.min(...epochs) < 54000 && Math.max(...epochs) === 60159);
  } finally { await rm(work, { recursive: true, force: true }); }
});
