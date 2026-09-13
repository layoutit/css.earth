import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord } from '../../source-values.mts';
import { parseCameraMosaic } from './source-records.mts';
import { prepareShapeCameraColor, prepareShapeCameraMosaic, resolveCameraPhotometry } from './shape-camera-mosaic.mts';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';

const root = resolve(import.meta.dirname, '../../..');
async function mosaic(body: string, format: string) {
  const profile = requireRecord(JSON.parse(await readFile(resolve(root, 'src/planets', body, 'source/preparation/terrestrial.json'), 'utf8')));
  const recipe = requireArray(requireRecord(profile.raster).mosaics).map(value => requireRecord(value)).find(value => value.format === format);
  if (!recipe) throw new Error(`${body} has no ${format} mosaic.`);
  return recipe;
}
const published = {
  model: 'photometry/example-hapke.json', referenceDegrees: { incidence: 25, emission: 0, phase: 25 },
  limits: { maximumIncidenceDegrees: 65, maximumEmissionDegrees: 65, phaseDegrees: [20, 30], minimumGain: 0.2, maximumGain: 4 },
  displayMaximum: 0.12, gamma: 2.2, minimumLevel: 1, maximumLevel: 1,
};
// The historical form, spelled out so the tests do not depend on which form a body's recipe uses today.
const legacy = { model: 'observed', weight: 1, maximumGain: 1, displayMaximum: 0.12, gamma: 2.2, maximumIncidenceDegrees: 65, maximumEmissionDegrees: 65, minimumLevel: 1, maximumLevel: 1 };

test('a camera mosaic decodes a published photometric model with its display settings and refuses mixed blocks', async () => {
  const recipe = await mosaic('ida', 'controlled-shape-camera');
  assert.ok('referenceDegrees' in parseCameraMosaic({ ...recipe, photometry: published }).photometry);
  assert.ok(!('referenceDegrees' in parseCameraMosaic({ ...recipe, photometry: legacy }).photometry));
  assert.throws(() => parseCameraMosaic({ ...recipe, photometry: { ...legacy, referenceDegrees: published.referenceDegrees } }), /reference geometry/);
  assert.throws(() => parseCameraMosaic({ ...recipe, photometry: { ...published, weight: 1 } }), /published camera photometry/);
});

test('a published camera block needs its resolved model and valid limits, and filter colour refuses a single-filter model', async () => {
  const recipe = await mosaic('ida', 'controlled-shape-camera'), ida = resolve(root, 'src/planets/ida/source');
  await assert.rejects(prepareShapeCameraMosaic(ida, [], { ...recipe, photometry: published }, 8, 4, {}), /resolved model record/);
  await assert.rejects(prepareShapeCameraMosaic(ida, [], { ...recipe, photometry: { ...published, limits: { ...published.limits, maximumEmissionDegrees: 90 } } }, 8, 4, {}), /Invalid shape-camera mosaic profile/);
  await assert.rejects(prepareShapeCameraMosaic(ida, [], { ...recipe, photometry: legacy }, 8, 4, {}, { photometry: { normalize: () => 1, report: {}, units: '' } }), /needs a published camera photometry block/);
  const color = await mosaic('proteus', 'controlled-shape-color');
  await assert.rejects(prepareShapeCameraColor(resolve(root, 'src/planets/proteus/source'), [], { ...color, photometry: published }, 8, 4, {}), /one filter/);
});

test("Ida's published camera block resolves against its model record and the publication it cites", async () => {
  const recipe = await mosaic('ida', 'controlled-shape-camera'), sourceRoot = resolve(root, 'src/planets/ida/source');
  const source = await createSourceManifest({ planetId: 'ida', planetName: 'Ida', sourceRoot });
  const resolved = await resolveCameraPhotometry(sourceRoot, source.manifest, recipe);
  if (!resolved) throw new Error("Ida's recipe does not name a published photometric model.");
  assert.equal(resolved.report.model, 'helfenstein-1996-hapke');
  assert.deepEqual(resolved.report.citations, ['doi-10-1006-icar-1996-0036']);
  const rad = Math.PI / 180, atReference = resolved.normalize(25 * rad, 0, 25 * rad);
  assert.ok(atReference !== null && Math.abs(atReference - 1) < 1e-12, 'the reference geometry keeps its brightness');
  assert.equal(resolved.normalize(80 * rad, 10 * rad, 25 * rad), null, 'incidence beyond the limit is withheld');
});
