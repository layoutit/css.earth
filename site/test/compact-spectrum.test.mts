import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SCENE_OBJECTS } from '../objects.mts';
import { required } from './navigation-test-values.mts';
import { SourceEvidence } from './source-evidence-values.mts';
import { hasErrorCode } from '@cssearth/core';
import { parseSpectrumRecipe, readSpectrumData } from '../overview/spectrum-data.mts';
import { renderCompactSpectrum } from '../overview/compact-spectrum.mts';

test('compact charts retain every supplied spectrum sample across the registry', async () => {
  let charts = 0;
  for (const object of SCENE_OBJECTS) {
    const source = new URL(`../../src/objects/${object.id}/source/`, import.meta.url);
    const recipe = await readFile(new URL('content/charts.json', source), 'utf8').then(text => SourceEvidence.parse(JSON.parse(text)))
      .catch(error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    const selected = recipe?.rows('charts').find(entry => entry.text('kind') === 'spectrum');
    const chart = selected ? parseSpectrumRecipe(selected.value) : undefined;
    if (!chart) continue;
    charts++;
    const data = await readSpectrumData(fileURLToPath(source), chart);
    const svg = renderCompactSpectrum({ ...chart, ...data });
    const curve = required(svg.match(/<path d="(M[^"]+)" fill="none"/))[1];
    assert.equal((curve.match(/[ML]/g) ?? []).length, chart.pointCount, object.id);
    assert.equal(data.points.length, chart.pointCount, object.id);
    assert.match(svg, /viewBox="0 0 300 90"/);
  }
  assert.ok(charts > 0);
});

test('compact spectra reject unordered or nonfinite samples', () => {
  const profile = { title: 'Reflectance', description: 'Measured values', metadata: {}, maximum: 1 };
  for (const points of [
    [{ wavelength: .8, total: .3 }, { wavelength: .4, total: .5 }],
    [{ wavelength: .4, total: NaN }, { wavelength: .8, total: .5 }],
  ]) assert.throws(() => renderCompactSpectrum({ ...profile, points }));
});
