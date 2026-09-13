import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { datasetCaption } from '../dataset-caption.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import type { ProvenanceDocument } from '../../src/platform/object-provenance.mts';
const read = async (id: string): Promise<ProvenanceDocument> => validateObjectProvenance(
  JSON.parse(await readFile(new URL(`../../src/planets/${id}/prepared/provenance.json`, import.meta.url), 'utf8')), id,
);
const lens = (id: string) => ({ id, label: id, title: `${id} instrument dataset`, summary: 'Brightness records the measured surface response.' });

test('Mercury titles link the main mosaic, not coverage-completion images or tile templates', async () => {
  const document = await read('mercury');
  const before = structuredClone(document);
  const caption = datasetCaption(document, lens('enhanced'));
  assert.equal(caption.title, lens('enhanced').title);
  const source = document.sources.find(source => source.id === 'usgs-messenger-enhanced-global-z3');
  assert.ok(source?.sourceUrl);
  assert.equal(caption.href, source.sourceUrl);
  assert.deepEqual(document, before);
});

test('direct source images take precedence over product pages, including WMS images', async () => {
  const earth = structuredClone(await read('earth'));
  const source = earth.sources.find(source => source.path === 'blue-marble-july.jpg');
  assert.ok(source);
  Reflect.set(source, 'sourceUrl', 'https://example.org/product');
  const caption = datasetCaption(earth, lens('normal'));
  assert.ok(caption.href);
  assert.match(caption.href, /world\.200407\.3x21600x10800\.jpg$/u);
  const venus = await read('venus');
  const radar = datasetCaption(venus, lens('radar'));
  assert.ok(radar.href);
  assert.equal(new URL(radar.href).searchParams.get('FORMAT'), 'image/png');
});

test('a source-defined single-input mosaic does not inherit the parent mosaic link', async () => {
  const io = await read('io');
  const caption = datasetCaption(io, lens('enhanced'));
  assert.ok(caption.href);
  assert.match(caption.href, /FalseColor_1km\.tif$/u);
});

test('a composite dataset links its declared primary input, which must belong to that product', async () => {
  const earth = structuredClone(await read('earth'));
  const caption = datasetCaption(earth, lens('clouds'));
  assert.ok(caption.href);
  assert.match(caption.href, /cloud_combined_8192\.tif$/u);
  const product = earth.products.find(product => product.id === 'clouds' || product.lensIds?.includes('clouds'));
  assert.ok(product);
  Reflect.set(product, 'inputs', product.inputs.filter(id => id !== 'nasa-blue-marble-clouds'));
  assert.equal(datasetCaption(earth, lens('clouds')).href, undefined);
});

test('a multi-image mosaic does not pass off an arbitrary exposure as its source image', async () => {
  const sun = await read('sun');
  assert.equal(datasetCaption(sun, lens('photosphere')).href, undefined);
  const caption = datasetCaption(sun, lens('chromosphere'));
  assert.ok(caption.href);
  assert.match(caption.href, /AIA0304\/CR2311\.fits$/u);
});

test('missing, internal, and malformed source URLs leave a plain title', async () => {
  assert.deepEqual(datasetCaption(undefined, lens('normal')), { title: 'normal instrument dataset' });
  const mercury = structuredClone(await read('mercury'));
  const source = mercury.sources.find(source => source.path === 'maps/mercury-bdr-global.png');
  assert.ok(source);
  Reflect.set(source, 'origin', 'https://example.org/{tile}.png');
  Reflect.set(source, 'sourceUrl', 'javascript:alert(1)');
  Reflect.set(source, 'acquisitionOperation', { url: '/local/image.png' });
  assert.equal(datasetCaption(mercury, lens('normal')).href, undefined);
  Reflect.set(source, 'kind', 'authored-document');
  assert.deepEqual(datasetCaption(mercury, lens('normal')), { title: 'normal instrument dataset' });
});
