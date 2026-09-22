import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../sources/source-values.mts';
import { readOracleFixture, assertPinnedReferences } from '../oracles/fixture.mts';
import { radianceFactor, type ScatteringAngles } from './normalization.mts';
import type { HapkeModel, ParticlePhaseFunction } from './hapke.mts';

/**
 * USGS ISIS3 as the oracle. tools/oracles/isis/photometric-truth.py reads the truth
 * files of ISIS's photometric model unit tests at the 10.0.0_LTS commit: the
 * parameters, the (phase, incidence, emission) geometries, and the values that
 * ISIS's own Hapke.cpp, LunarLambert.cpp, Minnaert.cpp and LommelSeeliger.cpp
 * printed. ISIS prints six significant digits, so each value computed here must
 * round to the printed one. The Hapke cases exercise ISIS's two-term
 * Henyey-Greenstein and Legendre phase functions, its 1981 H function (Hfunc in
 * PhotoModel.h), shadow hiding, and Hapke (1984) roughness.
 */
const fixture = await readOracleFixture('isis/photometric-truth.json');
const rows = (key: string) => requireArray(fixture.cases[key]).map(row => requireRecord(row));

// ISIS converts degrees as angle * PI / 180; the same order keeps 90° exactly π/2.
const angles = (row: Record<string, unknown>): ScatteringAngles => ({
  incidence: requireFiniteNumber(row.incidenceDegrees) * Math.PI / 180,
  emission: requireFiniteNumber(row.emissionDegrees) * Math.PI / 180,
  phase: requireFiniteNumber(row.phaseDegrees) * Math.PI / 180,
});

function agreesWithPrinted(actual: number, row: Record<string, unknown>, label: string) {
  const printed = requireFiniteNumber(row.value);
  const where = `${label} at g=${row.phaseDegrees}°, i=${row.incidenceDegrees}°, e=${row.emissionDegrees}°`;
  if (printed === 0) return assert.equal(actual, 0, where);
  // Half a unit in the sixth significant digit of the printed value.
  const halfUnit = 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(printed))) - 5);
  assert.ok(Math.abs(actual - printed) <= halfUnit * (1 + 1e-9), `${where}: ${actual} does not round to ISIS's ${printed}`);
}

function isisHapke(row: Record<string, unknown>): HapkeModel {
  const algorithm = requireString(row.algorithm), value = (key: string) => requireFiniteNumber(row[key]);
  let phaseFunction: ParticlePhaseFunction;
  if (algorithm === 'HapkeHen') phaseFunction = { form: 'isis-henyey-greenstein', b: value('Hg1'), c: value('Hg2') };
  else if (algorithm === 'HapkeLeg') phaseFunction = { form: 'legendre', b: value('Bh'), c: value('Ch') };
  else throw new TypeError(`Unknown ISIS Hapke algorithm: ${algorithm}`);
  return {
    family: 'hapke', singleScatteringAlbedo: value('Wh'), hFunction: 'hapke-1981', phaseFunction,
    // Hapke.cpp drops the shadow-hiding term when its width Hh is zero.
    ...(value('Hh') === 0 ? {} : { shadowHiding: { amplitude: value('B0'), width: value('Hh') } }),
    roughness: value('Theta') * Math.PI / 180,
  };
}

test('the ISIS fixture is bound to one ISIS commit and the bytes of the truth files it read', () => {
  assertPinnedReferences(fixture.references);
  const commit = requireString(fixture.cases.commit);
  assert.equal(fixture.references.length, 4);
  for (const reference of fixture.references) assert.ok(reference.url.includes(`/${commit}/`), `${reference.url} is read at the fixture's commit`);
});

test('Hapke radiance factors with shadow hiding, roughness and both ISIS phase functions round to the values ISIS printed', () => {
  const hapke = rows('hapke');
  assert.ok(hapke.some(row => requireFiniteNumber(row.Theta) > 0) && hapke.some(row => requireString(row.algorithm) === 'HapkeLeg') &&
    hapke.some(row => requireFiniteNumber(row.Hg2) > 0), 'the cases exercise roughness and both phase functions');
  for (const row of hapke) agreesWithPrinted(radianceFactor(isisHapke(row), angles(row)), row, `${row.algorithm} w=${row.Wh} B0=${row.B0} h=${row.Hh} θ=${row.Theta}° b=${row.Hg1 ?? row.Bh} c=${row.Hg2 ?? row.Ch}`);
});

test('Lunar-Lambert, Minnaert and Lommel-Seeliger disk functions round to the values ISIS printed', () => {
  // ISIS's unit test also sweeps L = 2, outside the physical range; the arithmetic still has to agree.
  for (const row of rows('lunarLambert')) agreesWithPrinted(radianceFactor({ family: 'separable', disk: { family: 'lunar-lambert', weight: requireFiniteNumber(row.PhotoL) } }, angles(row)), row, `LunarLambert L=${row.PhotoL}`);
  for (const row of rows('minnaert')) agreesWithPrinted(radianceFactor({ family: 'separable', disk: { family: 'minnaert', coefficient: requireFiniteNumber(row.PhotoK), coefficientPerDegree: 0 } }, angles(row)), row, `Minnaert k=${row.PhotoK}`);
  for (const row of rows('lommelSeeliger')) agreesWithPrinted(radianceFactor({ family: 'separable', disk: { family: 'lommel-seeliger' } }, angles(row)), row, 'LommelSeeliger');
  assert.equal(rows('lunarLambert').length + rows('minnaert').length + rows('lommelSeeliger').length, 27);
});
