import { required } from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('vesta');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../../..'), base = resolve(root, 'src/objects/vesta');
const read = async (path: string) => JSON.parse(await readFile(resolve(base, path), 'utf8'));

test('the HAMO-1-2 clear mosaic is pinned on its own labeled grid and fills the north the color and LAMO mosaics never saw', async () => {
  const [config, content, manifest, text] = await Promise.all([
    'source/preparation/terrestrial.json', 'source/content/object.json', 'source/manifest.json', 'text.json'].map(read));
  const source = manifest.inputs.find((entry: {id: string}) => entry.id === 'dlr-vesta-hamo-clear');
  const label = await readFile(resolve(base, 'source/reference/hamo-clear.lbl'), 'ascii');
  const field = (key: string) => required(label.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`, 'm')))[1].trim();
  assert.equal(field('SAMPLE_BITS'), '8');
  assert.equal(field('BANDS'), '1');
  assert.equal(field('MAP_PROJECTION_TYPE'), 'SIMPLE_CYLINDRICAL');
  assert.equal(source.width, Number(field('LINE_SAMPLES')));
  assert.equal(source.height, Number(field('LINES')));
  assert.equal(source.lensId, 'hamo');
  assert.ok(manifest.documents.some((entry: {path: string}) => entry.path === 'reference/hamo-clear.lbl'), 'the attached label is declared');
  const observations = config.raster.observations as { id: string; monochromeBase?: string; validity: Record<string, unknown> }[];
  const hamo = required(observations.find(entry => entry.id === 'hamo'));
  assert.deepEqual(hamo.validity.grid, { pixelsPerDegree: Number(field('MAP_RESOLUTION')), sampleOffset: Number(field('SAMPLE_PROJECTION_OFFSET')), lineOffset: Number(field('LINE_PROJECTION_OFFSET')) });
  assert.equal(hamo.validity.centerLongitude, Number(field('CENTER_LONGITUDE')));
  assert.equal(hamo.validity.labelPath, 'reference/hamo-clear.lbl');
  // The fallback base must be composed before the observations that borrow from it.
  assert.equal(observations[0]!.id, 'hamo');
  for (const id of ['normal', 'surface']) assert.equal(required(observations.find(entry => entry.id === id)).monochromeBase, 'hamo', `${id} falls back to HAMO`);
  assert.equal(required(content.lenses.controls.find((entry: {id: string}) => entry.id === 'hamo')).source.id, source.id);
  assert.equal(typeof text.datasets.hamo.summary, 'string');
});

test('the prepared photographic lenses cover the whole map once HAMO fills them', async () => {
  const prepared = await read('prepared/surfaces.json');
  const surfaces = (Array.isArray(prepared) ? prepared : prepared.surfaces) as { id: string; missingPixels: number; monochromePixels?: number; surface?: { width?: number; height?: number }; width?: number; height?: number }[];
  const share = (surface: typeof surfaces[number]) => {
    const width = surface.width ?? surface.surface?.width, height = surface.height ?? surface.surface?.height;
    return surface.missingPixels / (required(width) * required(height));
  };
  const byId = new Map(surfaces.map(surface => [surface.id, surface]));
  assert.ok(share(required(byId.get('hamo'))) < 0.01, 'HAMO leaves under one percent of the map missing');
  for (const id of ['normal', 'surface']) {
    const surface = required(byId.get(id));
    assert.ok(share(surface) < 0.01, `${id} is filled by HAMO`);
    assert.ok(required(surface.monochromePixels) > 0, `${id} reports the texels HAMO supplied`);
  }
});
