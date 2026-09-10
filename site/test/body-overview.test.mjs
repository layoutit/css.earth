import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { OBJECTS } from '../objects.mts';
import { prepareBodyOverview, overviewMeasurements } from '../prepare-body-overview.mts';
import { readSpectrumData } from '../../tools/objects/content/spectrum-data.mts';
import { renderCompactSpectrum } from '../../tools/objects/content/compact-spectrum.mts';

test('overview charts retain every supplied spectrum sample across the registry', async () => {
  let charts = 0;
  for (const object of OBJECTS) {
    const source = new URL(`../../src/planets/${object.id}/source/`, import.meta.url);
    const recipe = await readFile(new URL('content/charts.json', source), 'utf8').then(JSON.parse)
      .catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const chart = recipe?.charts.find(entry => entry.kind === 'spectrum');
    const overview = await prepareBodyOverview(object.id);
    if (!chart) { assert.equal(overview.spectrum, null, object.id); continue; }
    charts++;
    const data = await readSpectrumData(fileURLToPath(source), chart);
    const svg = Buffer.from(overview.spectrum.src.split(',')[1], 'base64').toString();
    const curve = svg.match(/<path d="(M[^"]+)" fill="none"/)[1];
    assert.equal((curve.match(/[ML]/g) ?? []).length, chart.pointCount, object.id);
    assert.equal(data.points.length, chart.pointCount, object.id);
    assert.match(svg, /viewBox="0 0 300 90"/);
    assert.equal(overview.spectrum.title, /model/i.test(chart.title) ? 'Modeled reflectance' : 'Reflectance');
    if (overview.image) await access(new URL(`../../public${overview.image}`, import.meta.url));
  }
  assert.ok(charts > 0);
});

test('overview measurements use the body reference radius and catalogue distance', () => {
  assert.deepEqual(overviewMeasurements({ worldFrame: { bodyRadiusM: 25559 }, distanceAu: 19.2 }, 6378.137),
    { radiusEarth: '4.01', distanceAu: '19.2' });
  assert.deepEqual(overviewMeasurements({ worldFrame: { bodyRadiusM: 6378.137 }, distanceAu: 1 }, 6378.137),
    { radiusEarth: '1', distanceAu: '1' });
});

test('compact spectra reject unordered or nonfinite samples', () => {
  const profile = { title: 'Reflectance', description: 'Measured values', metadata: {}, maximum: 1 };
  for (const points of [
    [{ wavelength: .8, total: .3 }, { wavelength: .4, total: .5 }],
    [{ wavelength: .4, total: NaN }, { wavelength: .8, total: .5 }],
  ]) assert.throws(() => renderCompactSpectrum({ ...profile, points }));
});
