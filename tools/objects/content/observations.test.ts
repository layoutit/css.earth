import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseObservations, renderObservationChart, observationCsv, validateObservationRecipe } from './observations';
import type { ObservationRecipe } from './observations';
import { readJwstSpectrum } from './jwst-spectrum';

const bytes = Buffer.from('Wavelength,Flux (Jy),Error (Jy)\n1,-0.000002,0.000001\n2,0.000004,0.000002\n');
const recipe: ObservationRecipe = {
  kind: 'observations', id: 'measured', title: 'Measured & qualified', description: 'Two measured samples.',
  output: 'chart.png', dataOutput: 'chart.csv', source: 'source.csv', metadata: {},
  sha256: createHash('sha256').update(bytes).digest('hex'), format: 'csv',
  header: 'Wavelength,Flux (Jy),Error (Jy)', sampleCount: 2,
  columns: { x: 0, y: 1, error: 2, count: 3 }, yScale: 1e6, uncertainty: 'one-sigma',
  x: { label: 'Wavelength (µm)', minimum: 1, maximum: 2, ticks: [1, 2] },
  y: { label: 'Flux density (µJy)', minimum: -4, maximum: 8, ticks: [-4, 0, 4, 8] },
};
const rehash = (text: string, overrides = {}) => ({ ...recipe, ...overrides,
  sha256: createHash('sha256').update(text).digest('hex') });

test('signed measurements and their uncertainties survive unit conversion and plotting', () => {
  const points = parseObservations(bytes, recipe);
  assert.deepEqual(points, [
    { x: 1, y: -2, error: 1, excluded: false }, { x: 2, y: 4, error: 2, excluded: false },
  ]);
  const svg = renderObservationChart(points, recipe);
  assert.match(svg, /Measured &amp; qualified/);
  // Independent axis anchors: plot x 56..350, y 180..42 spans -4..8.
  assert.match(svg, /cx="56.000" cy="157.000"/);
  assert.match(svg, /M56.000 168.500V145.500/);
  assert.match(svg, /cx="350.000" cy="88.000"/);
  assert.match(observationCsv(points, recipe), /"1","-2","1","false","0"/);
  assert.throws(() => renderObservationChart(points, { ...recipe, y: { ...recipe.y, minimum: 0, ticks: [0, 4, 8] } }), /hide/);
});

test('source drift, missing columns, nonfinite values, unsorted wavelengths and negative errors fail closed', () => {
  assert.throws(() => parseObservations(Buffer.concat([bytes, Buffer.from('\n')]), recipe), /hash/);
  for (const body of ['1,,1\n2,4,2', '1,2,-1\n2,4,2', '1,NaN,1\n2,4,2', '2,2,1\n1,4,2', '1,2\n2,4']) {
    const text = recipe.header + '\n' + body + '\n';
    assert.throws(() => parseObservations(Buffer.from(text), rehash(text)));
  }
  assert.throws(() => parseObservations(bytes, { ...recipe, sampleCount: 3 }), /count/);
  assert.throws(() => parseObservations(bytes, { ...recipe, header: 'wrong units' }), /units/);
});

test('observing sequences preserve phase wraps and missing errors without inventing zero uncertainty', () => {
  const text = 'Notes\n\nISS_FIRST\n0.9,0.4\n0.1,0.2\n\nISS_SECOND\n0.5,0.6\n';
  const config = rehash(text, { format: 'sectioned-csv', section: 'ISS_FIRST', columns: { x: 0, y: 1, count: 2 },
    uncertainty: 'not-released', yScale: 1, x: { label: 'Rotational phase', minimum: 0, maximum: 1, ticks: [0, 0.5, 1] },
    y: { label: 'Relative magnitude', minimum: 0, maximum: 1, ticks: [0, 0.5, 1], reverse: true } }) as ObservationRecipe;
  const points = parseObservations(Buffer.from(text), config);
  assert.deepEqual(points.map(p => p.x), [0.9, 0.1]);
  assert.ok(points.every(p => !('error' in p)));
  assert.match(renderObservationChart(points, config), /cx="320.600" cy="97.200"/);
  assert.doesNotMatch(observationCsv(points, config), /1-sigma/);
  assert.throws(() => parseObservations(Buffer.from(text), { ...config, section: 'absent' }), /sequence/);
  assert.throws(() => validateObservationRecipe({ ...config, uncertainty: 'one-sigma' }), /uncertainty/);
});

test('documented instrument gaps retain raw rows in the downloadable data', () => {
  const config = { ...recipe, exclude: [{ minimum: 0.99, maximum: 1.01, reason: 'Source-defined bad channel' }] };
  const points = parseObservations(bytes, config);
  assert.equal(points[0].excluded, true);
  assert.match(observationCsv(points, config), /"1","-2","1","true","0"/);
  const svg = renderObservationChart(points, config);
  assert.doesNotMatch(svg, /cx="56.000"/);
  assert.match(svg, /cx="350.000"/);
  const detail = { ...recipe, x: { ...recipe.x, minimum: 1.5, ticks: [1.5, 2] } };
  assert.match(observationCsv(parseObservations(bytes, recipe), detail), /"1","-2","1","true","0"/);
});

test('all released JWST flux rows match independently pinned numeric anchors', async () => {
  const anchors = JSON.parse(await readFile('docs/moons/b4-observations/flux-anchors.json', 'utf8'));
  for (const source of anchors) {
    const directory = `src/planets/${source.body}/source`;
    const config = JSON.parse(await readFile(`${directory}/content/charts.json`, 'utf8'));
    const chart = config.charts.find((chart: ObservationRecipe) => chart.id === source.id);
    const points = parseObservations(await readFile(`${directory}/${chart.source}`), chart);
    assert.equal(points.length, source.rows);
    assert.equal(points.filter(p => p.y < 0).length, source.negativeSamples);
    for (const anchor of source.anchors) {
      const point = points[anchor.row];
      assert.equal(point.x, anchor.wavelength);
      assert.ok(Math.abs(point.y - anchor.fluxJy * 1e6) < 1e-10);
      assert.ok(Math.abs(point.error! - anchor.errorJy * 1e6) < 1e-10);
    }
    assert.equal((renderObservationChart(points, chart).match(/<circle /g) ?? []).length, source.rows);
  }
});

test('calibrated FITS values and unsigned quality flags agree with independent binary-table anchors', async () => {
  const anchors = JSON.parse(await readFile('docs/moons/b4-observations/fits-anchors.json', 'utf8'));
  for (const source of anchors) {
    const directory = `src/planets/${source.body}/source`;
    const config = JSON.parse(await readFile(`${directory}/content/charts.json`, 'utf8'));
    const chart = config.charts.find((chart: ObservationRecipe) => chart.id === source.id);
    const bytes = await readFile(`${directory}/${chart.source}`);
    const points = parseObservations(bytes, chart);
    assert.equal(points.length, source.rows);
    assert.equal(points.filter(point => !point.excluded).length, source.validRows);
    for (const anchor of source.anchors) {
      const point = points[anchor.row];
      assert.equal(point.x, anchor.wavelength);
      assert.equal(point.quality, anchor.quality);
      assert.equal(point.excluded, anchor.quality !== 0);
      assert.ok(Math.abs(point.y - anchor.fluxJy * 1e6) < 1e-10);
      assert.ok(Math.abs(point.error! - anchor.errorJy * 1e6) < 1e-10);
    }
    assert.equal((renderObservationChart(points, chart).match(/<circle /g) ?? []).length, source.validRows);
    const csv = observationCsv(points, chart);
    assert.match(csv, /Data quality flags/);
    assert.equal(csv.trim().split('\n').length, source.rows + 1);
    assert.throws(() => readJwstSpectrum(bytes, { ...chart.fits, targetName: 'WRONG TARGET' }), /identity/);
    assert.throws(() => readJwstSpectrum(bytes, { ...chart.fits, calibrationVersion: '1.0' }), /identity/);
    assert.throws(() => readJwstSpectrum(bytes.subarray(0, bytes.length - 4000), chart.fits), /Truncated/);
  }
});

test('FITS unit and unsigned-offset drift cannot silently change a scientific chart', async () => {
  const directory = 'src/planets/albiorix/source';
  const chart = JSON.parse(await readFile(`${directory}/content/charts.json`, 'utf8')).charts[0];
  const original = await readFile(`${directory}/${chart.source}`);
  const editCard = (key: string, value: string) => {
    const bytes = Buffer.from(original);
    for (let offset = 0; offset + 80 <= bytes.length; offset += 80) {
      if (bytes.toString('ascii', offset, offset + 8).trim() !== key) continue;
      bytes.write(`${key.padEnd(8)}= ${value}`.padEnd(80), offset, 80, 'ascii');
      return bytes;
    }
    throw new Error('Missing test header card');
  };
  assert.throws(() => readJwstSpectrum(editCard('TUNIT2', "'mJy     '"), chart.fits), /units/);
  assert.throws(() => readJwstSpectrum(editCard('TZERO12', '0'), chart.fits), /quality/);
});
